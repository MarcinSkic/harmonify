<script setup lang="ts">
import { Shuffle } from '@lucide/vue'

defineEmits<{ click: [] }>()
</script>

<template>
  <button
    type="button"
    class="
      absolute top-20 right-0 z-20 flex items-center gap-2 rounded-l-lg border
      border-r-0 border-primary bg-primary py-3 pr-4 pl-3 text-sm font-semibold
      text-primary-foreground shadow-lg transition
      hover:pr-5
    "
    @click="$emit('click')"
  >
    <Shuffle class="size-4" />
    Take over
  </button>
</template>
