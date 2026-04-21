<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { Button } from '@/components/ui/button'
import BaseDisplay from '@/pages/game/components/trackDisplay/BaseDisplay.vue'
import AudioVisualizer from '@/pages/game/round/components/AudioVisualizer.vue'
import { useMusicPlayerStore } from '@/pages/game/stores'
import { useLocalGameStore } from '@/pages/local/stores'
import { useSettingsStore } from '@/stores'
import CategoryPicker from './components/CategoryPicker.vue'
import LocalLeaderboard from './components/LocalLeaderboard.vue'
import LocalPlaybackControls from './components/LocalPlaybackControls.vue'
import ScoringForm from './components/ScoringForm.vue'

const router = useRouter()
const localGameStore = useLocalGameStore()
const musicPlayerStore = useMusicPlayerStore()
const settingsStore = useSettingsStore()

const game = computed(() => localGameStore.game)
const track = computed(() => localGameStore.currentTrack)

const musicPlayData = computed(() => {
  if (!track.value?.audioUrl)
    return null

  const startMs = track.value.playbackRange?.startMs ?? 0

  return {
    uri: track.value.audioUrl,
    trackStart_ms: startMs,
  }
})

const effectiveDuration = computed(() => {
  const range = track.value?.playbackRange
  if (range)
    return (range.endMs - range.startMs) / 1000
  return game.value?.settings.trackDuration ?? 30
})

onMounted(async () => {
  if (!game.value) {
    const gameId = router.currentRoute.value.params.id as string
    const restored = await localGameStore.resumeGame(gameId)
    if (!restored) {
      router.push({ name: 'localSetup' })
      return
    }
  }

  await musicPlayerStore.turnOn()
})

async function handleShowAnswer() {
  await localGameStore.showAnswer()
}

async function handlePickCategory(categoryId: string) {
  await localGameStore.pickCategory(categoryId)
}

async function handleSelectTeam(teamId: string) {
  await localGameStore.setCurrentTeam(teamId)
}

async function handleToggleTeamDisabled(teamId: string) {
  await localGameStore.toggleTeamDisabled(teamId)
}

async function handleSubmitScores(scores: Map<string, number>) {
  await localGameStore.submitScores(scores)

  if (settingsStore.hideScores) {
    await localGameStore.nextRound()
    if (localGameStore.game?.status === 'finished')
      router.push({ name: 'localResult', params: { id: localGameStore.game.id } })
    return
  }

  await localGameStore.showLeaderboard()
}

async function handleAddTeam(name: string) {
  await localGameStore.addTeam(name)
}

async function handleContinueFromLeaderboard() {
  await localGameStore.nextRound()
  if (localGameStore.game?.status === 'finished')
    router.push({ name: 'localResult', params: { id: localGameStore.game.id } })
}
</script>

<template>
  <div
    v-if="game"
    :class="game.roundPhase === 'playing' ? 'grid grid-rows-[1fr_15vh]' : `
      grid grid-rows-[1fr]
    `"
  >
    <div
      class="
        grid place-content-center place-items-center gap-y-6 self-start p-4
        md:mt-4 md:place-self-center md:p-0
        lg:gap-y-8
      "
    >
      <!-- Picking category phase -->
      <template v-if="game.roundPhase === 'pickingCategory'">
        <CategoryPicker
          :categories="localGameStore.allCategories"
          :teams="game.teams"
          :current-team-id="game.currentTeamId"
          @pick="handlePickCategory"
          @select-team="handleSelectTeam"
          @toggle-team-disabled="handleToggleTeamDisabled"
          @add-team="handleAddTeam"
        />
      </template>

      <!-- Playing phase -->
      <template v-else-if="game.roundPhase === 'playing' && track">
        <LocalPlaybackControls
          v-if="musicPlayData"
          :track-duration="effectiveDuration"
          :music-play-data="musicPlayData"
        />

        <div
          v-if="game.settings.hostSeesAnswer" class="
            mt-4 rounded-lg border border-dashed p-4 opacity-60
          "
        >
          <p class="mb-1 text-xs text-muted-foreground">
            Answer (host only)
          </p>
          <BaseDisplay
            :title="track.name"
            :author="track.artists.join(', ')"
            :album="track.albumName"
            stacked
          />
        </div>

        <Button type="button" size="lg" class="mt-4" @click="handleShowAnswer">
          Show answer
        </Button>
      </template>

      <!-- Scoring phase -->
      <template v-else-if="game.roundPhase === 'scoring' && track">
        <ScoringForm
          :track="track"
          :teams="game.teams"
          :current-team-id="game.currentTeamId"
          :category="localGameStore.currentCategoryInfo"
          :settings="game.settings"
          @submit="handleSubmitScores"
        />
      </template>

      <!-- Leaderboard phase -->
      <template v-else-if="game.roundPhase === 'leaderboard'">
        <LocalLeaderboard
          :teams="localGameStore.sortedTeams"
          :previous-teams="localGameStore.previousTeams"
          :duration="game.settings.breakDurationBetweenRounds"
          @continue="handleContinueFromLeaderboard"
          @add-team="handleAddTeam"
        />
      </template>
    </div>
    <AudioVisualizer v-if="game.roundPhase === 'playing'" />
  </div>
</template>
