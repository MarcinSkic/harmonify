import type { Category, CategoryLimit, GameResult, LocalGame, LocalGameGameMode, LocalGameSettings, PlaylistBasedCategory, RoundResult, Track } from '@/db/schemas'
import type { EngineCategory } from '@/pages/local/engine/categoryPool'
import type { LocalGuessLevel } from '@/types'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { db } from '@/db'
import { gameResultSchema } from '@/db/schemas'
import {
  createCategoryPool,
  getCategoryCounts,
  isCategoryPoolExhausted,
  pickFromCategory,
} from '@/pages/local/engine/categoryPool'
import { createPool, isExhausted, pickRandom } from '@/pages/local/engine/trackPool'
import { useCategoriesStore } from '@/stores'

export interface AmbiguousResult { type: 'ambiguous', candidates: string[] }

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

  const ephemeralCategoryMap = computed<Map<string, PlaylistBasedCategory>>(() => {
    const map = new Map<string, PlaylistBasedCategory>()
    for (const e of game.value?.ephemeralCategories ?? [])
      map.set(e.id, e)
    return map
  })

  const allCategories = computed<Array<{ category: Category | PlaylistBasedCategory, count: number, initialCount: number }>>(() => {
    if (!game.value?.categoryPoolState)
      return []
    const counts = getCategoryCounts(game.value.categoryPoolState)
    const initials = game.value.categoryPoolState.initialCounts
    const result: Array<{ category: Category | PlaylistBasedCategory, count: number, initialCount: number }> = []

    for (const id of Object.keys(counts)) {
      const tagCategory = categoriesStore.categories.find(c => c.id === id)
      const ephemeral = ephemeralCategoryMap.value.get(id)
      const category = tagCategory ?? ephemeral
      if (category)
        result.push({ category, count: counts[id], initialCount: initials[id] ?? counts[id] })
    }

    return result.sort((a, b) => {
      const aIsEphemeral = 'type' in a.category
      const bIsEphemeral = 'type' in b.category
      if (aIsEphemeral !== bIsEphemeral)
        return aIsEphemeral ? 1 : -1
      return 0
    })
  })

  const disabledCategoryIdsForCurrentTeam = computed((): Set<string> => {
    const g = game.value
    if (!g || g.settings.gameMode !== 'category')
      return new Set()
    const limit: CategoryLimit = g.settings.categoryLimit ?? 'none'
    const teamId = g.currentTeamId
    if (!teamId || limit === 'none')
      return new Set()

    if (limit === 'no-streak') {
      const teamRounds = g.rounds.filter(r => r.currentTeamId === teamId)
      const lastCategoryId = teamRounds.at(-1)?.categoryId
      return lastCategoryId ? new Set([lastCategoryId]) : new Set()
    }

    if (limit === 'once') {
      const used = g.categoryLimitUsedByTeams?.[teamId] ?? []
      return new Set(used)
    }

    return new Set()
  })

  const currentCategoryInfo = computed<{ displayName: string, points?: number } | undefined>(() => {
    const categoryId = game.value?.currentCategory
    if (!categoryId)
      return undefined
    const tagCategory = categoriesStore.categories.find(c => c.id === categoryId)
    if (tagCategory)
      return { displayName: tagCategory.displayName, points: tagCategory.points }
    const ephemeral = ephemeralCategoryMap.value.get(categoryId)
    if (ephemeral)
      return { displayName: ephemeral.displayName, points: ephemeral.points }
    return { displayName: categoryId }
  })

  const currentTrackMatchingCategories = computed<Array<{ displayName: string }>>(() => {
    const track = currentTrack.value
    if (!track || !game.value?.categoryPoolState)
      return []
    if (!game.value.settings.showTrackCategories)
      return []

    const currentCategoryId = game.value.currentCategory

    return allCategories.value
      .filter(({ category }) => {
        if (category.id === currentCategoryId)
          return false
        if ('type' in category && category.type === 'playlist-based')
          return track.playlistIds.includes(category.playlistId)
        const filter = new Set((category as Category).tagFilter)
        return track.tags.some(tag => filter.has(tag))
      })
      .map(({ category }) => ({ displayName: category.displayName }))
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

    const playableTracks = tracks.filter(t =>
      t.audioUrl && selectedPlaylistIds.some(pid => t.enabledByPlaylist[pid] !== false),
    )

    const isCategory = settings.gameMode === 'category'
    const trackPoolState = createPool(isCategory ? [] : playableTracks.map(t => t.id))

    let ephemeralCategories: PlaylistBasedCategory[] | undefined
    let categoryPoolState

    if (isCategory) {
      const allEngineCategories: EngineCategory[] = [...enabledCategories]

      if (settings.generatePlaylistCategories && selectedPlaylistIds.length > 0) {
        const playlists = await db.playlists.bulkGet(selectedPlaylistIds)
        ephemeralCategories = playlists
          .filter((p): p is NonNullable<typeof p> => p != null)
          .map(p => ({
            id: `playlist-${p.id}`,
            type: 'playlist-based' as const,
            displayName: p.name,
            playlistId: p.id,
            points: settings.generatedCategoryPoints,
          }))
        allEngineCategories.push(...ephemeralCategories)
      }

      categoryPoolState = createCategoryPool(playableTracks, allEngineCategories)
    }

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
      ephemeralCategories,
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

  function _trackOnceCategoryUsage(teamId: string, categoryId: string) {
    if (!game.value?.categoryPoolState)
      return
    const usedByTeam = game.value.categoryLimitUsedByTeams ?? {}
    const currentUsed = usedByTeam[teamId] ?? []
    const newUsed = [...currentUsed, categoryId]
    const totalCategories = Object.keys(game.value.categoryPoolState.initialCounts).length
    game.value.categoryLimitUsedByTeams = {
      ...usedByTeam,
      [teamId]: newUsed.length >= totalCategories ? [] : newUsed,
    }
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

    if (game.value.settings.categoryLimit === 'once' && game.value.currentTeamId)
      _trackOnceCategoryUsage(game.value.currentTeamId, categoryId)

    await _loadTrack(trackId)
    await _persist()
  }

  async function _findTracksInPool(input: string): Promise<Track[]> {
    const trimmed = input.trim()
    const g = game.value

    if (trimmed.includes('/')) {
      const slashIdx = trimmed.lastIndexOf('/')
      const prefix = trimmed.slice(0, slashIdx)
      const numPart = trimmed.slice(slashIdx + 1)
      const num = Number.parseInt(numPart, 10)

      const idsToTry: string[] = [trimmed]
      if (!Number.isNaN(num)) {
        const unpadded = `${prefix}/${String(num)}`
        if (unpadded !== trimmed)
          idsToTry.push(unpadded)
      }

      for (const id of idsToTry) {
        const track = await db.tracks.where('sourceId').equals(id).first()
        if (track) {
          if (!g || g.selectedPlaylistIds.length === 0 || g.selectedPlaylistIds.some(pid => track.playlistIds.includes(pid)))
            return [track]
          return []
        }
      }
      return []
    }

    const num = Number.parseInt(trimmed, 10)
    if (Number.isNaN(num))
      return []

    const suffix = `/${String(num)}`
    const candidates = g && g.selectedPlaylistIds.length > 0
      ? await db.tracks.where('playlistIds').anyOf(g.selectedPlaylistIds).toArray()
      : await db.tracks.toArray()

    return candidates.filter(t => t.sourceId.endsWith(suffix))
  }

  async function checkSourceId(input: string): Promise<'available' | 'already-played' | 'not-found' | AmbiguousResult> {
    const tracks = await _findTracksInPool(input)
    if (tracks.length === 0)
      return 'not-found'
    if (tracks.length > 1)
      return { type: 'ambiguous', candidates: tracks.map(t => t.sourceId) }
    const track = tracks[0]
    if (game.value?.categoryPoolState?.playedTrackIds.includes(track.id))
      return 'already-played'
    return 'available'
  }

  async function playSpecificTrack(input: string): Promise<'played' | 'already-played' | 'not-found' | AmbiguousResult> {
    if (!game.value || game.value.settings.gameMode !== 'category')
      return 'not-found'
    if (!game.value.categoryPoolState)
      return 'not-found'

    const tracks = await _findTracksInPool(input)
    if (tracks.length === 0)
      return 'not-found'
    if (tracks.length > 1)
      return { type: 'ambiguous', candidates: tracks.map(t => t.sourceId) }

    const track = tracks[0]
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
    disabledCategoryIdsForCurrentTeam,
    currentCategoryInfo,
    currentTrackMatchingCategories,
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
