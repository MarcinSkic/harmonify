<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { Button } from '@/components/ui/button'
import BaseDisplay from '@/pages/game/components/trackDisplay/BaseDisplay.vue'
import AudioVisualizer from '@/pages/game/round/components/AudioVisualizer.vue'
import { useMusicPlayerStore } from '@/pages/game/stores'
import { useLocalGameStore } from '@/pages/local/stores'
import LocalPlaybackControls from './components/LocalPlaybackControls.vue'
import ScoringForm from './components/ScoringForm.vue'

const router = useRouter()
const localGameStore = useLocalGameStore()
const musicPlayerStore = useMusicPlayerStore()

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

async function handleSubmitScores(scores: Map<string, number>) {
  await localGameStore.submitScores(scores)
  await localGameStore.nextRound()

  if (localGameStore.game?.status === 'finished') {
    router.push({ name: 'localResult', params: { id: localGameStore.game.id } })
  }
}

async function handleFinishGame(scores: Map<string, number>) {
  await localGameStore.submitScores(scores)
  await localGameStore.finishGame()
  router.push({ name: 'localResult', params: { id: localGameStore.game!.id } })
}
</script>

<template>
  <div v-if="game && track" class="grid grid-rows-[1fr_15vh]">
    <div
      class="
        grid place-content-center place-items-center gap-y-6 self-start p-4
        md:mt-4 md:place-self-center md:p-0
      "
    >
      <span class="text-xl">Round: {{ game.currentRound }}</span>

      <!-- Playing phase -->
      <template v-if="game.roundPhase === 'playing'">
        <LocalPlaybackControls
          v-if="musicPlayData"
          :track-duration="game.settings.trackDuration"
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
          />
        </div>

        <Button type="button" size="lg" class="mt-4" @click="handleShowAnswer">
          Show answer
        </Button>
      </template>

      <!-- Scoring phase -->
      <template v-else-if="game.roundPhase === 'scoring'">
        <ScoringForm
          :track="track"
          :teams="game.teams"
          :hide-scores="game.settings.hideScores"
          :can-advance-round="localGameStore.canAdvanceRound"
          @submit="handleSubmitScores"
          @finish="handleFinishGame"
        />
      </template>
    </div>
    <AudioVisualizer />
  </div>
</template>
