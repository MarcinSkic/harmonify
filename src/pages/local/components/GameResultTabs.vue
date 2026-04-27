<script setup lang="ts">
import type { RoundResult } from '@/db/schemas'
import { ImageOff } from '@lucide/vue'
import { useWindowSize } from '@vueuse/core'
import { computed } from 'vue'
import TeamScoreItem from '@/components/TeamScoreItem.vue'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Breakpoint } from '@/consts'
import RoundBreakdown from './RoundBreakdown.vue'

const props = defineProps<{
  teams: { id: string, name: string, score: number }[]
  rounds: RoundResult[]
  playlists: { id: string, name: string, imageUrl?: string }[]
}>()

const { width: screenWidth } = useWindowSize()
const maxBarWidth = computed(() => screenWidth.value >= Breakpoint.LG ? 500 : 200)

const teamsWithWidth = computed(() => {
  const bestScore = props.teams[0]?.score ?? 0
  return props.teams.map(team => ({
    ...team,
    width: bestScore === 0 ? 0 : (team.score / bestScore) * maxBarWidth.value,
  }))
})
</script>

<template>
  <Tabs
    default-value="results" class="
      grid min-h-0 grid-cols-[80%] grid-rows-[auto_1fr] justify-center
    "
  >
    <TabsList class="w-80 justify-self-center">
      <TabsTrigger value="results" class="flex-1">
        Results
      </TabsTrigger>
      <TabsTrigger value="rounds" class="flex-1" :disabled="rounds.length === 0">
        Rounds
      </TabsTrigger>
    </TabsList>

    <TabsContent value="results" class="mt-4 overflow-auto">
      <div
        class="
          grid justify-center
          lg:grid-cols-[42rem]
          xl:grid-cols-[56rem]
        "
      >
        <div
          class="
            grid w-full max-w-md justify-center gap-3 justify-self-center
            lg:gap-4
          "
        >
          <TeamScoreItem
            v-for="team in teamsWithWidth"
            :key="team.id"
            :name="team.name"
            :score="team.score"
            :width="team.width"
            :large="true"
            :multiple-users="true"
          />
        </div>
        <h1 class="mt-8 text-xl font-bold">
          Playlists
        </h1>
        <div
          v-if="playlists.length > 0"
          class="
            mt-6 grid w-full max-w-md
            grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-6
          "
        >
          <div
            v-for="playlist in playlists"
            :key="playlist.id"
            class="flex flex-col items-center gap-1 text-center"
          >
            <div class="aspect-square w-full overflow-hidden rounded-md">
              <img
                v-if="playlist.imageUrl"
                :src="playlist.imageUrl"
                :alt="playlist.name"
                class="size-full object-contain"
              >
              <div v-else class="grid size-full place-items-center bg-muted">
                <ImageOff class="size-8 text-muted-foreground" />
              </div>
            </div>
            <span class="text-sm font-semibold">{{ playlist.name }}</span>
          </div>
        </div>
      </div>
    </TabsContent>

    <TabsContent
      value="rounds" class="mt-4 min-h-0"
    >
      <RoundBreakdown :rounds="rounds" />
    </TabsContent>
  </Tabs>
</template>
