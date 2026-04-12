<script setup lang="ts">
import type { LocalGameTeam } from '@/db/schemas'
import { TransitionPresets, useTimeout, useTransition } from '@vueuse/core'
import { computed, defineComponent, h, toRef } from 'vue'
import { Button } from '@/components/ui/button'
import { AnimationDuration } from '@/consts'
import { useSettingsStore } from '@/stores'

const props = defineProps<{
  teams: LocalGameTeam[]
  previousTeams: LocalGameTeam[]
}>()

const emit = defineEmits<{
  continue: []
}>()

const settingsStore = useSettingsStore()
const showCurrentScore = useTimeout(AnimationDuration.D1000)

const maxBarWidth = 200

const leaderboard = computed(() => {
  const source = showCurrentScore.value || !settingsStore.playAnimations
    ? props.teams
    : props.previousTeams

  const sorted = [...source].sort((a, b) => b.score - a.score)
  const bestScore = sorted[0]?.score ?? 0

  return sorted.map(team => ({
    ...team,
    targetWidth: bestScore === 0 ? 0 : (team.score / bestScore) * maxBarWidth,
  }))
})

const LocalLeaderboardBar = defineComponent({
  props: {
    targetWidth: { type: Number, required: true },
  },
  setup(barProps) {
    const width = useTransition(toRef(barProps, 'targetWidth'), {
      duration: AnimationDuration.D1000,
      transition: TransitionPresets.linear,
    })
    return () => h('div', {
      class: 'h-4 rounded-md bg-primary',
      style: { width: `${width.value}px` },
    })
  },
})
</script>

<template>
  <div class="grid place-items-center gap-6">
    <h2 class="text-xl font-semibold">
      Leaderboard
    </h2>

    <TransitionGroup name="results" tag="div" class="grid w-full max-w-md gap-3">
      <div
        v-for="entry in leaderboard" :key="entry.id" class="
          flex items-center gap-3
        "
      >
        <span class="min-w-20 shrink-0 text-base font-medium">{{ entry.name }}</span>
        <div class="flex flex-1 items-center gap-2">
          <LocalLeaderboardBar :target-width="entry.targetWidth" />
          <span class="min-w-10 text-right text-sm tabular-nums">{{ entry.score }}</span>
        </div>
      </div>
    </TransitionGroup>

    <Button
      type="button"
      @click="emit('continue')"
    >
      Next round
    </Button>
  </div>
</template>

<style scoped>
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
