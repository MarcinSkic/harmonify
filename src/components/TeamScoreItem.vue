<script setup lang="ts">
import type { GuessLevel } from '@/types'
import { CircleUserRound, UsersRound } from '@lucide/vue'
import { TransitionPresets, useTransition } from '@vueuse/core'
import { GuessLevelIcon } from '@/components/guessLevelIcon'
import { AnimationDuration } from '@/consts'
import { cn } from '@/lib/utils'

const props = defineProps<{
  name: string
  score: number
  width: number
  guessLevel?: GuessLevel
  displayGuessLevel?: boolean
  isSelf?: boolean
  large?: boolean
  multipleUsers?: boolean
  animation?: false | { duration: string }
}>()

const animatedWidth = useTransition(() => props.width, {
  duration: AnimationDuration.D1000,
  transition: TransitionPresets.linear,
})
</script>

<template>
  <div class="grid">
    <div class="relative flex items-center gap-2">
      <GuessLevelIcon
        v-if="displayGuessLevel && guessLevel" :guess-level="guessLevel" class="
          relative -bottom-2 -mr-2 self-end
        "
      />
      <div v-else class="relative -bottom-2 -mr-2 min-h-4 min-w-4 self-end" />
      <component
        :is="multipleUsers ? UsersRound : CircleUserRound"
        :class="cn(
          large ? 'min-h-10 min-w-10' : 'min-h-8 min-w-8',
          isSelf && 'text-primary',
        )"
      />
      <div class="grid grid-rows-2">
        <div
          :class="cn('mr-3', large ? `
            text-base
            lg:text-xl
          ` : 'text-sm')"
        >
          {{ name }}
        </div>
        <div
          :class="cn(
            `
              origin-left rounded-md bg-primary text-right
              text-primary-foreground
            `,
            large ? `
              h-4
              lg:h-6
            ` : 'h-3/4',
            animation && 'animated',
          )"
          :style="{ width: `${animatedWidth}px` }"
        />
      </div>
      <div
        :class="large ? `
          text-base
          lg:text-lg
        ` : undefined"
      >
        {{ score }}
      </div>
    </div>
    <slot />
  </div>
</template>

<style scoped>
.animated {
  transform: scaleX(0);
  animation: grow-x v-bind('animation && animation.duration') ease-in-out 0.2s;
  animation-fill-mode: forwards;
}
</style>
