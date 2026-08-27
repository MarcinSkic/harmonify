import type { SubsonicAlbum, SubsonicPlaylist } from '@/services/navidrome'
import { computed, onMounted, ref } from 'vue'
import { reportNavidromeError } from '@/lib/navidrome'
import { NavidromeService } from '@/services'
import { useNavidromeStore } from '@/stores'

const NAVIDROME_PAGE_SIZE = 60

/**
 * Albums are paged on the server (`getAlbumList2` takes `offset`/`size`) — a real library has far
 * too many to put in the DOM at once. Playlists arrive in a single response, so their paging is
 * client-side; both behave the same way from the outside.
 */
export function useLoadNavidromeLibrary() {
  const navidromeStore = useNavidromeStore()

  const albums = ref<SubsonicAlbum[]>([])
  const albumPage = ref(0)
  const isLoadingAlbums = ref(true)
  // Subsonic never reports a total, so a full page is the only signal that another one may follow.
  const hasNextAlbumPage = ref(false)

  const allPlaylists = ref<SubsonicPlaylist[]>([])
  const playlistPage = ref(0)
  const isLoadingPlaylists = ref(true)

  const loadError = ref(false)

  const playlists = computed(() => allPlaylists.value.slice(
    playlistPage.value * NAVIDROME_PAGE_SIZE,
    (playlistPage.value + 1) * NAVIDROME_PAGE_SIZE,
  ))
  const hasNextPlaylistPage = computed(
    () => (playlistPage.value + 1) * NAVIDROME_PAGE_SIZE < allPlaylists.value.length,
  )

  // Guards against a slower earlier page replacing the one the user navigated to afterwards.
  let albumRequest = 0

  function handleFailure(error: unknown, message: string) {
    loadError.value = true
    reportNavidromeError(error, message)
    navidromeStore.reportSessionError(error)
  }

  async function goToAlbumPage(page: number) {
    if (page < 0)
      return

    const request = ++albumRequest
    isLoadingAlbums.value = true

    try {
      const batch = await NavidromeService.getAlbums({
        offset: page * NAVIDROME_PAGE_SIZE,
        size: NAVIDROME_PAGE_SIZE,
      })

      if (request !== albumRequest)
        return

      albums.value = batch
      albumPage.value = page
      hasNextAlbumPage.value = batch.length === NAVIDROME_PAGE_SIZE
      loadError.value = false
    }
    catch (error) {
      if (request === albumRequest)
        handleFailure(error, 'Failed to load Navidrome albums')
    }
    finally {
      if (request === albumRequest)
        isLoadingAlbums.value = false
    }
  }

  function goToPlaylistPage(page: number) {
    if (page < 0 || page * NAVIDROME_PAGE_SIZE >= allPlaylists.value.length)
      return

    playlistPage.value = page
  }

  async function loadPlaylists() {
    isLoadingPlaylists.value = true

    try {
      allPlaylists.value = await NavidromeService.getPlaylists()
    }
    catch (error) {
      handleFailure(error, 'Failed to load Navidrome playlists')
    }
    finally {
      isLoadingPlaylists.value = false
    }
  }

  onMounted(async () => {
    // Without a session every call would fail on `requireSession`; the view shows a connect prompt.
    if (!NavidromeService.getSession()) {
      isLoadingAlbums.value = false
      isLoadingPlaylists.value = false
      return
    }

    await Promise.all([goToAlbumPage(0), loadPlaylists()])
  })

  return {
    albums,
    albumPage,
    hasNextAlbumPage,
    isLoadingAlbums,
    goToAlbumPage,
    playlists,
    playlistPage,
    hasNextPlaylistPage,
    isLoadingPlaylists,
    goToPlaylistPage,
    loadError,
  }
}
