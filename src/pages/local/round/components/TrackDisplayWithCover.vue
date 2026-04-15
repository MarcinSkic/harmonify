<script setup lang="ts">
defineProps<{
  imageUrl?: string | null
  title: string
  artists: string[]
}>()
</script>

<template>
  <div
    class="flex w-full items-center gap-4"
    style="container-type: inline-size;"
  >
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
      class="
        flex min-w-0 flex-1 flex-col gap-3
        lg:gap-5
      "
    >
      <span
        class="truncate text-[clamp(1.5rem,7cqw,4.5rem)] font-semibold"
      >{{ title }}</span>
      <span
        class="truncate text-[clamp(1.25rem,5cqw,3rem)] text-muted-foreground"
      >{{ artists.join(', ') }}</span>
    </div>
  </div>
</template>
