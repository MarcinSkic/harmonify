<script setup lang="ts">
import type { GameResult } from '@/db/schemas'
import { Download, Upload } from '@lucide/vue'
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import GameListItem from '@/pages/local/components/GameListItem.vue'
import { useLocalGameStore } from '@/pages/local/stores'

const router = useRouter()
const localGameStore = useLocalGameStore()
const gameResults = ref<GameResult[]>([])
const importInput = ref<HTMLInputElement | null>(null)

onMounted(async () => {
  gameResults.value = await localGameStore.findAllGameResults()
})

async function handleDelete(result: GameResult) {
  await localGameStore.deleteGameResult(result.id)
  gameResults.value = gameResults.value.filter(r => r.id !== result.id)
}

async function handleImport(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file)
    return
  await localGameStore.importGameResult(file)
  gameResults.value = await localGameStore.findAllGameResults()
  if (importInput.value)
    importInput.value.value = ''
}

function handleExportAll() {
  const json = JSON.stringify(gameResults.value, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `harmonify-results-all-${Date.now()}.json`
  a.click()
  URL.revokeObjectURL(url)
}
</script>

<template>
  <div
    class="
      mx-auto w-full max-w-lg space-y-4 p-4
      md:p-8
    "
  >
    <div class="flex items-center gap-3">
      <h1 class="text-2xl font-bold">
        Game History
      </h1>
      <div class="ml-auto flex gap-2">
        <Button
          variant="outline"
          size="sm"
          :disabled="gameResults.length === 0"
          @click="handleExportAll"
        >
          <Download class="mr-2 size-4" />
          Export all
        </Button>
        <Button variant="outline" size="sm" @click="importInput?.click()">
          <Upload class="mr-2 size-4" />
          Import
        </Button>
      </div>
      <input
        ref="importInput"
        type="file"
        accept=".json"
        class="hidden"
        @change="handleImport"
      >
    </div>

    <div
      v-if="gameResults.length === 0" class="
        py-12 text-center text-muted-foreground
      "
    >
      No game history yet
    </div>

    <ScrollArea v-else class="max-h-[calc(100vh-8rem)]">
      <div class="space-y-2 pr-3">
        <GameListItem
          v-for="result in gameResults"
          :key="result.id"
          :date="result.finishedAt"
          :teams="result.teams.length"
          :info="`${result.rounds.length} rounds · ${result.gameMode}`"
          :show-export="true"
          @click="router.push({ name: 'resultDetail', params: { id: result.id } })"
          @delete="handleDelete(result)"
          @export="localGameStore.exportGameResult(result)"
        />
      </div>
    </ScrollArea>
  </div>
</template>
