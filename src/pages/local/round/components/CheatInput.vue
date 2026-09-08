<script setup lang="ts">
import { KeyRound } from '@lucide/vue'
import { watchDebounced } from '@vueuse/core'
import { computed, ref } from 'vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useLocalGameStore } from '@/pages/local/stores'

const localGameStore = useLocalGameStore()

// A short title fragment can match most of the pool; showing all of it would bury the round view.
const MAX_SHOWN_CANDIDATES = 8

const open = ref(false)
const query = ref('')
const status = ref<
  | { type: 'error', message: string }
  | { type: 'warning', message: string }
  | { type: 'ambiguous', candidates: string[] }
  | null
>(null)

watchDebounced(query, (value) => {
  const trimmed = value.trim()
  if (!trimmed) {
    status.value = null
    return
  }

  const result = localGameStore.checkCheatQuery(trimmed)
  if (typeof result === 'object')
    status.value = { type: 'ambiguous', candidates: result.candidates }
  else if (result === 'not-found')
    status.value = { type: 'error', message: `No track matches: ${trimmed}` }
  else if (result === 'already-played')
    status.value = { type: 'warning', message: 'This track was already played' }
  else
    status.value = null
}, { debounce: 300 })

const candidates = computed(() =>
  status.value?.type === 'ambiguous' ? status.value.candidates : [],
)
const shownCandidates = computed(() => candidates.value.slice(0, MAX_SHOWN_CANDIDATES))
const hiddenCandidateCount = computed(() => candidates.value.length - shownCandidates.value.length)

async function handleSubmit() {
  const value = query.value.trim()
  if (!value || status.value?.type === 'error' || status.value?.type === 'ambiguous')
    return

  const result = await localGameStore.playSpecificTrack(value)
  if (typeof result === 'object')
    status.value = { type: 'ambiguous', candidates: result.candidates }
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
          v-model="query"
          placeholder="Song id, MusicBrainz id or part of a title..."
          class="flex-1"
        />
        <Button type="submit" size="sm" :disabled="!query.trim() || status?.type === 'error' || status?.type === 'ambiguous'">
          Play
        </Button>
      </form>
      <p
        v-if="status?.type === 'error' || status?.type === 'warning'"
        class="text-sm" :class="[
          status.type === 'error' ? 'text-destructive' : 'text-yellow-500',
        ]"
      >
        {{ status.message }}
      </p>
      <div
        v-else-if="status?.type === 'ambiguous'"
        class="text-sm text-yellow-500"
      >
        <p>Several tracks match — narrow the search:</p>
        <p v-for="(candidate, index) of shownCandidates" :key="index">
          {{ candidate }}
        </p>
        <p v-if="hiddenCandidateCount > 0">
          ...and {{ hiddenCandidateCount }} more
        </p>
      </div>
    </template>
  </div>
</template>
