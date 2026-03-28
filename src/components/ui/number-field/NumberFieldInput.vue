<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { NumberFieldInput } from 'reka-ui'
import { cn } from '@/lib/utils'

const props = defineProps<{
  class?: HTMLAttributes['class']
}>()
</script>

<template>
  <NumberFieldInput
    data-slot="input"
    :class="cn(`
      flex h-10 w-full rounded-md border border-input bg-gradient bg-fixed px-10
      py-2 text-center text-sm ring-offset-background
      placeholder:text-muted-foreground
      focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2
      focus-visible:outline-hidden
      disabled:cursor-not-allowed disabled:opacity-50
    `, props.class)"
  />
</template>
