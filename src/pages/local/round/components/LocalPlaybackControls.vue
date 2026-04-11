<script setup lang="ts">
import { Pause, Play } from '@lucide/vue'
import { useAnimate } from '@vueuse/core'
import { onUnmounted, ref, watch } from 'vue'
import { Button } from '@/components/ui/button'
import VolumeInput from '@/pages/game/round/components/VolumeInput.vue'
import { useMusicPlayerStore } from '@/pages/game/stores'

const props = defineProps<{
  trackDuration: number
  musicPlayData: { uri: string, trackStart_ms: number }
}>()

const musicPlayerStore = useMusicPlayerStore()

const isPlayingStarted = ref(false)
const isPlaying = ref(false)

const playButton = ref<HTMLButtonElement | null>(null)
const trackTimer = useAnimate(
  playButton,
  [{ backgroundPositionX: '100%' }, { backgroundPositionX: '0%' }],
  { duration: props.trackDuration * 1000, iterations: 1, immediate: false },
)

function handleTrackTimerFinish() {
  musicPlayerStore.seek(props.musicPlayData.trackStart_ms)
  trackTimer.currentTime.value = 0
  trackTimer.playbackRate.value = 1
  isPlaying.value = false
}

function togglePlay() {
  isPlaying.value = !isPlaying.value
}

async function startPlaying() {
  if (!isPlayingStarted.value) {
    isPlayingStarted.value = true
    await musicPlayerStore.play(props.musicPlayData)
  }
  else {
    await musicPlayerStore.resume()
  }
}

async function stopPlaying() {
  await musicPlayerStore.pause()
}

watch(isPlaying, (playing) => {
  if (playing) {
    if (trackTimer.animate.value)
      trackTimer.animate.value.onfinish = handleTrackTimerFinish
    trackTimer.play()
    startPlaying()
  }
  else {
    trackTimer.pause()
    stopPlaying()
  }
})

onUnmounted(() => {
  stopPlaying()
})
</script>

<template>
  <div class="relative flex items-center gap-4">
    <!-- eslint-disable-next-line tailwindcss/no-contradicting-classname -->
    <Button
      ref="playButton"
      class="
        h-20 w-32 rounded-xl
        bg-[linear-gradient(0.25turn,#1b3162_49%,50%,transparent)]
        bg-size-[200%_200%] bg-position-[100%_0]
      "
      type="button"
      @click="togglePlay"
    >
      <Pause v-if="isPlaying" class="size-12" />
      <Play v-else class="size-12" />
    </Button>
    <VolumeInput />
  </div>
</template>
