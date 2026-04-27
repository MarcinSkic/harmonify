<script setup lang="ts">
import { Loader2 } from '@lucide/vue'
import { ref } from 'vue'
import { toast } from 'vue-sonner'
import { Button } from '@/components/ui/button'
import { useLoadServerLibrary } from '@/composables/useLoadServerLibrary'
import { LibraryService, MusicServerService } from '@/services'
import { useServerLibraryStore } from '@/stores'
import ServerLibraryDisplay from './ServerLibraryDisplay.vue'

const emit = defineEmits<{
  imported: []
}>()

const serverLibraryStore = useServerLibraryStore()

const isImporting = ref(false)
useLoadServerLibrary()

async function handleImport() {
  const selected = serverLibraryStore.playlists.filter(p => p.selected)
  if (selected.length === 0)
    return

  isImporting.value = true
  try {
    let totalTracks = 0
    const existingPlaylists = await LibraryService.getAllPlaylists()

    for (const playlist of selected) {
      const serverTracks = await MusicServerService.getTracks(playlist.name)
      const imageUrl = playlist.hasCover
        ? MusicServerService.getPlaylistCoverUrl(playlist.name)
        : undefined

      const existing = existingPlaylists.find(
        p => p.name === playlist.name && p.source === 'server',
      )

      let playlistId: string
      if (existing) {
        playlistId = existing.id
        await LibraryService.updatePlaylist(playlistId, { imageUrl })
      }
      else {
        playlistId = await LibraryService.addPlaylist({
          name: playlist.name,
          source: 'server',
          imageUrl,
        })
      }

      const tracks = serverTracks.map(t => ({
        sourceId: t.id,
        name: t.title ?? '',
        artists: t.artist ? t.artist.split(', ') : [],
        durationMs: t.durationMs,
        albumName: t.album ?? '',
        albumImageUrl: t.hasCoverArt
          ? MusicServerService.getCoverUrl(t.id)
          : undefined,
        audioUrl: MusicServerService.getAudioUrl(t.id),
        playbackRange: null,
        tags: [],
        playlistIds: [playlistId],
        metadataSource: 'server' as const,
        enabledByPlaylist: { [playlistId]: true },
      }))

      await LibraryService.addTracksDeduplicating(tracks)
      totalTracks += tracks.length
    }

    toast.success(`Imported ${totalTracks} tracks from ${selected.length} playlists`)
    emit('imported')
  }
  catch (e) {
    console.error(e)
    toast.error('Import failed')
  }
  finally {
    isImporting.value = false
  }
}
</script>

<template>
  <template v-if="!serverLibraryStore.loadError">
    <ServerLibraryDisplay />

    <div class="flex justify-end pt-2">
      <Button :disabled="isImporting || serverLibraryStore.playlists.every(p => !p.selected)" @click="handleImport">
        <Loader2 v-if="isImporting" class="size-4 animate-spin" />
        {{ isImporting ? 'Importing...' : 'Import selected' }}
      </Button>
    </div>
  </template>
  <p v-else class="py-4 text-center text-sm text-muted-foreground">
    Could not connect to music server.
  </p>
</template>
