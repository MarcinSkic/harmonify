<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { Button } from '@/components/ui/button'
import { PinInput, PinInputGroup, PinInputInput } from '@/components/ui/pin-input'
import { useConnectionStore, useGameDataStore } from '@/stores'

const connectionStore = useConnectionStore()
const gameDataStore = useGameDataStore()
const router = useRouter()

const roomId = ref<string[]>([])
const isJoinRoomError = ref(false)

function joinRoom() {
  const room = roomId.value.join('')

  connectionStore.openConnection(`/game/${room}`, {
    handleOpen() {},
    handleError() {
      isJoinRoomError.value = true
    },
    handleMessage(message) {
      if (message.$type === 'message/playerInfoDto') {
        gameDataStore.joinGame(room, message.data)
        router.push({ name: 'setup', params: { id: room } })
      }
    },
  })
}
</script>

<template>
  <form class="flex flex-col items-center gap-2" @submit.prevent="joinRoom">
    <p v-if="isJoinRoomError" class="text-sm text-destructive">
      No room with such id
    </p>
    <div class="flex items-center gap-2">
      <PinInput
        id="room-id"
        v-model="roomId"
        placeholder="○"
        @update:model-value="isJoinRoomError = false"
        @complete="joinRoom"
      >
        <PinInputGroup>
          <PinInputInput v-for="(id, index) in 4" :key="id" :index="index" required />
        </PinInputGroup>
      </PinInput>
      <Button size="sm" type="submit">
        Join
      </Button>
    </div>
  </form>
</template>
