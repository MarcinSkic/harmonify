<script setup lang="ts">
import { Info } from '@lucide/vue'
import { ref } from 'vue'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

defineProps<{
  trackSourceId?: string
}>()

const showId = ref(false)
</script>

<template>
  <Button
    type="button"
    :class="cn(`absolute top-20 right-0 z-20 grid overflow-hidden transition`, showId ? `
      h-16
    ` : `
      w-24
      hover:w-26
    `)
    "
    @click="showId = !showId"
  >
    <div class="mt-0.5 flex items-center gap-2 justify-self-center">
      <Info class="size-4" /><span>Show ID</span>
    </div>
    <div>{{ trackSourceId }}</div>
  </Button>
</template>
