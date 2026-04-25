<script setup lang="ts">
import CheckableCard from '@/components/spotify/CheckableCard.vue'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { useServerLibraryStore } from '@/stores'

const serverLibraryStore = useServerLibraryStore()
</script>

<template>
  <ScrollArea
    class="flex max-h-full flex-col justify-start rounded-lg border p-4"
  >
    <div class="grid grid-cols-[repeat(auto-fill,minmax(100px,1fr))] gap-3">
      <template v-if="!serverLibraryStore.isLoading">
        <CheckableCard
          v-for="playlist of serverLibraryStore.playlists"
          :id="playlist.name"
          :key="playlist.name"
          v-model="playlist.selected"
          :title="`${playlist.name} (${playlist.trackCount})`"
          :alt="playlist.name"
        />
      </template>
      <template v-else>
        <div v-for="i in 8" :key="i" class="space-y-2">
          <Skeleton class="aspect-square w-full" />
          <Skeleton class="mx-1 h-4" />
        </div>
      </template>
    </div>
  </ScrollArea>
</template>
