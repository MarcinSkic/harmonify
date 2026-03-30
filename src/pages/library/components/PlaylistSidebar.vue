<script setup lang="ts">
import { Library, ListMusic, Plus, Trash2 } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useLibraryStore } from '@/stores'

defineEmits<{
  createPlaylist: []
}>()

const libraryStore = useLibraryStore()
</script>

<template>
  <div class="flex h-full flex-col">
    <div class="flex items-center justify-between p-4">
      <h2 class="flex items-center gap-2 text-lg font-semibold">
        <Library class="size-5" />
        Playlists
      </h2>
      <Button variant="ghost" size="icon" @click="$emit('createPlaylist')">
        <Plus class="size-4" />
      </Button>
    </div>

    <ScrollArea class="flex-1 px-2">
      <Button
        variant="ghost"
        class="w-full justify-start gap-2"
        :class="{ 'bg-accent text-accent-foreground': libraryStore.selectedPlaylistId === null }"
        @click="libraryStore.selectPlaylist(null)"
      >
        <ListMusic class="size-4 shrink-0" />
        All tracks
      </Button>

      <div
        v-for="playlist in libraryStore.playlists"
        :key="playlist.id"
        class="group flex items-center"
      >
        <Button
          variant="ghost"
          class="flex-1 justify-start gap-2 truncate"
          :class="{ 'bg-accent text-accent-foreground': libraryStore.selectedPlaylistId === playlist.id }"
          @click="libraryStore.selectPlaylist(playlist.id)"
        >
          <ListMusic class="size-4 shrink-0" />
          <span class="truncate">{{ playlist.name }}</span>
        </Button>
        <Button
          variant="ghost"
          size="icon"
          class="
            size-8 shrink-0 opacity-0 transition-opacity
            group-hover:opacity-100
          "
          @click="libraryStore.removePlaylist(playlist.id)"
        >
          <Trash2
            class="
              size-4 text-muted-foreground
              hover:text-destructive
            "
          />
        </Button>
      </div>

      <p
        v-if="libraryStore.playlists.length === 0"
        class="px-3 py-6 text-center text-sm text-muted-foreground"
      >
        No playlists yet
      </p>
    </ScrollArea>
  </div>
</template>
