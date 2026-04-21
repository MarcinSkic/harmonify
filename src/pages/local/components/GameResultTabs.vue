<script setup lang="ts">
import type { RoundResult } from '@/db/schemas'
import { useWindowSize } from '@vueuse/core'
import { computed } from 'vue'
import TeamScoreItem from '@/components/TeamScoreItem.vue'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Breakpoint } from '@/consts'
import RoundBreakdown from './RoundBreakdown.vue'

const props = defineProps<{
  teams: { id: string, name: string, score: number }[]
  rounds: RoundResult[]
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
          mx-auto grid w-full max-w-md justify-center gap-3
          lg:max-w-2xl lg:gap-4
          xl:max-w-4xl
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
    </TabsContent>

    <TabsContent
      value="rounds" class="mt-4 min-h-0"
    >
      <RoundBreakdown :rounds="rounds" />
    </TabsContent>
  </Tabs>
</template>
