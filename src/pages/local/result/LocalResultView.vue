<script setup lang="ts">
import type { Track } from '@/db/schemas'
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { db } from '@/db'
import BaseDisplay from '@/pages/game/components/trackDisplay/BaseDisplay.vue'
import { useLocalGameStore } from '@/pages/local/stores'

const router = useRouter()
const localGameStore = useLocalGameStore()
const playedTracks = ref<Track[]>([])

onMounted(async () => {
  if (!localGameStore.game) {
    const gameId = router.currentRoute.value.params.id as string
    const restored = await localGameStore.resumeGame(gameId)
    if (!restored) {
      router.push({ name: 'localSetup' })
      return
    }
  }

  if (localGameStore.game) {
    const tracks = await db.tracks.bulkGet(localGameStore.game.trackPoolState.playedTrackIds)
    playedTracks.value = tracks.filter((t): t is Track => t !== undefined)
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
    v-if="localGameStore.game" class="
      grid place-content-center gap-8 p-4
      md:p-8
    "
  >
    <h1 class="text-center text-3xl font-bold">
      Game Over
    </h1>

    <!-- Team ranking -->
    <div class="mx-auto w-full max-w-lg">
      <h2 class="mb-3 text-xl font-semibold">
        Results
      </h2>
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
    </div>

    <!-- Played tracks -->
    <div v-if="playedTracks.length > 0" class="mx-auto w-full max-w-lg">
      <h2 class="mb-3 text-xl font-semibold">
        Played tracks
      </h2>
      <ScrollArea class="max-h-60 rounded-lg border p-3">
        <div class="space-y-2">
          <div
            v-for="(track, index) in playedTracks" :key="track.id"
            class="flex items-center gap-3"
          >
            <span class="w-6 text-right text-sm text-muted-foreground">{{ index + 1 }}.</span>
            <img
              v-if="track.albumImageUrl"
              :src="track.albumImageUrl"
              alt=""
              class="size-8 rounded-sm"
            >
            <BaseDisplay
              :title="track.name"
              :author="track.artists.join(', ')"
              :album="track.albumName"
            />
          </div>
        </div>
      </ScrollArea>
    </div>

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
