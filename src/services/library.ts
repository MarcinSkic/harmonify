import type { Playlist, Track, TrackAnnotation } from '@/db/schemas'
import { db } from '@/db'

type NewPlaylist = Omit<Playlist, 'id' | 'createdAt'>
type NewTrack = Omit<Track, 'id' | 'createdAt'>

// Playlists

export async function addPlaylist(data: NewPlaylist): Promise<string> {
  const id = crypto.randomUUID()
  await db.playlists.add({ ...data, id, createdAt: Date.now() })
  return id
}

export async function updatePlaylist(updatedPlaylistId: string, data: Partial<Omit<Playlist, 'id' | 'createdAt'>>): Promise<void> {
  await db.playlists.update(updatedPlaylistId, data)
}

export async function deletePlaylist(deletedPlaylistId: string): Promise<void> {
  await db.transaction('rw', db.playlists, db.tracks, async () => {
    await db.playlists.delete(deletedPlaylistId)

    const tracksOnDeletedPlaylist = await db.tracks.where('playlistIds').equals(deletedPlaylistId).toArray()
    for (const track of tracksOnDeletedPlaylist) {
      const existingPlaylists = track.playlistIds.filter(playlistId => playlistId !== deletedPlaylistId)
      if (existingPlaylists.length === 0)
        await db.tracks.delete(track.id)
      else
        await db.tracks.update(track.id, { playlistIds: existingPlaylists })
    }
  })
}

export async function getAllPlaylists(): Promise<Playlist[]> {
  return db.playlists.toArray()
}

// Tracks

export async function addTrack(data: NewTrack): Promise<string> {
  const id = crypto.randomUUID()
  await db.tracks.add({ ...data, id, createdAt: Date.now() })
  return id
}

export async function addTracks(tracks: NewTrack[]): Promise<void> {
  const now = Date.now()
  await db.tracks.bulkAdd(
    tracks.map(t => ({ ...t, id: crypto.randomUUID(), createdAt: now })),
  )
}

export async function updateTrack(id: string, data: Partial<Omit<Track, 'id' | 'createdAt'>>): Promise<void> {
  await db.tracks.update(id, data)
}

export async function deleteTrack(id: string): Promise<void> {
  await db.tracks.delete(id)
}

export async function getTracksByPlaylist(playlistId: string): Promise<Track[]> {
  return db.tracks.where('playlistIds').equals(playlistId).toArray()
}

export async function getTracksByTag(tag: string): Promise<Track[]> {
  return db.tracks.where('tags').equals(tag).toArray()
}

export interface CSVApplyResult {
  updated: number
  notFound: string[]
}

export async function applyCSVToPlaylist(
  playlistId: string,
  rows: TrackAnnotation[],
): Promise<CSVApplyResult> {
  const tracks = await db.tracks.where('playlistIds').equals(playlistId).toArray()
  const bySourceId = new Map(tracks.map(t => [t.sourceId, t]))

  const notFound: string[] = []
  let updated = 0

  for (const row of rows) {
    const track = bySourceId.get(row.sourceId)
    if (!track) {
      notFound.push(row.sourceId)
      continue
    }
    await db.tracks.update(track.id, { tags: row.tags, playbackRange: row.playbackRange })
    updated++
  }

  return { updated, notFound }
}

export async function getAllTags(): Promise<string[]> {
  const tracks = await db.tracks.toArray()
  const tags = new Set<string>()
  for (const track of tracks) {
    for (const tag of track.tags)
      tags.add(tag)
  }
  return [...tags].sort()
}
