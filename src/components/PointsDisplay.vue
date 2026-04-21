<script setup lang="ts">
import { Star } from '@lucide/vue'

defineProps<{
  points: number
  iconClass?: string
}>()
</script>

<template>
  <span class="inline-flex items-center gap-1">
    {{ points }}
    <Star :class="iconClass ?? 'size-4'" />
  </span>
</template>
