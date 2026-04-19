<script setup lang="ts">
import type { RoundResult } from '@/db/schemas'
import { Check, Minus } from '@lucide/vue'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import TrackDisplayWithCover from '@/pages/local/round/components/TrackDisplayWithCover.vue'

defineProps<{
  rounds: RoundResult[]
}>()
</script>

<template>
  <ScrollArea class="h-full">
    <div class="space-y-4 pr-3">
      <div
        v-for="round in rounds"
        :key="round.roundNumber"
        class="rounded-lg border p-4"
      >
        <div class="mb-3 flex flex-wrap items-center gap-2">
          <span class="text-sm font-semibold text-muted-foreground">Round {{ round.roundNumber }}</span>
          <Badge v-if="round.categoryName" variant="secondary">
            {{ round.categoryName }}{{ round.categoryPoints ? ` · ${round.categoryPoints}pts` : '' }}
          </Badge>
          <Badge v-if="round.currentTeamName" variant="outline" class="ml-auto">
            {{ round.currentTeamName }}'s turn
          </Badge>
        </div>

        <TrackDisplayWithCover
          :image-url="round.albumImageUrl"
          :title="round.trackName"
          :artists="round.trackArtists"
        />

        <div class="mt-3 flex flex-wrap gap-x-6 gap-y-1.5 border-t pt-3">
          <div
            v-for="ts in round.teamScores"
            :key="ts.teamId"
            class="flex items-center gap-1.5 text-sm"
          >
            <Check
              v-if="ts.result === 'guessed'" class="
                size-3.5 shrink-0 text-green-500
              "
            />
            <Minus
              v-else-if="ts.result === 'partial'" class="
                size-3.5 shrink-0 text-yellow-500
              "
            />
            <span
              class="font-medium"
              :class="ts.result === 'missed' ? 'text-muted-foreground' : ''"
            >{{ ts.teamName }}</span>
            <span class="text-muted-foreground">{{ ts.points }} pts</span>
          </div>
        </div>
      </div>
    </div>
  </ScrollArea>
</template>
