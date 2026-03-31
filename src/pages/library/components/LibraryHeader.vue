<script setup lang="ts">
import { ArrowLeft, Download } from 'lucide-vue-next'
import { RouterLink } from 'vue-router'
import { Button } from '@/components/ui/button'
import { useLibraryStore } from '@/stores'

defineEmits<{
  spotifyImport: []
}>()

const libraryStore = useLibraryStore()
</script>

<template>
  <header class="flex flex-wrap items-center gap-3 border-b p-4">
    <RouterLink to="/">
      <Button variant="ghost" size="icon">
        <ArrowLeft class="size-5" />
      </Button>
    </RouterLink>

    <div class="min-w-0 flex-1">
      <h1 class="text-xl font-bold">
        {{ libraryStore.selectedPlaylist?.name ?? 'All tracks' }}
      </h1>
      <p class="text-sm text-muted-foreground">
        {{ libraryStore.tracks.length }} {{ libraryStore.tracks.length === 1 ? 'track' : 'tracks' }}
      </p>
    </div>

    <Button variant="outline" class="gap-2" @click="$emit('spotifyImport')">
      <Download class="size-4" />
      <span
        class="
          hidden
          sm:inline
        "
      >Import from Spotify</span>
    </Button>
  </header>
</template>
