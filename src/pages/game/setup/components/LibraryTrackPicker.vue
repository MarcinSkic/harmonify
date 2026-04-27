<script setup lang="ts">
import type { Playlist } from '@/db/schemas'
import { Music } from '@lucide/vue'
import { computed, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import PlaylistCard from '@/components/PlaylistCard.vue'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { db } from '@/db'
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
        <PlaylistCard
          v-for="playlist in libraryStore.playlists"
          :key="playlist.id"
          :model-value="selectedPlaylistIds.includes(playlist.id)"
          :name="playlist.name"
          :track-count="trackCounts.get(playlist.id) ?? '…'"
          :image-url="playlist.imageUrl"
          @update:model-value="togglePlaylist(playlist.id)"
        />
      </div>
    </div>
  </ScrollArea>
</template>
