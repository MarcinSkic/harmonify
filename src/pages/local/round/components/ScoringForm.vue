<script setup lang="ts">
import type { LocalGameSettings, LocalGameTeam, Track } from '@/db/schemas'
import { computed, reactive } from 'vue'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { NumberField, NumberFieldContent, NumberFieldDecrement, NumberFieldIncrement, NumberFieldInput } from '@/components/ui/number-field'
import { useLinkPreview } from '@/composables/useLinkPreview'

const props = defineProps<{
  track: Track
  teams: LocalGameTeam[]
  category?: { displayName: string, points?: number }
  settings: LocalGameSettings
}>()

const emit = defineEmits<{
  submit: [scores: Map<string, number>]
}>()
const categoryPoints = computed(() => props.category?.points)
const halfPoints = computed(() => categoryPoints.value !== undefined ? Math.round(categoryPoints.value / 2) : undefined)

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
    </div>

    <div class="flex w-full flex-wrap items-center justify-center gap-6">
      <img
        v-if="previewImageUrl"
        :src="previewImageUrl"
        alt="Link preview"
        class="
          max-h-100 max-w-xs rounded-md object-cover
          lg:max-h-170 lg:max-w-300
        "
      >
      <div class="flex flex-col items-center gap-4">
        <div class="flex flex-wrap justify-center gap-6">
          <div
            v-for="team in teams" :key="team.id"
            class="flex flex-col items-center gap-2"
          >
            <Label class="text-base">{{ team.name }}</Label>
            <NumberField
              v-model:model-value="scores[team.id]"
              class="flex items-stretch gap-0"
              :min="0"
            >
              <NumberFieldContent>
                <NumberFieldDecrement />
                <NumberFieldInput :data-testid="`team-score-${team.name}`" />
                <NumberFieldIncrement />
              </NumberFieldContent>
            </NumberField>
            <div
              v-if="categoryPoints !== undefined" class="
                flex flex-wrap justify-center gap-1
              "
            >
              <Button
                type="button" variant="outline" size="sm"
                @click="scores[team.id] = categoryPoints!"
              >
                Full
              </Button>
              <Button
                type="button" variant="outline" size="sm"
                @click="scores[team.id] = halfPoints!"
              >
                Half
              </Button>
              <Button
                type="button" variant="outline" size="sm"
                @click="scores[team.id] += settings.partialPoints"
              >
                Artist
              </Button>
              <Button
                type="button" variant="outline" size="sm"
                @click="scores[team.id] += settings.partialPoints"
              >
                Album
              </Button>
            </div>
          </div>
        </div>

        <Button
          type="button"
          @click="handleNextRound"
        >
          Next round
        </Button>
      </div>
    </div>

    <div class="flex w-full flex-wrap items-center justify-center gap-4">
      <img
        v-if="track.albumImageUrl"
        :src="track.albumImageUrl"
        alt="Album cover"
        class="
          aspect-square max-h-32 rounded-md object-cover
          lg:max-h-48
        "
      >
      <div
        class="
          flex flex-col gap-3
          lg:gap-5
        "
      >
        <span
          class="
            text-3xl font-semibold
            lg:text-6xl
          "
        >{{ track.name }}</span>
        <span
          class="
            text-2xl text-muted-foreground
            lg:text-4xl
          "
        >{{ track.artists.join(', ') }}</span>
      </div>
    </div>
  </div>
</template>
