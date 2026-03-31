<script setup lang="ts">
import { useMediaControls } from '@vueuse/core'
import { nextTick, onMounted, ref } from 'vue'
import { useMusicPlayerStore } from '@/pages/game/stores'

const audioEl = ref<HTMLAudioElement | null>(null)
const src = ref<string | undefined>()
const musicPlayerStore = useMusicPlayerStore()
const audioContext = ref(new AudioContext())

const { playing, currentTime, volume } = useMediaControls(audioEl)

const musicServerUrl = import.meta.env.VITE_MUSIC_SERVER_URL ?? ''
const musicServerUser = import.meta.env.VITE_MUSIC_SERVER_USER ?? ''
const musicServerPassword = import.meta.env.VITE_MUSIC_SERVER_PASSWORD ?? ''

function needsAuth(url: string): boolean {
  return musicServerUrl !== '' && url.startsWith(musicServerUrl)
}

// TODO: Maybe create seperate player for playing authenticated audio
async function fetchAuthenticatedAudio(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      Authorization: `Basic ${btoa(`${musicServerUser}:${musicServerPassword}`)}`,
    },
  })
  const blob = await response.blob()
  return URL.createObjectURL(blob)
}

onMounted(() => {
  volume.value = 1
  musicPlayerStore.audioSource = audioContext.value.createMediaElementSource(audioEl.value!)
})

musicPlayerStore.player = {
  async _turnOn() {},
  async _play(playData) {
    if (src.value?.startsWith('blob:'))
      URL.revokeObjectURL(src.value)

    src.value = needsAuth(playData.uri)
      ? await fetchAuthenticatedAudio(playData.uri)
      : playData.uri

    await nextTick()
    currentTime.value = playData.trackStart_ms / 1000
    playing.value = true
  },
  async _seek(time_ms) {
    currentTime.value = time_ms / 1000
  },
  async _pause() {
    playing.value = false
  },
  async _resume() {
    playing.value = true
  },
  async _setVolume(_newVolume) {
    volume.value = 1
  },
}
</script>

<template>
  <audio ref="audioEl" :src crossorigin="anonymous" />
</template>
