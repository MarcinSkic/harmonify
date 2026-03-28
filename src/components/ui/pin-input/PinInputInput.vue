<script setup lang="ts">
import type { PinInputInputProps } from 'reka-ui'
import type { HTMLAttributes } from 'vue'
import { PinInputInput, useForwardProps } from 'reka-ui'
import { computed } from 'vue'
import { cn } from '@/lib/utils'

const props = defineProps<PinInputInputProps & { class?: HTMLAttributes['class'] }>()

const delegatedProps = computed(() => {
  const { class: _, ...delegated } = props
  return delegated
})

const forwardedProps = useForwardProps(delegatedProps)
</script>

<template>
  <PinInputInput
    v-bind="forwardedProps" :class="cn(`
      relative flex size-10 items-center justify-center border-y border-r
      border-white/20 bg-input text-center text-sm transition-all
      first:rounded-l-md first:border-l
      last:rounded-r-md
      focus:relative focus:z-10 focus:ring-2 focus:ring-ring
      focus:outline-hidden
    `, props.class)"
  />
</template>
