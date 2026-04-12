<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useMusicPlayerStore } from '@/pages/game/stores'

const audioEl = ref<HTMLAudioElement | null>(null)
const musicPlayerStore = useMusicPlayerStore()
const audioContext = ref(new AudioContext())

const musicServerUrl = import.meta.env.VITE_MUSIC_SERVER_URL ?? ''
const musicServerUser = import.meta.env.VITE_MUSIC_SERVER_USER ?? ''
const musicServerPassword = import.meta.env.VITE_MUSIC_SERVER_PASSWORD ?? ''

let currentBlobUrl: string | null = null
let loadToken = 0

function needsAuth(url: string): boolean {
  return musicServerUrl !== '' && url.startsWith(musicServerUrl)
}

async function fetchAuthenticatedAudio(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      Authorization: `Basic ${btoa(`${musicServerUser}:${musicServerPassword}`)}`,
    },
  })
  const blob = await response.blob()
  return URL.createObjectURL(blob)
}

function waitForMetadata(el: HTMLAudioElement): Promise<void> {
  if (el.readyState >= 1 /* HAVE_METADATA */)
    return Promise.resolve()

  return new Promise((resolve, reject) => {
    function onLoaded() {
      el.removeEventListener('loadedmetadata', onLoaded)
      el.removeEventListener('error', onError)
      resolve()
    }
    function onError() {
      el.removeEventListener('loadedmetadata', onLoaded)
      el.removeEventListener('error', onError)
      reject(el.error ?? new Error('Audio failed to load'))
    }
    el.addEventListener('loadedmetadata', onLoaded, { once: true })
    el.addEventListener('error', onError, { once: true })
  })
}

onMounted(() => {
  const el = audioEl.value!
  el.volume = 1
  musicPlayerStore.audioSource = audioContext.value.createMediaElementSource(el)
})

musicPlayerStore.player = {
  async _turnOn() {},
  async _play(playData) {
    const myToken = ++loadToken
    const previousBlobUrl = currentBlobUrl

    const newSrc = needsAuth(playData.uri)
      ? await fetchAuthenticatedAudio(playData.uri)
      : playData.uri

    // A newer _play call superseded this one while we were fetching
    if (myToken !== loadToken) {
      if (newSrc.startsWith('blob:'))
        URL.revokeObjectURL(newSrc)
      return
    }

    const el = audioEl.value
    if (!el) {
      if (newSrc.startsWith('blob:'))
        URL.revokeObjectURL(newSrc)
      return
    }

    el.pause()
    el.src = newSrc
    currentBlobUrl = newSrc.startsWith('blob:') ? newSrc : null
    el.load()

    // Revoke the previous blob only after the new src is assigned, so the
    // element never points at a dead URL.
    if (previousBlobUrl && previousBlobUrl !== newSrc)
      URL.revokeObjectURL(previousBlobUrl)

    try {
      await waitForMetadata(el)
    }
    catch (e) {
      console.error('Failed to load audio source:', e)
      return
    }

    // Another _play may have started while we were waiting for metadata
    if (myToken !== loadToken)
      return

    el.currentTime = playData.trackStart_ms / 1000
    try {
      await el.play()
    }
    catch (e) {
      // play() commonly rejects when interrupted by a subsequent pause/load;
      // swallow so it doesn't become an unhandled rejection.
      console.warn('Audio play interrupted:', e)
    }
  },
  async _seek(time_ms) {
    const el = audioEl.value
    if (el)
      el.currentTime = time_ms / 1000
  },
  async _pause() {
    audioEl.value?.pause()
  },
  async _resume() {
    const el = audioEl.value
    if (!el)
      return
    try {
      await el.play()
    }
    catch (e) {
      console.warn('Audio resume failed:', e)
    }
  },
  async _setVolume(_newVolume) {
    if (audioEl.value)
      audioEl.value.volume = 1
  },
}
</script>

<template>
  <audio ref="audioEl" crossorigin="anonymous" />
</template>
