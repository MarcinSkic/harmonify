<script setup lang="ts">
import PlaylistCard from '@/components/PlaylistCard.vue'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { MusicServerService } from '@/services'
import { useServerLibraryStore } from '@/stores'

const serverLibraryStore = useServerLibraryStore()
</script>

<template>
  <ScrollArea
    class="flex max-h-full flex-col justify-start rounded-lg border p-4"
  >
    <div class="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-3">
      <template v-if="!serverLibraryStore.isLoading">
        <PlaylistCard
          v-for="playlist of serverLibraryStore.playlists"
          :key="playlist.name"
          v-model="playlist.selected"
          :name="playlist.name"
          :track-count="playlist.trackCount"
          :image-url="playlist.hasCover ? MusicServerService.getPlaylistCoverUrl(playlist.name) : undefined"
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
