<script setup lang="ts">
import type { RoundResult } from '@/db/schemas'
import { ScrollArea } from '@/components/ui/scroll-area'
import RoundBreakdownItem from './RoundBreakdownItem.vue'

defineProps<{
  rounds: RoundResult[]
}>()
</script>

<template>
  <ScrollArea class="h-full">
    <div class="space-y-4 pr-3">
      <RoundBreakdownItem
        v-for="round in rounds"
        :key="round.roundNumber"
        :round="round"
      />
    </div>
  </ScrollArea>
</template>
