<script setup lang="ts">
import { useRouter } from 'vue-router'
import { Button } from '@/components/ui/button'
import { useConnectionStore, useGameDataStore } from '@/stores'

const connectionStore = useConnectionStore()
const gameDataStore = useGameDataStore()
const router = useRouter()

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
</script>

<template>
  <Button type="button" @click="createRoom">
    Create room
  </Button>
</template>
