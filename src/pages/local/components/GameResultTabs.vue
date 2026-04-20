<script setup lang="ts">
import type { RoundResult } from '@/db/schemas'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import RoundBreakdown from './RoundBreakdown.vue'

defineProps<{
  teams: { id: string, name: string, score: number }[]
  rounds: RoundResult[]
}>()
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
          <TableRow v-for="(team, index) in teams" :key="team.id">
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

    <TabsContent
      value="rounds" class="mt-4 min-h-0"
    >
      <RoundBreakdown :rounds="rounds" />
    </TabsContent>
  </Tabs>
</template>
