<script setup lang="ts">
import type { LocalGameSettings, LocalGameTeam, Track } from '@/db/schemas'
import { computed, reactive } from 'vue'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { NumberField, NumberFieldContent, NumberFieldDecrement, NumberFieldIncrement, NumberFieldInput } from '@/components/ui/number-field'
import { useLinkPreview } from '@/composables/useLinkPreview'
import TrackDisplayWithCover from './TrackDisplayWithCover.vue'

const props = defineProps<{
  track: Track
  teams: LocalGameTeam[]
  currentTeamId: string | undefined
  category?: { displayName: string, points?: number }
  settings: LocalGameSettings
}>()

const emit = defineEmits<{
  submit: [scores: Map<string, number>]
}>()
const categoryPoints = computed(() => props.category?.points)
const halfPoints = computed(() => categoryPoints.value !== undefined ? Math.round(categoryPoints.value / 2) : undefined)
const fullPlusArtistPoints = computed(() => categoryPoints.value !== undefined ? categoryPoints.value + props.settings.partialPoints : undefined)

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
        <Badge variant="secondary" class="text-base">
          {{ category.displayName }}
        </Badge>
        <Badge
          v-if="category.points !== undefined" variant="outline" class="
            text-base
          "
        >
          {{ category.points }} pts
        </Badge>
      </div>
    </div>

    <div
      class="
        flex flex-wrap items-start justify-center gap-8
        lg:gap-12
      "
    >
      <div
        class="
          flex max-w-xs flex-col items-center gap-4
          lg:max-w-300
        "
      >
        <img
          v-if="previewImageUrl"
          :src="previewImageUrl"
          alt="Link preview"
          class="
            max-h-100 max-w-full rounded-md object-cover
            lg:max-h-170
          "
        >
        <TrackDisplayWithCover
          :image-url="track.albumImageUrl"
          :title="track.name"
          :artists="track.artists"
        />
      </div>

      <div class="flex flex-col items-center gap-4">
        <div
          class="
            flex max-h-[calc(100dvh-14rem)] flex-col flex-wrap content-start
            gap-6
          "
        >
          <div
            v-for="team in teams" :key="team.id"
            class="flex flex-col items-center gap-2 rounded-md p-2 transition"
            :class="[
              team.id === currentTeamId ? 'ring-2 ring-primary' : '',
              team.disabled ? 'opacity-50' : '',
            ]"
          >
            <Label class="max-w-40 truncate text-base">{{ team.name }}</Label>
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
                v-if="team.id === currentTeamId"
                type="button" variant="outline" size="sm"
                class="text-green-500"
                @click="scores[team.id] = categoryPoints!"
              >
                Full
              </Button>
              <Button
                v-if="team.id === currentTeamId"
                type="button" variant="outline" size="sm"
                class="text-green-600"
                @click="scores[team.id] = fullPlusArtistPoints!"
              >
                Full+Artist
              </Button>
              <Button
                v-if="team.id !== currentTeamId"
                type="button" variant="outline" size="sm"
                class="text-amber-400"
                @click="scores[team.id] = halfPoints!"
              >
                Half
              </Button>
              <Button
                type="button" variant="outline" size="sm"
                class="text-yellow-500"
                @click="scores[team.id] = settings.partialPoints"
              >
                Artist
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
  </div>
</template>
