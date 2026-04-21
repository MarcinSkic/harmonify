import type { Category, GameResult, LocalGame, LocalGameGameMode, LocalGameSettings, RoundResult, Track } from '@/db/schemas'
import type { LocalGuessLevel } from '@/types'
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

function computeResult(
  points: number,
  gameMode: LocalGameGameMode,
  isCurrentTeam: boolean,
  categoryPoints?: number,
): LocalGuessLevel {
  if (points === 0)
    return 'none'
  if (gameMode === 'random')
    return 'full'
  if (categoryPoints !== undefined && points >= categoryPoints)
    return 'full'
  if (!isCurrentTeam && categoryPoints !== undefined && points >= categoryPoints / 2)
    return 'takeover'
  return 'artist'
}

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

  const lastRoundTeamScores = computed(() => {
    const rounds = game.value?.rounds
    return rounds?.[rounds.length - 1]?.teamScores ?? []
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
      rounds: [],
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

  async function findAllUnfinishedGames(): Promise<LocalGame[]> {
    const games = await db.localGames
      .where('status')
      .equals('playing')
      .sortBy('createdAt')
    return games.reverse()
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

    const g = game.value

    previousTeams.value = JSON.parse(JSON.stringify(g.teams)) as LocalGame['teams']

    for (const team of g.teams) {
      const roundScore = scores.get(team.id) ?? 0
      team.score += roundScore
      team.roundScores.push(roundScore)
    }

    if (currentTrack.value) {
      const round: RoundResult = {
        roundNumber: g.currentRound,
        trackId: currentTrack.value.id,
        trackSourceId: currentTrack.value.sourceId,
        trackName: currentTrack.value.name,
        trackArtists: [...currentTrack.value.artists],
        albumName: currentTrack.value.albumName,
        albumImageUrl: currentTrack.value.albumImageUrl,
        previewImageUrl: currentTrack.value.previewImageUrl,
        categoryId: g.currentCategory,
        categoryName: currentCategoryInfo.value?.displayName,
        categoryPoints: currentCategoryInfo.value?.points,
        currentTeamId: g.currentTeamId,
        currentTeamName: g.teams.find(t => t.id === g.currentTeamId)?.name,
        teamScores: g.teams.map(team => ({
          teamId: team.id,
          teamName: team.name,
          points: scores.get(team.id) ?? 0,
          result: computeResult(
            scores.get(team.id) ?? 0,
            g.settings.gameMode,
            team.id === g.currentTeamId,
            currentCategoryInfo.value?.points,
          ),
        })),
      }
      g.rounds.push(round)
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

    if (game.value.settings.saveGame) {
      const gameResult: GameResult = {
        id: game.value.id,
        createdAt: game.value.createdAt,
        finishedAt: Date.now(),
        gameMode: game.value.settings.gameMode,
        teams: game.value.teams.map(t => ({
          id: t.id,
          name: t.name,
          totalScore: t.score,
        })),
        rounds: JSON.parse(JSON.stringify(game.value.rounds)) as RoundResult[],
        selectedPlaylistIds: [...game.value.selectedPlaylistIds],
      }
      await db.gameResults.put(gameResult)
    }
  }

  async function addTeam(name: string) {
    if (!game.value)
      return

    const existingRoundCount = game.value.teams[0]?.roundScores.length ?? 0

    const newTeam = {
      id: crypto.randomUUID(),
      name: name.trim() || `Team ${game.value.teams.length + 1}`,
      score: 0,
      roundScores: Array.from<number>({ length: existingRoundCount }).fill(0),
      disabled: false,
    }

    game.value.teams.push(newTeam)
    await _persist()
  }

  function clearGame() {
    game.value = null
    currentTrack.value = null
  }

  async function deleteGame(id: string) {
    await db.localGames.delete(id)
    if (game.value?.id === id)
      clearGame()
  }

  async function findAllGameResults(): Promise<GameResult[]> {
    return db.gameResults.orderBy('finishedAt').reverse().toArray()
  }

  async function deleteGameResult(id: string): Promise<void> {
    await db.gameResults.delete(id)
  }

  function exportGameResult(result: GameResult): void {
    const json = JSON.stringify(result, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `harmonify-result-${result.finishedAt}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function importGameResult(file: File): Promise<void> {
    const text = await file.text()
    const json = JSON.parse(text)
    const { gameResultSchema } = await import('@/db/schemas')
    const result = gameResultSchema.parse(json)
    await db.gameResults.put(result)
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
    lastRoundTeamScores,
    createGame,
    resumeGame,
    findUnfinishedGame,
    findAllUnfinishedGames,
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
    addTeam,
    finishGame,
    clearGame,
    deleteGame,
    findAllGameResults,
    deleteGameResult,
    exportGameResult,
    importGameResult,
  }
})
