<script setup lang="ts">
import type { MusicPlayData } from '@/types'
import { onMounted, ref } from 'vue'
import { useMusicPlayerStore } from '@/pages/game/stores'
import { MusicServerService } from '@/services'

const audioEl = ref<HTMLAudioElement | null>(null)
const musicPlayerStore = useMusicPlayerStore()
const audioContext = ref(new AudioContext())

let currentBlobUrl: string | null = null
let currentSrcUri: string | null = null
let loadToken = 0
// Counter (not boolean) so _preload's finally doesn't clear _play's in-flight status
let operationsInFlight = 0
let shouldPlayAfterLoad = false

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

// Returns false if superseded by a newer call, true on success.
async function loadAudio(playData: MusicPlayData): Promise<boolean> {
  const myToken = ++loadToken
  const previousBlobUrl = currentBlobUrl

  const newSrc = MusicServerService.needsAuth(playData.uri)
    ? await MusicServerService.fetchAudioBlobUrl(playData.uri)
    : playData.uri

  // A newer call superseded this one while we were fetching
  if (myToken !== loadToken) {
    if (newSrc.startsWith('blob:'))
      URL.revokeObjectURL(newSrc)
    return false
  }

  const el = audioEl.value
  if (!el) {
    if (newSrc.startsWith('blob:'))
      URL.revokeObjectURL(newSrc)
    return false
  }

  el.pause()
  el.src = newSrc
  currentSrcUri = playData.uri
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
    return false
  }

  // Another call may have started while we were waiting for metadata
  if (myToken !== loadToken)
    return false

  return true
}

onMounted(() => {
  const el = audioEl.value!
  el.volume = 1
  musicPlayerStore.audioSource = audioContext.value.createMediaElementSource(el)
})

musicPlayerStore.player = {
  async _turnOn() {},
  async _preload(playData) {
    operationsInFlight++
    shouldPlayAfterLoad = false
    try {
      await loadAudio(playData)
    }
    finally {
      operationsInFlight--
    }
  },
  async _play(playData) {
    operationsInFlight++
    shouldPlayAfterLoad = true
    try {
      const el = audioEl.value
      if (!el)
        return

      const alreadyLoaded = currentSrcUri === playData.uri && el.readyState >= 1 /* HAVE_METADATA */

      if (!alreadyLoaded && !await loadAudio(playData))
        return

      el.currentTime = playData.trackStart_ms / 1000

      if (shouldPlayAfterLoad) {
        try {
          await el.play()
        }
        catch (e) {
          // play() commonly rejects when interrupted by a subsequent pause/load;
          // swallow so it doesn't become an unhandled rejection.
          console.warn('Audio play interrupted:', e)
        }
      }
    }
    finally {
      operationsInFlight--
    }
  },
  async _seek(time_ms) {
    const el = audioEl.value
    if (el)
      el.currentTime = time_ms / 1000
  },
  async _pause() {
    shouldPlayAfterLoad = false
    audioEl.value?.pause()
  },
  async _resume() {
    shouldPlayAfterLoad = true
    if (operationsInFlight > 0)
      return
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
