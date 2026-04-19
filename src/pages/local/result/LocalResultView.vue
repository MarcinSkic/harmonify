<script setup lang="ts">
import { Check, Minus } from '@lucide/vue'
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useLocalGameStore } from '@/pages/local/stores'

const router = useRouter()
const localGameStore = useLocalGameStore()

onMounted(async () => {
  if (!localGameStore.game) {
    const gameId = router.currentRoute.value.params.id as string
    const restored = await localGameStore.resumeGame(gameId)
    if (!restored) {
      router.push({ name: 'localSetup' })
    }
  }
})

function handleNewGame() {
  router.push({ name: 'localSetup' })
}

function handleBackToMenu() {
  router.push({ name: 'home' })
}
</script>

<template>
  <div
    v-if="localGameStore.game"
    class="
      grid place-content-center gap-8 p-4
      md:p-8
    "
  >
    <h1
      class="
        text-center text-3xl font-bold
        lg:text-5xl
      "
    >
      Game Over
    </h1>

    <Tabs
      default-value="results"
      class="
        mx-auto w-full max-w-lg
        lg:max-w-2xl
      "
    >
      <TabsList class="w-full">
        <TabsTrigger value="results" class="flex-1">
          Results
        </TabsTrigger>
        <TabsTrigger
          value="rounds"
          class="flex-1"
          :disabled="localGameStore.game.rounds.length === 0"
        >
          Rounds
        </TabsTrigger>
      </TabsList>

      <!-- Team results table -->
      <TabsContent value="results">
        <Table>
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
            <TableRow v-for="(team, index) in localGameStore.sortedTeams" :key="team.id">
              <TableCell class="font-medium">
                {{ index + 1 }}
              </TableCell>
              <TableCell>{{ team.name }}</TableCell>
              <TableCell class="text-right font-semibold">
                {{ team.score }}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </TabsContent>

      <!-- Round breakdown -->
      <TabsContent value="rounds">
        <ScrollArea class="max-h-96">
          <div class="space-y-2 pr-3">
            <div
              v-for="round in localGameStore.game.rounds"
              :key="round.roundNumber"
              class="rounded-lg border p-3"
            >
              <div class="mb-1.5 flex items-baseline gap-2">
                <span class="text-xs font-semibold text-muted-foreground">Round {{ round.roundNumber }}</span>
                <span class="truncate text-sm font-medium">{{ round.trackName }}</span>
                <span class="shrink-0 text-xs text-muted-foreground">· {{ round.trackArtists.join(', ') }}</span>
                <span
                  v-if="round.categoryName"
                  class="
                    ml-auto shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs
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
                    v-if="ts.result === 'guessed'" class="size-3 text-green-500"
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

    <!-- Actions -->
    <div class="flex justify-center gap-3">
      <Button @click="handleNewGame">
        New game
      </Button>
      <Button variant="outline" @click="handleBackToMenu">
        Back to menu
      </Button>
    </div>
  </div>
</template>
