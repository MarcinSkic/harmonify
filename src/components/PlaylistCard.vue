<script setup lang="ts">
import { ListMusic } from '@lucide/vue'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

defineProps<{
  imageUrl?: string
  name: string
  trackCount: number | string
}>()

const selected = defineModel<boolean>({ required: true })
</script>

<template>
  <button
    type="button"
    class="flex flex-col items-center gap-1 text-center font-semibold"
    @click="selected = !selected"
  >
    <div
      :class="cn(
        `
          relative box-border aspect-square w-full overflow-hidden border-4
          border-solid border-transparent
        `,
        selected && `
          border-primary shadow-[0px_2px_16px_3px_rgba(245,190,11,0.33)]
        `,
      )"
    >
      <img
        v-if="imageUrl"
        :src="imageUrl"
        :alt="name"
        class="
          size-full object-contain transition-transform duration-300
          hover:scale-105
        "
      >
      <div v-else class="grid h-full place-items-center bg-muted">
        <ListMusic :size="40" class="text-muted-foreground" />
      </div>
    </div>
    <span class="line-clamp-2 text-sm">{{ name }}</span>
    <Badge variant="secondary" class="shrink-0">
      {{ trackCount }}
    </Badge>
  </button>
</template>
