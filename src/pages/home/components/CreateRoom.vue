<script setup lang="ts">
import Cookies from 'universal-cookie'
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useConnectionStore, useGameDataStore } from '@/stores'

const cookies = new Cookies(null, { path: '/' })
const isLogged = ref(!!cookies.get('access_token') || !!cookies.get('refresh_token'))

const connectionStore = useConnectionStore()
const gameDataStore = useGameDataStore()
const router = useRouter()

const password = ref('')
const passwordError = ref('')

function createRoom() {
  connectionStore.openConnection('/create', {
    handleOpen() {},
    handleError() {
      console.error('Couldn\'t establish connection with a server')
    },
    handleMessage(message) {
      if (message.$type === 'message/createdGameDto') {
        gameDataStore.createGame(message.data)
        router.push({ name: 'setup', params: { id: message.data.gameId } })
      }
    },
  })
}

function connectToSpotify() {
  window.location.href = '/api/token/request'
}
</script>

<template>
  <form v-if="isLogged" class="grid justify-items-center gap-5" @submit.prevent="createRoom">
    <p
      v-if="passwordError" class="-mb-3 text-base font-normal text-destructive"
    >
      {{ passwordError }}
    </p>
    <Input
      v-model="password" type="text" placeholder="(WIP) Password, leave blank for none" class="
        invisible
      " @focus="passwordError = ''"
    />
    <Button type="submit">
      Create room
    </Button>
  </form>
  <div v-else class="grid justify-items-center gap-4">
    <h3 class="flex w-56 flex-wrap items-center justify-end gap-x-3">
      <span class="text-lg font-semibold">Connect to</span>
      <img alt="Spotify logo" src="@/assets/Spotify_Logo_RGB_White.png" width="100">
      <span class="text-lg font-semibold">in order to create room</span>
    </h3>
    <Button @click="connectToSpotify">
      Connect
    </Button>
  </div>
</template>
