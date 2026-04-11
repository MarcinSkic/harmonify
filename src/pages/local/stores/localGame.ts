import type { LocalGame, LocalGameSettings, Track } from '@/db/schemas'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { db } from '@/db'
import {
  createCategoryPool,
  getAllCategories,
  isCategoryPoolExhausted,
  pickFromTag,
} from '@/pages/local/engine/categoryPool'
import { createPool, isExhausted, pickRandom } from '@/pages/local/engine/trackPool'

export const useLocalGameStore = defineStore('localGame', () => {
  const game = ref<LocalGame | null>(null)
  const currentTrack = ref<Track | null>(null)

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

  const allCategories = computed(() =>
    game.value?.categoryPoolState
      ? getAllCategories(game.value.categoryPoolState)
      : [],
  )

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
  ): Promise<string> {
    const tracks = selectedPlaylistIds.length > 0
      ? await db.tracks.where('playlistIds').anyOf(selectedPlaylistIds).toArray()
      : await db.tracks.toArray()

    const playableTracks = tracks.filter(t => t.audioUrl)

    const isCategory = settings.gameMode === 'category'
    const trackPoolState = createPool(isCategory ? [] : playableTracks.map(t => t.id))
    const categoryPoolState = isCategory ? createCategoryPool(playableTracks) : undefined

    const id = crypto.randomUUID()

    game.value = {
      id,
      createdAt: Date.now(),
      status: 'playing',
      teams: teams.map(t => ({
        id: crypto.randomUUID(),
        name: t.name,
        score: 0,
        roundScores: [],
      })),
      settings,
      currentRound: 0,
      trackPoolState,
      categoryPoolState,
      selectedPlaylistIds,
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

  async function pickCategory(tag: string) {
    if (!game.value || game.value.settings.gameMode !== 'category')
      return
    if (!game.value.categoryPoolState)
      return

    const { trackId, newState } = pickFromTag(game.value.categoryPoolState, tag)

    game.value.categoryPoolState = newState
    game.value.currentTrackId = trackId
    game.value.currentCategory = tag
    game.value.roundPhase = 'playing'

    await _loadTrack(trackId)
    await _persist()
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

    for (const team of game.value.teams) {
      const roundScore = scores.get(team.id) ?? 0
      team.score += roundScore
      team.roundScores.push(roundScore)
    }

    await _persist()
  }

  async function nextRound() {
    if (!game.value)
      return

    if (!canAdvanceRound.value) {
      await finishGame()
      return
    }

    await startRound()
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
    isGameInProgress,
    sortedTeams,
    canAdvanceRound,
    allCategories,
    createGame,
    resumeGame,
    findUnfinishedGame,
    startRound,
    pickCategory,
    showAnswer,
    submitScores,
    nextRound,
    finishGame,
    deleteGame,
  }
})
