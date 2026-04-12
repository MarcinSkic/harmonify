<script setup lang="ts">
import { KeyRound } from '@lucide/vue'
import { watchDebounced } from '@vueuse/core'
import { ref } from 'vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useLocalGameStore } from '@/pages/local/stores'

const localGameStore = useLocalGameStore()

const open = ref(false)
const sourceId = ref('')
const status = ref<{ type: 'error' | 'warning', message: string } | null>(null)

watchDebounced(sourceId, async (value) => {
  const trimmed = value.trim()
  if (!trimmed) {
    status.value = null
    return
  }

  const result = await localGameStore.checkSourceId(trimmed)
  if (result === 'not-found')
    status.value = { type: 'error', message: `Track not found for sourceId: ${trimmed}` }
  else if (result === 'already-played')
    status.value = { type: 'warning', message: 'This track was already played' }
  else
    status.value = null
}, { debounce: 300 })

async function handleSubmit() {
  const value = sourceId.value.trim()
  if (!value || status.value?.type === 'error')
    return

  await localGameStore.playSpecificTrack(value)
}
</script>

<template>
  <div class="flex flex-col items-center gap-2">
    <Button
      variant="ghost"
      size="sm"
      class="text-muted-foreground"
      @click="open = !open"
    >
      <KeyRound class="mr-1 size-4" />
      Play specific track
    </Button>
    <template v-if="open">
      <form
        class="flex w-full max-w-sm gap-2"
        @submit.prevent="handleSubmit"
      >
        <Input
          v-model="sourceId"
          placeholder="Paste sourceId..."
          class="flex-1"
        />
        <Button type="submit" size="sm" :disabled="!sourceId.trim() || status?.type === 'error'">
          Play
        </Button>
      </form>
      <p
        v-if="status"
        class="text-sm" :class="[
          status.type === 'error' ? 'text-destructive' : 'text-yellow-500',
        ]"
      >
        {{ status.message }}
      </p>
    </template>
  </div>
</template>
