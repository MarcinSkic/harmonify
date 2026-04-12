import type { Playlist, Track } from '@/db/schemas'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { useLiveQuery } from '@/composables/useLiveQuery'
import { db } from '@/db'
import { LibraryService } from '@/services'

export const useLibraryStore = defineStore('library', () => {
  const playlists = useLiveQuery(() => db.playlists.toArray(), [] as Playlist[])

  const selectedPlaylistId = ref<string | null>(null)

  const tracks = useLiveQuery(
    async () => {
      const result = selectedPlaylistId.value
        ? await db.tracks.where('playlistIds').equals(selectedPlaylistId.value).toArray()
        : await db.tracks.toArray()
      return result.sort((a, b) => a.sourceId.localeCompare(b.sourceId, undefined, { numeric: true }))
    },
    [] as Track[],
    [selectedPlaylistId],
  )

  const enabledTracks = computed(() => tracks.value.filter(t => t.enabled !== false))

  const allTags = useLiveQuery(() => LibraryService.getAllTags(), [] as string[])

  const selectedPlaylist = computed(() =>
    playlists.value.find(p => p.id === selectedPlaylistId.value) ?? null,
  )

  function selectPlaylist(id: string | null) {
    selectedPlaylistId.value = id
  }

  async function createPlaylist(name: string, source: Playlist['source'] = 'manual') {
    return LibraryService.addPlaylist({ name, source })
  }

  async function removePlaylist(id: string) {
    if (selectedPlaylistId.value === id)
      selectedPlaylistId.value = null
    return LibraryService.deletePlaylist(id)
  }

  async function createTrack(data: Omit<Track, 'id' | 'createdAt'>) {
    return LibraryService.addTrack(data)
  }

  async function importTracks(tracks: Omit<Track, 'id' | 'createdAt'>[]) {
    return LibraryService.addTracks(tracks)
  }

  async function removeTrack(id: string) {
    return LibraryService.deleteTrack(id)
  }

  async function setTrackEnabled(id: string, enabled: boolean) {
    return LibraryService.updateTrack(id, { enabled })
  }

  return {
    playlists,
    selectedPlaylistId,
    selectedPlaylist,
    tracks,
    enabledTracks,
    allTags,
    selectPlaylist,
    createPlaylist,
    removePlaylist,
    createTrack,
    importTracks,
    removeTrack,
    setTrackEnabled,
  }
})
