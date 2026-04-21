<script setup lang="ts">
import type { RoundResult } from '@/db/schemas'
import { computed } from 'vue'
import { GuessLevelIcon } from '@/components/guessLevelIcon'
import { Badge } from '@/components/ui/badge'
import { useLinkPreview } from '@/composables/useLinkPreview'
import TrackDisplayWithCover from '@/pages/local/round/components/TrackDisplayWithCover.vue'

const props = defineProps<{
  round: RoundResult
}>()

const previewUrl = computed(() => props.round.previewImageUrl)
const { blobUrl: previewBlobUrl } = useLinkPreview(previewUrl)
</script>

<template>
  <div class="overflow-hidden rounded-lg border">
    <div class="flex items-stretch">
      <!-- Left: badges + track + teams -->
      <div class="flex min-w-0 flex-1 flex-col p-4">
        <div class="mb-2 flex flex-wrap items-center gap-2">
          <span class="text-sm font-semibold text-muted-foreground">Round {{ round.roundNumber }}</span>
          <Badge
            v-if="round.categoryName" variant="secondary" class="
              px-3 py-1 text-sm
            "
          >
            {{ round.categoryName }}{{ round.categoryPoints ? ` · ${round.categoryPoints}pts` : '' }}
          </Badge>
        </div>
        <TrackDisplayWithCover
          :image-url="round.albumImageUrl"
          :title="round.trackName"
          :artists="round.trackArtists"
        />
        <div
          class="
            mt-3 -ml-4 grid grid-flow-col grid-rows-4 gap-x-6 gap-y-2 pt-3 pl-4
          "
        >
          <div
            v-for="ts in round.teamScores"
            :key="ts.teamId"
            class="flex min-w-0 items-center gap-2"
          >
            <GuessLevelIcon
              v-if="ts.result !== 'none' || ts.teamId === round.currentTeamId"
              :guess-level="ts.result"
              class="size-10 shrink-0"
            />
            <span v-else class="size-10 shrink-0" />
            <span
              class="truncate text-4xl font-medium"
              :class="ts.teamId === round.currentTeamId ? 'text-foreground' : `
                text-muted-foreground
              `"
            >{{ ts.teamName }}</span>
            <span
              v-if="ts.points > 0 || ts.teamId === round.currentTeamId"
              class="shrink-0 text-4xl"
              :class="ts.points > 0 ? 'text-foreground' : `
                text-muted-foreground
              `"
            >{{ ts.points }} pts</span>
          </div>
        </div>
      </div>

      <!-- Right: preview image spanning full height, flush to card edges -->
      <img
        v-if="previewBlobUrl"
        :src="previewBlobUrl"
        alt="Preview"
        class="w-1/2 object-cover"
      >
    </div>
  </div>
</template>
