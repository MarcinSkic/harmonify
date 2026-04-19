<script setup lang="ts">
import type { GameResult } from '@/db/schemas'
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import RoundBreakdown from '@/pages/local/components/RoundBreakdown.vue'
import { useLocalGameStore } from '@/pages/local/stores'

const router = useRouter()
const localGameStore = useLocalGameStore()
const result = ref<GameResult | null>(null)

onMounted(async () => {
  const id = router.currentRoute.value.params.id as string
  const all = await localGameStore.findAllGameResults()
  result.value = all.find(r => r.id === id) ?? null
  if (!result.value)
    router.push({ name: 'results' })
})

function sortedTeams() {
  return result.value ? [...result.value.teams].sort((a, b) => b.totalScore - a.totalScore) : []
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
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

    <Tabs default-value="results" class="grid min-h-0 grid-rows-[auto_1fr]">
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

      <TabsContent value="results" class="mt-4 overflow-auto">
        <Table class="mx-auto max-w-2xl">
          <TableHeader>
            <TableRow>
              <TableHead class="w-12">
                #
              </TableHead>
              <TableHead>Team</TableHead>
              <TableHead class="text-right">
                Score
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-for="(team, index) in sortedTeams()" :key="team.id">
              <TableCell class="font-medium">
                {{ index + 1 }}
              </TableCell>
              <TableCell>{{ team.name }}</TableCell>
              <TableCell class="text-right font-semibold">
                {{ team.totalScore }}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </TabsContent>

      <TabsContent value="rounds" class="mt-4 min-h-0">
        <RoundBreakdown :rounds="result.rounds" />
      </TabsContent>
    </Tabs>

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
