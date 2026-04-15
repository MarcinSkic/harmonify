<script setup lang="ts">
defineProps<{
  imageUrl?: string | null
  title: string
  artists: string[]
}>()
</script>

<template>
  <div class="flex items-center gap-4">
    <img
      v-if="imageUrl"
      :src="imageUrl"
      alt="Album cover"
      class="
        aspect-square max-h-32 rounded-md object-cover
        lg:max-h-48
      "
    >
    <div
      class="
        flex flex-col gap-3
        lg:gap-5
      "
    >
      <span
        class="
          text-3xl font-semibold
          lg:text-7xl
        "
      >{{ title }}</span>
      <span
        class="
          text-2xl text-muted-foreground
          lg:text-5xl
        "
      >{{ artists.join(', ') }}</span>
    </div>
  </div>
</template>
