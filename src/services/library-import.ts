import type { Router } from 'vue-router'
import type { Track } from '@/db/schemas'
import type { SpotifySelectableAlbum, SpotifySelectablePlaylist, SpotifyTrack } from '@/types'
import { LibraryService, SpotifyService } from '@/services'

type NewTrack = Omit<Track, 'id' | 'createdAt'>

export function trackToSpotifyTrack(track: Track): SpotifyTrack {
  return {
    uri: track.audioUrl ?? track.sourceId,
    name: track.name,
    artists: track.artists.map(name => ({ name, id: name })),
    duration_ms: track.durationMs,
    album: {
      name: track.albumName,
      images: track.albumImageUrl ? [{ url: track.albumImageUrl, height: null, width: null }] : [],
    },
    preview_url: track.audioUrl ?? null,
  }
}

export function spotifyTrackToTrack(track: SpotifyTrack, playlistIds: string[]): NewTrack {
  return {
    sourceId: track.uri,
    name: track.name,
    artists: track.artists.map(a => a.name),
    durationMs: track.duration_ms,
    albumName: track.album.name,
    albumImageUrl: track.album.images[0]?.url,
    audioUrl: track.preview_url ?? undefined,
    playbackRange: null,
    tags: [],
    playlistIds,
    metadataSource: 'spotify',
    enabledByPlaylist: Object.fromEntries(playlistIds.map(pid => [pid, true])),
  }
}

export async function importFromSpotify(
  accessToken: string,
  router: Router,
  selectedPlaylists: SpotifySelectablePlaylist[],
  selectedAlbums: SpotifySelectableAlbum[],
  favourites: SpotifyTrack[] | null,
  favouritesSelected: boolean,
): Promise<{ playlistCount: number, trackCount: number }> {
  let totalTracks = 0
  let playlistCount = 0

  // Import favourites
  if (favouritesSelected && favourites?.length) {
    const playlistId = await LibraryService.addPlaylist({ name: 'Spotify Favourites', source: 'spotify' })
    const tracks = favourites.map(t => spotifyTrackToTrack(t, [playlistId]))
    await LibraryService.addTracks(tracks)
    totalTracks += tracks.length
    playlistCount++
  }

  // Import playlists
  const selected = selectedPlaylists.filter(p => p.selected)
  for (const playlist of selected) {
    const playlistId = await LibraryService.addPlaylist({
      name: playlist.name,
      source: 'spotify',
      imageUrl: playlist.images?.[0]?.url,
    })
    const spotifyTracks = await SpotifyService.getTracksFromPlaylists([playlist], accessToken, router)
    const tracks = spotifyTracks.map(t => spotifyTrackToTrack(t, [playlistId]))
    await LibraryService.addTracks(tracks)
    totalTracks += tracks.length
    playlistCount++
  }

  // Import albums
  const selectedAlbumList = selectedAlbums.filter(a => a.selected)
  for (const album of selectedAlbumList) {
    const playlistId = await LibraryService.addPlaylist({
      name: album.name,
      source: 'spotify',
      imageUrl: album.images[0]?.url,
    })
    const spotifyTracks = await SpotifyService.getTracksFromAlbums([album])
    const tracks = spotifyTracks.map(t => spotifyTrackToTrack(t, [playlistId]))
    await LibraryService.addTracks(tracks)
    totalTracks += tracks.length
    playlistCount++
  }

  return { playlistCount, trackCount: totalTracks }
}
