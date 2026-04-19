<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import RoundBreakdown from '@/pages/local/components/RoundBreakdown.vue'
import { useLocalGameStore } from '@/pages/local/stores'

const router = useRouter()
const localGameStore = useLocalGameStore()

onMounted(async () => {
  if (!localGameStore.game) {
    const gameId = router.currentRoute.value.params.id as string
    const restored = await localGameStore.resumeGame(gameId)
    if (!restored)
      router.push({ name: 'localSetup' })
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
      grid h-full grid-rows-[auto_1fr_auto] gap-4 p-4
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

    <Tabs default-value="results" class="grid min-h-0 grid-rows-[auto_1fr]">
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

      <TabsContent value="rounds" class="mt-4 min-h-0">
        <RoundBreakdown :rounds="localGameStore.game.rounds" />
      </TabsContent>
    </Tabs>

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
