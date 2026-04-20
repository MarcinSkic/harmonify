<script setup lang="ts">
import type { GameResult } from '@/db/schemas'
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Button } from '@/components/ui/button'
import GameResultTabs from '@/pages/local/components/GameResultTabs.vue'
import { useLocalGameStore } from '@/pages/local/stores'

const router = useRouter()
const localGameStore = useLocalGameStore()
const result = ref<GameResult | null>(null)

const teams = computed(() =>
  result.value
    ? [...result.value.teams]
        .sort((a, b) => b.totalScore - a.totalScore)
        .map(t => ({ id: t.id, name: t.name, score: t.totalScore }))
    : [],
)

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

onMounted(async () => {
  const id = router.currentRoute.value.params.id as string
  const all = await localGameStore.findAllGameResults()
  result.value = all.find(r => r.id === id) ?? null
  if (!result.value)
    router.push({ name: 'results' })
})
</script>

<template>
  <div
    v-if="result"
    class="
      grid h-screen grid-rows-[auto_1fr_auto] gap-4 p-4
      md:p-8
    "
  >
    <div class="flex items-center gap-4">
      <Button variant="ghost" size="sm" @click="router.push({ name: 'results' })">
        ← Back
      </Button>
      <h1
        class="
          text-xl font-bold
          lg:text-2xl
        "
      >
        {{ formatDate(result.finishedAt) }}
      </h1>
      <span class="text-sm text-muted-foreground">
        {{ result.gameMode }} · {{ result.rounds.length }} rounds
      </span>
    </div>

    <GameResultTabs :teams="teams" :rounds="result.rounds" />

    <div class="flex justify-center gap-3">
      <Button variant="outline" @click="localGameStore.exportGameResult(result!)">
        Export JSON
      </Button>
      <Button variant="outline" @click="router.push({ name: 'results' })">
        Back to history
      </Button>
    </div>
  </div>
</template>
