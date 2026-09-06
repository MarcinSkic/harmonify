<script setup lang="ts">
import type { CoverageReport } from '@/lib/categoryCoverage'
import { TriangleAlert } from '@lucide/vue'
import PointsDisplay from '@/components/PointsDisplay.vue'
import { Badge } from '@/components/ui/badge'

defineProps<{
  /** `null` until a category set with at least one category is picked. */
  report: CoverageReport | null
  /** Navidrome answered for the songs but not for their tags — every category will come out empty. */
  tagsUnavailable: boolean
}>()
</script>

<template>
  <div class="flex w-full flex-col gap-2 rounded-md border p-3">
    <p
      v-if="tagsUnavailable"
      class="flex items-start gap-1.5 text-sm text-destructive"
    >
      <TriangleAlert class="mt-0.5 size-4 shrink-0" />
      Could not fetch tags from Navidrome — categories will stay empty.
    </p>

    <p v-if="!report" class="text-sm text-muted-foreground">
      Pick a category set to see how many tracks qualify.
    </p>

    <template v-else>
      <ul class="flex flex-col gap-1.5">
        <li
          v-for="row in report.perCategory"
          :key="row.categoryId"
          class="flex items-center gap-2"
        >
          <span class="min-w-0 flex-1 truncate text-sm">{{ row.displayName }}</span>
          <Badge v-if="row.points !== undefined" variant="secondary">
            <PointsDisplay :points="row.points" icon-class="size-3" />
          </Badge>
          <span
            class="text-base font-bold tabular-nums"
            :class="row.tooFewForRounds ? 'text-destructive' : ''"
          >
            {{ row.count }}
          </span>
          <span class="w-12 shrink-0 text-xs text-muted-foreground">
            {{ row.count === 1 ? 'track' : 'tracks' }}
          </span>
        </li>
      </ul>

      <p
        v-if="report.perCategory.some(row => row.tooFewForRounds)"
        class="flex items-start gap-1.5 text-xs text-destructive"
      >
        <TriangleAlert class="mt-0.5 size-3.5 shrink-0" />
        Highlighted categories hold fewer tracks than the planned number of rounds.
      </p>

      <div class="text-xs text-muted-foreground">
        <p>{{ report.matchedByNone }} of {{ report.total }} tracks match no category</p>
        <p>{{ report.matchedByMultiple }} match more than one</p>
      </div>
    </template>
  </div>
</template>
