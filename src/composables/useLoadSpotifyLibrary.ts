import Cookies from 'universal-cookie'
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { toast } from 'vue-sonner'
import { SpotifyService } from '@/services'
import { useSpotifyLibraryStore } from '@/stores'

export function useLoadSpotifyLibrary() {
  const spotifyLibraryStore = useSpotifyLibraryStore()
  const router = useRouter()
  const cookies = new Cookies(null, { path: '/' })
  const isLoadError = ref(false)

  onMounted(async () => {
    if (spotifyLibraryStore.hasData) {
      return
    }

    try {
      const accessToken = cookies.get('access_token')
      const [fav, pl, al] = await Promise.all([
        SpotifyService.getTracksFromFavourites(accessToken, router),
        SpotifyService.getPlaylists(accessToken, router),
        SpotifyService.getAlbums(accessToken, router),
      ])
      spotifyLibraryStore.favourites = fav
      spotifyLibraryStore.playlists = pl
      spotifyLibraryStore.albums = al
    }
    catch (e) {
      isLoadError.value = true
      console.error(e)
      toast.error('Failed to load Spotify library')
    }
  })

  return { isLoadError }
}
