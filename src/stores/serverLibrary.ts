import type { ServerPlaylist } from '@/services/music-server'
import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useServerLibraryStore = defineStore('serverLibrary', () => {
  const isLoading = ref(true)
  const loadError = ref(false)
  const playlists = ref<(ServerPlaylist & { selected: boolean })[]>([])

  return { isLoading, loadError, playlists }
})
