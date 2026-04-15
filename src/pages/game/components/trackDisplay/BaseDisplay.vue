<script setup lang="ts">
withDefaults(defineProps<{
  title: string
  author: string
  album: string
  stacked?: boolean
}>(), {
  stacked: false,
})
</script>

<template>
  <span
    v-if="stacked"
    class="flex flex-col gap-0.5"
  >
    <span
      class="
        text-base font-semibold
        md:text-lg
      "
      v-text="title"
    />
    <span
      class="
        text-sm text-muted-foreground
        md:text-base
      " v-text="author"
    />
    <span
      class="
        text-sm text-muted-foreground
        md:text-base
      " v-text="album"
    />
  </span>
  <span
    v-else
    class="
      text-sm
      md:text-base
    "
  >
    <span class="font-semibold" v-text="title" />
    <span class="ml-3 text-muted-foreground" v-text="author" />
    <span class="ml-3 text-muted-foreground" v-text="album" />
  </span>
</template>
