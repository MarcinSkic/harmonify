<script setup lang="ts">
import type { Playlist } from '@/db/schemas'
import { ListMusic, Music } from '@lucide/vue'
import { computed, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { db } from '@/db'
import { cn } from '@/lib/utils'
import { useLibraryStore } from '@/stores'

const props = defineProps<{
  selectedPlaylistIds: string[]
}>()

const emit = defineEmits<{
  'update:selectedPlaylistIds': [ids: string[]]
}>()

const libraryStore = useLibraryStore()

const trackCounts = ref<Map<string, number>>(new Map())

async function loadTrackCounts(playlists: Playlist[]) {
  const map = new Map<string, number>()
  for (const p of playlists) {
    const count = await db.tracks
      .where('playlistIds')
      .equals(p.id)
      .filter(t => t.enabledByPlaylist[p.id] !== false && !!t.audioUrl)
      .count()
    map.set(p.id, count)
  }
  trackCounts.value = map
}

watch(() => libraryStore.playlists, playlists => loadTrackCounts(playlists), { immediate: true })

const allSelected = computed(
  () => libraryStore.playlists.every(p => props.selectedPlaylistIds.includes(p.id)),
)

const totalSelectedTracks = computed(() => {
  let total = 0
  for (const id of props.selectedPlaylistIds)
    total += trackCounts.value.get(id) ?? 0
  return total
})

function togglePlaylist(playlistId: string) {
  const current = new Set(props.selectedPlaylistIds)
  if (current.has(playlistId))
    current.delete(playlistId)
  else
    current.add(playlistId)
  emit('update:selectedPlaylistIds', [...current])
}

function toggleAll() {
  if (allSelected.value)
    emit('update:selectedPlaylistIds', [])
  else
    emit('update:selectedPlaylistIds', libraryStore.playlists.map(p => p.id))
}
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
      v-if="libraryStore.playlists.length === 0"
      class="py-8 text-center text-sm text-muted-foreground"
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
      <div class="mb-1 flex items-center justify-between">
        <span class="text-sm text-muted-foreground">
          {{ totalSelectedTracks }} tracks selected
        </span>
        <Button
          variant="ghost"
          size="sm"
          type="button"
          class="h-7 px-2 text-xs"
          @click="toggleAll"
        >
          {{ allSelected ? 'Deselect all' : 'Select all' }}
        </Button>
      </div>

      <div class="grid grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-3">
        <button
          v-for="playlist in libraryStore.playlists"
          :key="playlist.id"
          type="button"
          class="flex flex-col items-center gap-1 text-center font-semibold"
          @click="togglePlaylist(playlist.id)"
        >
          <div
            :class="cn(`
              relative box-border aspect-square w-full overflow-hidden border-4
              border-solid border-transparent
            `, selectedPlaylistIds.includes(playlist.id) && `
              border-primary shadow-[0px_2px_16px_3px_rgba(245,190,11,0.33)]
            `)"
          >
            <img
              v-if="playlist.imageUrl"
              :src="playlist.imageUrl"
              :alt="playlist.name"
              class="
                size-full object-contain transition-transform duration-300
                hover:scale-105
              "
            >
            <div v-else class="grid h-full place-items-center bg-muted">
              <ListMusic :size="40" class="text-muted-foreground" />
            </div>
          </div>
          <span class="line-clamp-2 text-sm">{{ playlist.name }}</span>
          <Badge variant="secondary" class="shrink-0">
            {{ trackCounts.get(playlist.id) ?? '…' }}
          </Badge>
        </button>
      </div>
    </div>
  </ScrollArea>
</template>
