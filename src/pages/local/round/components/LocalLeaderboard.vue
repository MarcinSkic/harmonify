<script setup lang="ts">
import type { LocalGameTeam } from '@/db/schemas'
import { TransitionPresets, useTimeout, useTransition, useWindowSize } from '@vueuse/core'
import { computed, defineComponent, h, toRef } from 'vue'
import { Button } from '@/components/ui/button'
import { AnimationDuration, Breakpoint } from '@/consts'
import { useSettingsStore } from '@/stores'
import AddTeamInline from './AddTeamInline.vue'

const props = defineProps<{
  teams: LocalGameTeam[]
  previousTeams: LocalGameTeam[]
}>()

const emit = defineEmits<{
  continue: []
  addTeam: [name: string]
}>()

const settingsStore = useSettingsStore()
const showCurrentScore = useTimeout(AnimationDuration.D1000)

const { width: screenWidth } = useWindowSize()
const maxBarWidth = computed(() => screenWidth.value >= Breakpoint.LG ? 500 : 200)

const leaderboard = computed(() => {
  const source = showCurrentScore.value || !settingsStore.playAnimations
    ? props.teams
    : props.previousTeams

  const sorted = [...source].sort((a, b) => b.score - a.score)
  const bestScore = sorted[0]?.score ?? 0

  return sorted.map(team => ({
    ...team,
    targetWidth: bestScore === 0 ? 0 : (team.score / bestScore) * maxBarWidth.value,
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
      class: 'h-4 rounded-md bg-primary lg:h-6',
      style: { width: `${width.value}px` },
    })
  },
})
</script>

<template>
  <div class="grid place-items-center gap-6">
    <TransitionGroup
      name="results" tag="div" class="
        grid w-full max-w-md gap-3
        lg:max-w-2xl lg:gap-4
        xl:max-w-4xl
      "
    >
      <div
        v-for="entry in leaderboard" :key="entry.id" class="
          flex items-center gap-3
          lg:gap-4
        "
      >
        <span
          class="
            w-32 shrink-0 truncate text-right text-base font-medium
            lg:w-48 lg:text-xl
          "
        >{{ entry.name }}</span>
        <div class="flex flex-1 items-center gap-2">
          <LocalLeaderboardBar :target-width="entry.targetWidth" />
          <span
            class="
              min-w-10 text-right text-sm tabular-nums
              lg:text-lg
            "
          >{{ entry.score }}</span>
        </div>
      </div>
    </TransitionGroup>

    <AddTeamInline @add="emit('addTeam', $event)" />

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
