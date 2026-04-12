<script setup lang="ts">
import { ListMusic, Music } from '@lucide/vue'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useLibraryStore } from '@/stores'

const libraryStore = useLibraryStore()
</script>

<template>
  <ScrollArea
    class="flex max-h-full flex-col justify-start rounded-lg border p-4"
  >
    <h2
      class="
        sticky -top-1 z-10 bg-gradient bg-fixed pb-2 text-center text-xl
        font-semibold tracking-tight
        lg:pb-4 lg:text-3xl
      "
    >
      Library
    </h2>

    <div
      v-if="libraryStore.playlists.length === 0" class="
        py-8 text-center text-sm text-muted-foreground
      "
    >
      <Music class="mx-auto mb-2 size-10" />
      <p>No playlists in library.</p>
      <p class="mt-1">
        Import tracks from the
        <RouterLink to="/library" class="text-primary underline">
          Library
        </RouterLink>
        page first.
      </p>
    </div>

    <div v-else class="flex flex-col gap-1">
      <Button
        variant="ghost"
        class="w-full justify-start gap-2"
        :class="{ 'bg-accent text-accent-foreground': libraryStore.selectedPlaylistId === null }"
        type="button"
        @click="libraryStore.selectPlaylist(null)"
      >
        <ListMusic class="size-4 shrink-0" />
        <span class="flex-1 truncate text-left">All tracks</span>
        <Badge variant="secondary" class="ml-auto">
          {{ libraryStore.enabledTracks.length }}
        </Badge>
      </Button>

      <Button
        v-for="playlist in libraryStore.playlists"
        :key="playlist.id"
        variant="ghost"
        class="w-full justify-start gap-2"
        :class="{ 'bg-accent text-accent-foreground': libraryStore.selectedPlaylistId === playlist.id }"
        type="button"
        @click="libraryStore.selectPlaylist(playlist.id)"
      >
        <ListMusic class="size-4 shrink-0" />
        <span class="flex-1 truncate text-left">{{ playlist.name }}</span>
      </Button>
    </div>

    <div
      v-if="libraryStore.selectedPlaylistId !== null" class="mt-4 border-t pt-3"
    >
      <p class="text-sm text-muted-foreground">
        {{ libraryStore.enabledTracks.length }} tracks selected
      </p>
    </div>
  </ScrollArea>
</template>
