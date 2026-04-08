<script setup lang="ts">
import type { DisplayedGuessDto } from '@/types'
import { whenever } from '@vueuse/core'
import { ref } from 'vue'
import { cn } from '@/lib/utils'
import { GuessDisplay } from '@/pages/game/components/trackDisplay'

const props = defineProps<{
  displayedGuess: DisplayedGuessDto
  selected: boolean
}>()

const emit = defineEmits<{
  click: [guess: string]
}>()

const element = ref<HTMLDivElement | null>(null)

whenever(() => props.selected, () => {
  element.value?.scrollIntoView({ block: 'nearest' })
})
</script>

<template>
  <div
    ref="element"
    :class="cn(`
      px-3 py-1.5
      hover:bg-accent hover:text-accent-foreground
      md:px-5 md:py-3
    `, selected && `bg-accent text-accent-foreground`)"
    @click="emit('click', displayedGuess.guess ?? '')"
  >
    <GuessDisplay :guess="displayedGuess.guess" />
    <input type="hidden" name="track" :value="displayedGuess.id">
  </div>
</template>
