import type { Category, Playlist, Track, TrackAnnotation } from '@/db/schemas'
import { db } from '@/db'

type NewPlaylist = Omit<Playlist, 'id' | 'createdAt'>
type NewTrack = Omit<Track, 'id' | 'createdAt'>
type NewCategory = Omit<Category, 'id' | 'createdAt' | 'order'>

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
  previewUrls: string[]
}

export async function applyCSVToPlaylist(
  playlistId: string,
  rows: TrackAnnotation[],
): Promise<CSVApplyResult> {
  const tracks = await db.tracks.where('playlistIds').equals(playlistId).toArray()
  const bySourceId = new Map(tracks.map(t => [t.sourceId, t]))

  const notFound: string[] = []
  const previewUrlSet = new Set<string>()
  let updated = 0

  for (const row of rows) {
    const track = bySourceId.get(row.sourceId)
    if (!track) {
      notFound.push(row.sourceId)
      continue
    }
    const updateData: Partial<Track> = { tags: row.tags, playbackRange: row.playbackRange }
    if (row.enabled !== undefined)
      updateData.enabled = row.enabled
    if (row.previewImageUrl !== undefined) {
      updateData.previewImageUrl = row.previewImageUrl
      previewUrlSet.add(row.previewImageUrl)
    }
    await db.tracks.update(track.id, updateData)
    updated++
  }

  return { updated, notFound, previewUrls: [...previewUrlSet] }
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

// Categories

export async function addCategory(data: NewCategory): Promise<string> {
  const id = crypto.randomUUID()
  await db.transaction('rw', db.categories, async () => {
    const existing = await db.categories.toArray()
    const maxOrder = existing.reduce((acc, c) => Math.max(acc, c.order), -1)
    await db.categories.add({
      ...data,
      id,
      order: maxOrder + 1,
      createdAt: Date.now(),
    })
  })
  return id
}

export async function updateCategory(
  id: string,
  data: Partial<Omit<Category, 'id' | 'createdAt'>>,
): Promise<void> {
  await db.categories.update(id, data)
}

export async function deleteCategory(id: string): Promise<void> {
  await db.categories.delete(id)
}

export async function getAllCategories(): Promise<Category[]> {
  const categories = await db.categories.toArray()
  return categories.sort((a, b) => {
    if (a.order !== b.order)
      return a.order - b.order
    return a.createdAt - b.createdAt
  })
}

export async function moveCategory(
  id: string,
  direction: 'up' | 'down',
): Promise<void> {
  await db.transaction('rw', db.categories, async () => {
    const sorted = (await db.categories.toArray()).sort((a, b) => {
      if (a.order !== b.order)
        return a.order - b.order
      return a.createdAt - b.createdAt
    })
    const index = sorted.findIndex(c => c.id === id)
    if (index === -1)
      return
    const swapIndex = direction === 'up' ? index - 1 : index + 1
    if (swapIndex < 0 || swapIndex >= sorted.length)
      return

    const current = sorted[index]
    const neighbor = sorted[swapIndex]
    await db.categories.update(current.id, { order: neighbor.order })
    await db.categories.update(neighbor.id, { order: current.order })
  })
}

export async function countTracksMatchingTagFilter(
  tagFilter: string[],
): Promise<number> {
  if (tagFilter.length === 0)
    return 0
  const matchedIds = new Set<string>()
  const tracks = await db.tracks.where('tags').anyOf(tagFilter).toArray()
  for (const track of tracks) {
    if (track.enabled !== false)
      matchedIds.add(track.id)
  }
  return matchedIds.size
}
