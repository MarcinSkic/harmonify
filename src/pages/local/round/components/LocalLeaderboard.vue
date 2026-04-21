<script setup lang="ts">
import type { LocalGameTeam } from '@/db/schemas'
import type { GuessLevel } from '@/types'
import { useTimeout, useTimeoutFn, useWindowSize } from '@vueuse/core'
import { computed, ref } from 'vue'
import TeamScoreItem from '@/components/TeamScoreItem.vue'
import { Button } from '@/components/ui/button'
import { AnimationDuration, Breakpoint } from '@/consts'
import { useLocalGameStore } from '@/pages/local/stores/localGame'
import { useSettingsStore } from '@/stores'
import AddTeamInline from './AddTeamInline.vue'

const props = defineProps<{
  teams: LocalGameTeam[]
  previousTeams: LocalGameTeam[]
  duration: number
}>()

const emit = defineEmits<{
  continue: []
  addTeam: [name: string]
}>()

const isAutoAdvancing = ref(true)
const waitTime = computed(() => `${props.duration}s`)

const { stop } = useTimeoutFn(() => {
  emit('continue')
}, () => props.duration * 1000)

function stopAutoAdvance() {
  if (!isAutoAdvancing.value)
    return
  stop()
  isAutoAdvancing.value = false
}

const settingsStore = useSettingsStore()
const localGameStore = useLocalGameStore()
const showCurrentScore = useTimeout(AnimationDuration.D1000)

const { width: screenWidth } = useWindowSize()
const maxBarWidth = computed(() => screenWidth.value >= Breakpoint.LG ? 500 : 200)

const currentTeamId = computed(() => localGameStore.currentTeam?.id)

const teamRoundResults = computed(() =>
  new Map(localGameStore.lastRoundTeamScores.map(s => [s.teamId, s])),
)

function toGuessLevel(result: 'guessed' | 'partial' | 'missed'): GuessLevel {
  if (result === 'guessed')
    return 'full'
  if (result === 'partial')
    return 'album'
  return 'none'
}

const leaderboard = computed(() => {
  const source = showCurrentScore.value || !settingsStore.playAnimations
    ? props.teams
    : props.previousTeams

  const sorted = [...source].sort((a, b) => b.score - a.score)
  const bestScore = sorted[0]?.score ?? 0
  const canReveal = showCurrentScore.value || !settingsStore.playAnimations

  return sorted.map((team) => {
    const roundScore = teamRoundResults.value.get(team.id)
    const hasPoints = (roundScore?.points ?? 0) > 0
    const isCurrentTeam = team.id === currentTeamId.value

    return {
      ...team,
      targetWidth: bestScore === 0 ? 0 : (team.score / bestScore) * maxBarWidth.value,
      guessLevel: roundScore ? toGuessLevel(roundScore.result) : undefined,
      displayGuessLevel: canReveal && (hasPoints || isCurrentTeam),
    }
  })
})
</script>

<template>
  <div
    v-if="isAutoAdvancing"
    class="
      loading-indicator fixed top-0 left-0 h-1 w-screen origin-left bg-primary
      md:h-2
    "
  />
  <div
    v-if="isAutoAdvancing"
    class="fixed inset-0 z-10 cursor-pointer"
    @click="stopAutoAdvance"
  />
  <div class="grid place-items-center gap-6">
    <TransitionGroup
      name="results" tag="div" class="
        grid w-full max-w-md gap-3
        lg:max-w-2xl lg:gap-4
        xl:max-w-4xl
      "
    >
      <TeamScoreItem
        v-for="entry in leaderboard"
        :key="entry.id"
        :name="entry.name"
        :score="entry.score"
        :width="entry.targetWidth"
        :guess-level="entry.guessLevel"
        :display-guess-level="entry.displayGuessLevel"
        :large="true"
        :multiple-users="true"
      />
    </TransitionGroup>

    <AddTeamInline @add="emit('addTeam', $event)" />

    <Button
      v-if="!isAutoAdvancing"
      type="button"
      @click="emit('continue')"
    >
      Next round
    </Button>
  </div>
</template>

<style scoped>
.loading-indicator {
  animation: grow-x v-bind(waitTime) linear;
}

@keyframes grow-x {
  from {
    transform: scaleX(0);
  }
  to {
    transform: scaleX(1);
  }
}

.results-move,
.results-enter-active,
.results-leave-active {
  transition: all 1s ease;
}

.results-enter-from,
.results-leave-to {
  opacity: 0;
  transform: translateY(30px);
}

.results-leave-active {
  position: absolute;
}
</style>
