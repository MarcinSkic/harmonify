<script setup lang="ts">
import type { LocalGameTeam, Track } from '@/db/schemas'
import { reactive } from 'vue'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { NumberField, NumberFieldContent, NumberFieldDecrement, NumberFieldIncrement, NumberFieldInput } from '@/components/ui/number-field'
import BaseDisplay from '@/pages/game/components/trackDisplay/BaseDisplay.vue'

const props = defineProps<{
  track: Track
  teams: LocalGameTeam[]
  hideScores: boolean
  canAdvanceRound: boolean
  category?: string
}>()

const emit = defineEmits<{
  submit: [scores: Map<string, number>]
  finish: [scores: Map<string, number>]
}>()

const scores = reactive<Record<string, number>>(
  Object.fromEntries(props.teams.map(t => [t.id, 0])),
)

function buildScoresMap(): Map<string, number> {
  return new Map(Object.entries(scores))
}

function handleNextRound() {
  emit('submit', buildScoresMap())
}

function handleFinishGame() {
  emit('finish', buildScoresMap())
}
</script>

<template>
  <div class="grid place-items-center gap-6">
    <div class="grid justify-items-center gap-2 text-center">
      <Badge v-if="category" variant="secondary" class="text-sm">
        {{ category }}
      </Badge>
      <img
        v-if="track.albumImageUrl"
        :src="track.albumImageUrl"
        alt="Album cover"
        width="200"
        height="200"
        class="rounded-md"
      >
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
        <span
          v-if="!hideScores" class="
            min-w-12 text-right text-sm text-muted-foreground
          "
        >
          {{ team.score }} pts
        </span>
      </div>
    </div>

    <div class="flex gap-3">
      <Button
        v-if="canAdvanceRound"
        type="button"
        @click="handleNextRound"
      >
        Next round
      </Button>
      <Button
        type="button"
        :variant="canAdvanceRound ? 'outline' : 'default'"
        @click="handleFinishGame"
      >
        Finish game
      </Button>
    </div>
  </div>
</template>
