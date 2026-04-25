<script setup lang="ts">
import { ImageOff } from '@lucide/vue'

defineProps<{
  imageUrl?: string | null
  hideImage?: boolean
  title: string
  artists: string[]
}>()
</script>

<template>
  <div
    class="@container flex w-full items-center gap-4"
  >
    <template v-if="!hideImage">
      <img
        v-if="imageUrl"
        :src="imageUrl"
        alt="Album cover"
        class="
          aspect-square max-h-32 shrink-0 rounded-md object-cover
          lg:max-h-48
        "
      >
      <div
        v-else
        class="
          flex size-32 shrink-0 items-center justify-center rounded-md bg-muted
          lg:size-48
        "
      >
        <ImageOff
          class="
            size-10 text-muted-foreground
            lg:size-14
          "
        />
      </div>
    </template>
    <div
      class="
        flex min-w-0 flex-1 flex-col gap-3
        lg:gap-5
      "
    >
      <span
        class="truncate text-[clamp(1.5rem,5.5cqw,4.5rem)] font-semibold"
      >{{ title }}</span>
      <span
        class="truncate text-[clamp(1.25rem,3.5cqw,3rem)] text-muted-foreground"
      >{{ artists.join(', ') }}</span>
    </div>
  </div>
</template>
