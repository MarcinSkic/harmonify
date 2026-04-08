import { onMounted } from 'vue'
import { toast } from 'vue-sonner'
import { MusicServerService } from '@/services'
import { useServerLibraryStore } from '@/stores'

export function useLoadServerLibrary() {
  const serverLibraryStore = useServerLibraryStore()

  onMounted(async () => {
    if (serverLibraryStore.playlists.length > 0) {
      return
    }

    try {
      const serverPlaylists = await MusicServerService.getPlaylists()
      serverLibraryStore.playlists = serverPlaylists.map(p => ({ ...p, selected: false }))
    }
    catch (e) {
      serverLibraryStore.loadError = true
      console.error(e)
      toast.error('Failed to load music server playlists')
    }
    finally {
      serverLibraryStore.isLoading = false
    }
  })
}
