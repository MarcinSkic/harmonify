<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  current: number
  initial: number
}>()

const fillPercentage = computed(() => {
  if (props.initial === 0)
    return '100%'
  return `${Math.round((1 - props.current / props.initial) * 100)}%`
})

const ringColor = computed(() => {
  if (props.initial === 0)
    return 'hsl(0, 70%, 50%)'
  const ratio = props.current / props.initial
  if (ratio > 0.5)
    return 'hsl(142, 70%, 45%)'
  if (ratio > 0.2)
    return 'hsl(45, 90%, 50%)'
  return 'hsl(0, 70%, 50%)'
})
</script>

<template>
  <div
    class="
      ring-bg grid size-16 place-items-center rounded-full border-[6px]
      border-transparent text-2xl font-bold
      lg:size-24 lg:border-8 lg:text-4xl
    "
  >
    {{ current }}
  </div>
</template>

<style scoped>
.ring-bg {
  background:
    var(--gradient-background, hsl(var(--background))) fixed content-box no-repeat,
    conic-gradient(transparent v-bind(fillPercentage), 0, v-bind(ringColor)) border-box;
}
</style>
