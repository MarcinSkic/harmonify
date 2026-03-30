import type { SpotifyTrack } from '@/types'

export function removeDuplicatedTracks(tracks: SpotifyTrack[]) {
  return tracks.reduce<SpotifyTrack[]>((filteredTracks, track) => {
    if (!filteredTracks.some(someTrack => someTrack.uri === track.uri))
      filteredTracks.push(track)

    return filteredTracks
  }, [])
}

export function getArtistsAsString(track: SpotifyTrack) {
  return track.artists
    .reduce((acc, artist) => {
      return `${acc}, ${artist.name}`
    }, '')
    .slice(2)
}
