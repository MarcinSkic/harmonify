<script setup lang="ts">
import type { LocalGameTeam, Track } from '@/db/schemas'
import { computed, reactive } from 'vue'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { NumberField, NumberFieldContent, NumberFieldDecrement, NumberFieldIncrement, NumberFieldInput } from '@/components/ui/number-field'
import { useLinkPreview } from '@/composables/useLinkPreview'
import BaseDisplay from '@/pages/game/components/trackDisplay/BaseDisplay.vue'

const props = defineProps<{
  track: Track
  teams: LocalGameTeam[]
  category?: { displayName: string, points?: number }
}>()

const emit = defineEmits<{
  submit: [scores: Map<string, number>]
}>()

const { blobUrl: previewImageUrl } = useLinkPreview(computed(() => props.track.previewImageUrl))

const scores = reactive<Record<string, number>>(
  Object.fromEntries(props.teams.map(t => [t.id, 0])),
)

function buildScoresMap(): Map<string, number> {
  return new Map(Object.entries(scores))
}

function handleNextRound() {
  emit('submit', buildScoresMap())
}
</script>

<template>
  <div class="grid place-items-center gap-6">
    <div class="grid justify-items-center gap-2 text-center">
      <div
        v-if="category" class="flex flex-wrap items-center justify-center gap-2"
      >
        <Badge variant="secondary" class="text-sm">
          {{ category.displayName }}
        </Badge>
        <Badge
          v-if="category.points !== undefined" variant="outline" class="text-sm"
        >
          {{ category.points }} pts
        </Badge>
      </div>
      <div class="flex items-center justify-center gap-3">
        <img
          v-if="track.albumImageUrl"
          :src="track.albumImageUrl"
          alt="Album cover"
          width="200"
          height="200"
          class="rounded-md"
        >
        <img
          v-if="previewImageUrl"
          :src="previewImageUrl"
          alt="Link preview"
          class="aspect-1200/630 max-w-md rounded-md object-cover"
        >
      </div>
      <BaseDisplay
        :title="track.name"
        :author="track.artists.join(', ')"
        :album="track.albumName"
      />
    </div>

    <div class="w-full max-w-sm space-y-3">
      <div
        v-for="team in teams" :key="team.id"
        class="flex items-center gap-3"
      >
        <Label class="min-w-20 shrink-0 text-base">{{ team.name }}</Label>
        <NumberField
          v-model:model-value="scores[team.id]"
          class="flex flex-1 items-stretch gap-0"
          :min="0"
        >
          <NumberFieldContent>
            <NumberFieldDecrement />
            <NumberFieldInput :data-testid="`team-score-${team.name}`" />
            <NumberFieldIncrement />
          </NumberFieldContent>
        </NumberField>
      </div>
    </div>

    <Button
      type="button"
      @click="handleNextRound"
    >
      Next round
    </Button>
  </div>
</template>
