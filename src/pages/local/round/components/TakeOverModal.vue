<script setup lang="ts">
import type { LocalGameTeam } from '@/db/schemas'
import { computed, nextTick, ref, useTemplateRef, watch } from 'vue'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import TeamWheel from './TeamWheel.vue'

const props = defineProps<{
  open: boolean
  teams: LocalGameTeam[]
  currentTeamId: string | undefined
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  'showAnswer': []
}>()

const wheelRef = useTemplateRef<InstanceType<typeof TeamWheel>>('wheelRef')

const selectedIds = ref<string[]>([])
const winnerId = ref<string | null>(null)
const isSpinning = ref(false)

const enabledTeams = computed(() => props.teams.filter(t => !t.disabled))

const participants = computed(() =>
  selectedIds.value
    .map(id => props.teams.find(t => t.id === id))
    .filter((t): t is LocalGameTeam => t != null)
    .map(t => ({ id: t.id, name: t.name })),
)

const canSpin = computed(() => participants.value.length >= 2 && !isSpinning.value)
const winnerName = computed(() => props.teams.find(t => t.id === winnerId.value)?.name)

watch(() => props.open, (isOpen) => {
  if (isOpen) {
    selectedIds.value = []
    winnerId.value = null
    isSpinning.value = false
  }
})

function toggleTeam(id: string) {
  if (isSpinning.value)
    return
  const idx = selectedIds.value.indexOf(id)
  if (idx === -1)
    selectedIds.value = [...selectedIds.value, id]
  else
    selectedIds.value = selectedIds.value.filter(t => t !== id)
  // A shown winner is stale once the pool changes.
  winnerId.value = null
}

function handleSpin() {
  winnerId.value = null
  wheelRef.value?.spin()
}

async function removeWinnerAndRespin() {
  if (!winnerId.value)
    return
  selectedIds.value = selectedIds.value.filter(t => t !== winnerId.value)
  winnerId.value = null
  await nextTick()
  if (participants.value.length >= 2)
    wheelRef.value?.spin()
}

function onSpinStart() {
  isSpinning.value = true
  winnerId.value = null
}

function onSpinEnd(id: string) {
  isSpinning.value = false
  winnerId.value = id
}
</script>

<template>
  <Dialog :open="open" @update:open="emit('update:open', $event)">
    <DialogContent class="max-w-[min(92vw,48rem)] gap-6">
      <DialogHeader>
        <DialogTitle class="text-2xl">
          Take over
        </DialogTitle>
        <DialogDescription class="text-base">
          Select teams to pick which one can answer
        </DialogDescription>
      </DialogHeader>

      <!-- Team selection -->
      <div class="flex flex-wrap justify-center gap-2">
        <button
          v-for="team in enabledTeams"
          :key="team.id"
          type="button"
          :disabled="isSpinning"
          :class="cn(
            `
              flex items-center rounded-md border px-4 py-2 text-base
              font-medium transition
            `,
            selectedIds.includes(team.id)
              ? `
                scale-105 border-primary bg-primary text-primary-foreground
                shadow-sm
              `
              : `
                border-border bg-secondary text-secondary-foreground
                hover:border-primary hover:bg-primary/20
              `,
            // Current team normally sits out the draw — dim it but keep it selectable.
            team.id === currentTeamId && !selectedIds.includes(team.id) ? `
              opacity-40
            ` : '',
            isSpinning ? 'cursor-not-allowed opacity-60' : 'cursor-pointer',
          )"
          @click="toggleTeam(team.id)"
        >
          <span class="max-w-40 truncate">{{ team.name }}</span>
        </button>
      </div>

      <!-- Wheel -->
      <div class="flex flex-col items-center gap-4">
        <TeamWheel
          ref="wheelRef"
          class="w-full max-w-md"
          :participants="participants"
          :winner-id="winnerId"
          @spin-start="onSpinStart"
          @spin-end="onSpinEnd"
        />

        <p
          v-if="winnerName"
          class="text-center text-2xl font-semibold text-primary"
        >
          🎉 {{ winnerName }} takes over!
        </p>
        <p
          v-else-if="participants.length < 2"
          class="text-center text-base text-muted-foreground"
        >
          Select at least 2 teams
        </p>
      </div>

      <!-- Controls -->
      <div class="flex flex-col gap-2">
        <Button
          v-if="winnerId"
          type="button"
          size="lg"
          :disabled="isSpinning"
          @click="removeWinnerAndRespin"
        >
          Remove {{ winnerName }} and spin again
        </Button>
        <Button
          v-else
          type="button"
          size="lg"
          :disabled="!canSpin"
          @click="handleSpin"
        >
          Spin
        </Button>

        <Button
          type="button"
          variant="secondary"
          size="lg"
          :disabled="isSpinning"
          @click="emit('showAnswer')"
        >
          Show answer
        </Button>
      </div>
    </DialogContent>
  </Dialog>
</template>
