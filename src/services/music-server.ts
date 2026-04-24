import { z } from 'zod'

const baseUrl = import.meta.env.VITE_MUSIC_SERVER_URL ?? ''
const user = import.meta.env.VITE_MUSIC_SERVER_USER ?? ''
const password = import.meta.env.VITE_MUSIC_SERVER_PASSWORD ?? ''

function authHeaders(): HeadersInit {
  return {
    Authorization: `Basic ${btoa(`${user}:${password}`)}`,
  }
}

export function needsAuth(url: string): boolean {
  return baseUrl !== '' && url.startsWith(baseUrl)
}

export async function fetchAudioBlobUrl(url: string): Promise<string> {
  const response = await fetch(url, { headers: authHeaders() })
  const blob = await response.blob()
  return URL.createObjectURL(blob)
}

const serverPlaylistSchema = z.object({
  name: z.string(),
  trackCount: z.number(),
})
export type ServerPlaylist = z.infer<typeof serverPlaylistSchema>

const serverTrackSchema = z.object({
  id: z.coerce.string(),
  title: z.string().nullable(),
  artist: z.string().nullable(),
  album: z.string().nullable(),
  durationMs: z.number(),
  hasCoverArt: z.boolean(),
})
export type ServerTrack = z.infer<typeof serverTrackSchema>

export async function getPlaylists(): Promise<ServerPlaylist[]> {
  const response = await fetch(`${baseUrl}/`, { headers: authHeaders() })
  return z.array(serverPlaylistSchema).parse(await response.json())
}

export async function getTracks(playlistName: string): Promise<ServerTrack[]> {
  const response = await fetch(`${baseUrl}/${encodeURIComponent(playlistName)}`, { headers: authHeaders() })
  return z.array(serverTrackSchema).parse(await response.json())
}

export function getAudioUrl(playlistName: string, trackId: string): string {
  return `${baseUrl}/${encodeURIComponent(playlistName)}/${encodeURIComponent(trackId)}`
}

export function getCoverUrl(playlistName: string, trackId: string): string {
  return `${baseUrl}/${encodeURIComponent(playlistName)}/${encodeURIComponent(trackId)}/cover`
}

export function isConfigured(): boolean {
  return baseUrl !== '' && user !== '' && password !== ''
}
