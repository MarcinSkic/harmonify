import type { Category, LocalGame, LocalGameSettings, Track } from '@/db/schemas'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { db } from '@/db'
import {
  createCategoryPool,
  getCategoryCounts,
  isCategoryPoolExhausted,
  pickFromCategory,
} from '@/pages/local/engine/categoryPool'
import { createPool, isExhausted, pickRandom } from '@/pages/local/engine/trackPool'
import { useCategoriesStore } from '@/stores'

export const useLocalGameStore = defineStore('localGame', () => {
  const categoriesStore = useCategoriesStore()

  const game = ref<LocalGame | null>(null)
  const currentTrack = ref<Track | null>(null)
  const previousTeams = ref<LocalGame['teams']>([])

  const isGameInProgress = computed(() =>
    game.value !== null && game.value.status !== 'finished',
  )

  const sortedTeams = computed(() => {
    if (!game.value)
      return []
    return [...game.value.teams].sort((a, b) => b.score - a.score)
  })

  const canAdvanceRound = computed(() => {
    if (!game.value)
      return false
    const g = game.value
    const poolExhausted = g.settings.gameMode === 'category'
      ? !g.categoryPoolState || isCategoryPoolExhausted(g.categoryPoolState)
      : isExhausted(g.trackPoolState)
    if (poolExhausted)
      return false
    if (g.settings.maxRounds !== null && g.currentRound >= g.settings.maxRounds)
      return false
    return true
  })

  const allCategories = computed<Array<{ category: Category, count: number, initialCount: number }>>(() => {
    if (!game.value?.categoryPoolState)
      return []
    const counts = getCategoryCounts(game.value.categoryPoolState)
    const initials = game.value.categoryPoolState.initialCounts
    const result: Array<{ category: Category, count: number, initialCount: number }> = []
    for (const category of categoriesStore.categories) {
      if (category.id in counts)
        result.push({ category, count: counts[category.id], initialCount: initials[category.id] ?? counts[category.id] })
    }
    return result.sort((a, b) => a.category.order - b.category.order)
  })

  const currentCategoryInfo = computed<{ displayName: string, points?: number } | undefined>(() => {
    const categoryId = game.value?.currentCategory
    if (!categoryId)
      return undefined
    const category = categoriesStore.categories.find(c => c.id === categoryId)
    if (!category)
      return { displayName: categoryId }
    return { displayName: category.displayName, points: category.points }
  })

  const currentTeam = computed(() => {
    const id = game.value?.currentTeamId
    if (!id)
      return undefined
    return game.value?.teams.find(t => t.id === id)
  })

  function getNextEnabledTeamId(fromId: string | undefined): string | undefined {
    if (!game.value)
      return undefined
    const enabled = game.value.teams.filter(t => !t.disabled)
    if (enabled.length === 0)
      return undefined
    const idx = fromId ? enabled.findIndex(t => t.id === fromId) : -1
    if (idx === -1)
      return enabled[0].id
    return enabled[(idx + 1) % enabled.length].id
  }

  async function _persist() {
    if (!game.value)
      return
    // Deep-unwrap Vue reactivity to avoid DataCloneError from IndexedDB
    await db.localGames.put(JSON.parse(JSON.stringify(game.value)) as LocalGame)
  }

  async function _loadTrack(trackId: string) {
    currentTrack.value = await db.tracks.get(trackId) ?? null
  }

  async function createGame(
    teams: { name: string }[],
    settings: LocalGameSettings,
    selectedPlaylistIds: string[],
    enabledCategories: Category[] = [],
  ): Promise<string> {
    const tracks = selectedPlaylistIds.length > 0
      ? await db.tracks.where('playlistIds').anyOf(selectedPlaylistIds).toArray()
      : await db.tracks.toArray()

    const playableTracks = tracks.filter(t => t.audioUrl && t.enabled !== false)

    const isCategory = settings.gameMode === 'category'
    const trackPoolState = createPool(isCategory ? [] : playableTracks.map(t => t.id))
    const categoryPoolState = isCategory
      ? createCategoryPool(playableTracks, enabledCategories)
      : undefined

    const id = crypto.randomUUID()

    const createdTeams = teams.map(t => ({
      id: crypto.randomUUID(),
      name: t.name,
      score: 0,
      roundScores: [],
      disabled: false,
    }))

    game.value = {
      id,
      createdAt: Date.now(),
      status: 'playing',
      teams: createdTeams,
      settings,
      currentRound: 0,
      trackPoolState,
      categoryPoolState,
      selectedPlaylistIds,
      currentTeamId: createdTeams[0]?.id,
      roundPhase: 'playing',
    }

    await _persist()
    return id
  }

  async function resumeGame(id: string): Promise<boolean> {
    const savedGame = await db.localGames.get(id)
    if (!savedGame)
      return false

    game.value = savedGame

    if (savedGame.currentTrackId)
      await _loadTrack(savedGame.currentTrackId)

    return true
  }

  async function findUnfinishedGame(): Promise<LocalGame | null> {
    const games = await db.localGames
      .where('status')
      .equals('playing')
      .sortBy('createdAt')

    return games.length > 0 ? games.at(-1) ?? null : null
  }

  async function startRound() {
    if (!game.value)
      return
    const g = game.value

    if (g.settings.gameMode === 'random') {
      if (isExhausted(g.trackPoolState))
        return

      const { trackId, newState } = pickRandom(g.trackPoolState)

      g.currentRound++
      g.trackPoolState = newState
      g.currentTrackId = trackId
      g.roundPhase = 'playing'

      await _loadTrack(trackId)
    }
    else {
      if (!g.categoryPoolState || isCategoryPoolExhausted(g.categoryPoolState))
        return

      g.currentRound++
      g.currentTrackId = undefined
      g.currentCategory = undefined
      currentTrack.value = null
      g.roundPhase = 'pickingCategory'
    }

    await _persist()
  }

  async function pickCategory(categoryId: string) {
    if (!game.value || game.value.settings.gameMode !== 'category')
      return
    if (!game.value.categoryPoolState)
      return

    const { trackId, newState } = pickFromCategory(
      game.value.categoryPoolState,
      categoryId,
    )

    game.value.categoryPoolState = newState
    game.value.currentTrackId = trackId
    game.value.currentCategory = categoryId
    game.value.roundPhase = 'playing'

    await _loadTrack(trackId)
    await _persist()
  }

  async function checkSourceId(sourceId: string): Promise<'available' | 'already-played' | 'not-found'> {
    const track = await db.tracks.where('sourceId').equals(sourceId).first()
    if (!track)
      return 'not-found'
    if (game.value?.categoryPoolState?.playedTrackIds.includes(track.id))
      return 'already-played'
    return 'available'
  }

  async function playSpecificTrack(sourceId: string): Promise<'played' | 'already-played' | 'not-found'> {
    if (!game.value || game.value.settings.gameMode !== 'category')
      return 'not-found'
    if (!game.value.categoryPoolState)
      return 'not-found'

    const track = await db.tracks.where('sourceId').equals(sourceId).first()
    if (!track)
      return 'not-found'

    const poolState = game.value.categoryPoolState
    const alreadyPlayed = poolState.playedTrackIds.includes(track.id)

    // Remove this track from all category pools
    const newCategoryPools: Record<string, string[]> = {}
    for (const [id, ids] of Object.entries(poolState.categoryPools))
      newCategoryPools[id] = ids.filter(tid => tid !== track.id)

    game.value.categoryPoolState = {
      categoryPools: newCategoryPools,
      playedTrackIds: [...poolState.playedTrackIds, track.id],
      initialCounts: poolState.initialCounts,
    }
    game.value.currentTrackId = track.id
    game.value.currentCategory = undefined
    game.value.roundPhase = 'playing'

    await _loadTrack(track.id)
    await _persist()
    return alreadyPlayed ? 'already-played' : 'played'
  }

  async function showAnswer() {
    if (!game.value)
      return

    game.value.roundPhase = 'scoring'
    await _persist()
  }

  async function submitScores(scores: Map<string, number>) {
    if (!game.value)
      return

    previousTeams.value = JSON.parse(JSON.stringify(game.value.teams)) as LocalGame['teams']

    for (const team of game.value.teams) {
      const roundScore = scores.get(team.id) ?? 0
      team.score += roundScore
      team.roundScores.push(roundScore)
    }

    await _persist()
  }

  async function showLeaderboard() {
    if (!game.value)
      return

    game.value.roundPhase = 'leaderboard'
    await _persist()
  }

  async function nextRound() {
    if (!game.value)
      return

    if (!canAdvanceRound.value) {
      await finishGame()
      return
    }

    game.value.currentTeamId = getNextEnabledTeamId(game.value.currentTeamId)

    await startRound()
  }

  async function setCurrentTeam(teamId: string) {
    if (!game.value)
      return
    const team = game.value.teams.find(t => t.id === teamId)
    if (!team || team.disabled)
      return
    game.value.currentTeamId = teamId
    await _persist()
  }

  async function toggleTeamDisabled(teamId: string) {
    if (!game.value)
      return
    const team = game.value.teams.find(t => t.id === teamId)
    if (!team)
      return
    team.disabled = !team.disabled
    if (team.disabled && game.value.currentTeamId === teamId)
      game.value.currentTeamId = getNextEnabledTeamId(teamId)
    await _persist()
  }

  async function finishGame() {
    if (!game.value)
      return

    game.value.status = 'finished'
    game.value.currentTrackId = undefined
    currentTrack.value = null
    await _persist()
  }

  async function deleteGame(id: string) {
    await db.localGames.delete(id)
    if (game.value?.id === id) {
      game.value = null
      currentTrack.value = null
    }
  }

  return {
    game,
    currentTrack,
    previousTeams,
    isGameInProgress,
    sortedTeams,
    canAdvanceRound,
    allCategories,
    currentCategoryInfo,
    currentTeam,
    createGame,
    resumeGame,
    findUnfinishedGame,
    startRound,
    pickCategory,
    checkSourceId,
    playSpecificTrack,
    showAnswer,
    submitScores,
    showLeaderboard,
    nextRound,
    setCurrentTeam,
    toggleTeamDisabled,
    finishGame,
    deleteGame,
  }
})
