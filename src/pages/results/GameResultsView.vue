<script setup lang="ts">
import type { GameResult } from '@/db/schemas'
import { Check, Download, Minus, Trash2, Upload } from '@lucide/vue'
import { onMounted, ref } from 'vue'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useLocalGameStore } from '@/pages/local/stores'

const localGameStore = useLocalGameStore()
const gameResults = ref<GameResult[]>([])
const expandedId = ref<string | null>(null)
const importInput = ref<HTMLInputElement | null>(null)

onMounted(async () => {
  gameResults.value = await localGameStore.findAllGameResults()
})

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function toggleExpand(id: string) {
  expandedId.value = expandedId.value === id ? null : id
}

async function handleDelete(result: GameResult) {
  await localGameStore.deleteGameResult(result.id)
  gameResults.value = gameResults.value.filter(r => r.id !== result.id)
  if (expandedId.value === result.id)
    expandedId.value = null
}

function handleExport(result: GameResult) {
  localGameStore.exportGameResult(result)
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
</script>

<template>
  <div
    class="
      mx-auto w-full max-w-2xl space-y-6 p-4
      md:p-8
    "
  >
    <div class="flex items-center justify-between">
      <h1 class="text-3xl font-bold">
        Game History
      </h1>
      <Button variant="outline" size="sm" @click="importInput?.click()">
        <Upload class="mr-2 size-4" />
        Import
      </Button>
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
        py-16 text-center text-muted-foreground
      "
    >
      No game history yet
    </div>

    <div v-else class="space-y-3">
      <div
        v-for="result in gameResults"
        :key="result.id"
        class="rounded-lg border"
      >
        <!-- Card header -->
        <div
          class="
            flex cursor-pointer items-center gap-3 px-4 py-3
            hover:bg-accent hover:text-accent-foreground
          "
          @click="toggleExpand(result.id)"
        >
          <div class="min-w-0 flex-1">
            <p class="text-sm font-medium">
              {{ formatDate(result.finishedAt) }}
            </p>
            <p class="text-xs text-muted-foreground">
              {{ result.teams.length }} {{ result.teams.length === 1 ? 'team' : 'teams' }}
              · {{ result.rounds.length }} rounds
              · {{ result.gameMode }}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            class="shrink-0"
            @click.stop="handleExport(result)"
          >
            <Download class="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            class="shrink-0"
            @click.stop="handleDelete(result)"
          >
            <Trash2 class="size-4" />
          </Button>
        </div>

        <!-- Expanded breakdown -->
        <div v-if="expandedId === result.id" class="border-t px-4 pt-3 pb-4">
          <Tabs default-value="results">
            <TabsList class="w-full">
              <TabsTrigger value="results" class="flex-1">
                Results
              </TabsTrigger>
              <TabsTrigger
                value="rounds"
                class="flex-1"
                :disabled="result.rounds.length === 0"
              >
                Rounds
              </TabsTrigger>
            </TabsList>

            <TabsContent value="results">
              <div class="space-y-1 pt-1">
                <div
                  v-for="(team, index) in [...result.teams].sort((a, b) => b.totalScore - a.totalScore)"
                  :key="team.id"
                  class="flex items-center gap-3 rounded-md px-2 py-1.5 text-sm"
                >
                  <span class="w-5 text-right text-xs text-muted-foreground">{{ index + 1 }}.</span>
                  <span class="flex-1 font-medium">{{ team.name }}</span>
                  <span class="font-semibold">{{ team.totalScore }} pts</span>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="rounds">
              <ScrollArea class="max-h-80">
                <div class="space-y-2 pt-1 pr-3">
                  <div
                    v-for="round in result.rounds"
                    :key="round.roundNumber"
                    class="rounded-lg border p-3"
                  >
                    <div
                      class="
                        mb-1.5 flex flex-wrap items-baseline gap-x-2 gap-y-1
                      "
                    >
                      <span class="text-xs font-semibold text-muted-foreground">Round {{ round.roundNumber }}</span>
                      <span class="truncate text-sm font-medium">{{ round.trackName }}</span>
                      <span class="text-xs text-muted-foreground">· {{ round.trackArtists.join(', ') }}</span>
                      <span
                        v-if="round.categoryName"
                        class="
                          ml-auto shrink-0 rounded-full bg-muted px-2 py-0.5
                          text-xs
                        "
                      >
                        {{ round.categoryName }}{{ round.categoryPoints ? ` · ${round.categoryPoints}pts` : '' }}
                      </span>
                    </div>
                    <div class="flex flex-wrap gap-x-4 gap-y-1">
                      <div
                        v-for="ts in round.teamScores"
                        :key="ts.teamId"
                        class="flex items-center gap-1 text-xs"
                      >
                        <Check
                          v-if="ts.result === 'guessed'" class="
                            size-3 text-green-500
                          "
                        />
                        <Minus
                          v-else-if="ts.result === 'partial'" class="
                            size-3 text-yellow-500
                          "
                        />
                        <span class="font-medium">{{ ts.teamName }}</span>
                        <span class="text-muted-foreground">{{ ts.points }} pts</span>
                      </div>
                    </div>
                  </div>
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  </div>
</template>
