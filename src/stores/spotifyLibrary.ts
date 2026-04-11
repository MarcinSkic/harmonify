import type { Router } from 'vue-router'
import type { SpotifySelectableAlbum, SpotifySelectablePlaylist, SpotifyTrack } from '@/types'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { removeDuplicatedTracks } from '@/lib/track'
import { SpotifyService } from '@/services'

export const useSpotifyLibraryStore = defineStore('spotifyLibrary', () => {
  const favouritesSelected = ref(false)
  const favourites = ref<SpotifyTrack[]>()
  const playlists = ref<SpotifySelectablePlaylist[]>()
  const albums = ref<SpotifySelectableAlbum[]>()
  const totalSelectedTracks = computed(() => {
    let count = 0

    if (favouritesSelected.value)
      count += favourites.value?.length ?? 0

    count += playlists.value
      ?.filter(p => p.selected)
      .reduce((acc, p) => acc + p.items.total, 0) ?? 0

    count += albums.value
      ?.filter(p => p.selected)
      .reduce((acc, p) => acc + p.tracks.items.length, 0) ?? 0

    return count
  })
  const hasData = computed(() => !!favourites.value || !!playlists.value || !!albums.value)

  async function getTracksFromSelectedSets(access_token: string, router: Router) {
    let tracks = await fetchTracksFromSelectedSets(access_token, router)
    tracks = removeDuplicatedTracks(tracks)
    return tracks
  }

  async function fetchTracksFromSelectedSets(access_token: string, router: Router): Promise<SpotifyTrack[]> {
    if (!favourites.value && !playlists.value && !albums.value)
      throw new Error('Tried to fetch tracks before loaded any playlist or album')

    let favouriteTracks: SpotifyTrack[] = []

    if (favouritesSelected.value)
      favouriteTracks = favourites.value ?? []

    const playlistsTracks = playlists.value ? await SpotifyService.getTracksFromPlaylists(playlists.value.filter(p => p.selected), access_token, router) : []
    const albumTracks = albums.value ? await SpotifyService.getTracksFromAlbums(albums.value.filter(p => p.selected)) : []

    return [...favouriteTracks, ...playlistsTracks, ...albumTracks]
  }

  return { favourites, favouritesSelected, playlists, albums, totalSelectedTracks, hasData, getTracksFromSelectedSets }
})
