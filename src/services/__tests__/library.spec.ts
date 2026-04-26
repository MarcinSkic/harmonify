import type { Track } from '@/db/schemas'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '@/db'
import { LibraryService } from '../.'

function makeTrack(overrides: Partial<Omit<Track, 'id' | 'createdAt'>> = {}): Omit<Track, 'id' | 'createdAt'> {
  return {
    sourceId: 'src-1',
    name: 'Test Track',
    artists: ['Artist A'],
    durationMs: 180000,
    albumName: 'Album X',
    tags: [],
    playlistIds: [],
    metadataSource: 'manual',
    playbackRange: null,
    enabledByPlaylist: {},
    ...overrides,
  }
}

beforeEach(async () => {
  await db.tracks.clear()
  await db.playlists.clear()
})

describe('playlists', () => {
  it('should add and retrieve a playlist', async () => {
    const id = await LibraryService.addPlaylist({ name: 'My Playlist', source: 'manual' })
    const playlists = await LibraryService.getAllPlaylists()
    expect(playlists).toHaveLength(1)
    expect(playlists[0].id).toBe(id)
    expect(playlists[0].name).toBe('My Playlist')
    expect(playlists[0].source).toBe('manual')
    expect(playlists[0].createdAt).toBeGreaterThan(0)
  })

  it('should update a playlist', async () => {
    const id = await LibraryService.addPlaylist({ name: 'Old', source: 'manual' })
    await LibraryService.updatePlaylist(id, { name: 'New' })
    const playlists = await LibraryService.getAllPlaylists()
    expect(playlists[0].name).toBe('New')
  })

  it('should delete a playlist and clean up track references', async () => {
    const playlistId = await LibraryService.addPlaylist({ name: 'To Delete', source: 'manual' })
    const otherPlaylistId = await LibraryService.addPlaylist({ name: 'Other', source: 'manual' })

    await LibraryService.addTrack(makeTrack({ name: 'Track in both', playlistIds: [playlistId, otherPlaylistId] }))
    await LibraryService.addTrack(makeTrack({ name: 'Track only in deleted', playlistIds: [playlistId] }))

    await LibraryService.deletePlaylist(playlistId)

    const playlists = await LibraryService.getAllPlaylists()
    expect(playlists).toHaveLength(1)
    expect(playlists[0].name).toBe('Other')

    const tracks = await db.tracks.toArray()
    expect(tracks).toHaveLength(1)
    expect(tracks[0].name).toBe('Track in both')
    expect(tracks[0].playlistIds).toEqual([otherPlaylistId])
  })
})

describe('tracks', () => {
  it('should add and retrieve a track', async () => {
    const id = await LibraryService.addTrack(makeTrack({ name: 'My Track' }))
    const track = await db.tracks.get(id)
    expect(track).toBeDefined()
    expect(track!.name).toBe('My Track')
    expect(track!.createdAt).toBeGreaterThan(0)
  })

  it('should bulk add tracks', async () => {
    await LibraryService.addTracks([
      makeTrack({ name: 'Track 1', sourceId: 'a' }),
      makeTrack({ name: 'Track 2', sourceId: 'b' }),
      makeTrack({ name: 'Track 3', sourceId: 'c' }),
    ])
    const tracks = await db.tracks.toArray()
    expect(tracks).toHaveLength(3)
  })

  it('should update a track', async () => {
    const id = await LibraryService.addTrack(makeTrack())
    await LibraryService.updateTrack(id, { name: 'Updated' })
    const track = await db.tracks.get(id)
    expect(track!.name).toBe('Updated')
  })

  it('should delete a track', async () => {
    const id = await LibraryService.addTrack(makeTrack())
    await LibraryService.deleteTrack(id)
    const track = await db.tracks.get(id)
    expect(track).toBeUndefined()
  })

  it('should query tracks by playlist', async () => {
    const playlistId = await LibraryService.addPlaylist({ name: 'P1', source: 'manual' })
    const otherId = await LibraryService.addPlaylist({ name: 'P2', source: 'manual' })

    await LibraryService.addTrack(makeTrack({ name: 'In P1', playlistIds: [playlistId], sourceId: 'a' }))
    await LibraryService.addTrack(makeTrack({ name: 'In P2', playlistIds: [otherId], sourceId: 'b' }))
    await LibraryService.addTrack(makeTrack({ name: 'In both', playlistIds: [playlistId, otherId], sourceId: 'c' }))

    const tracks = await LibraryService.getTracksByPlaylist(playlistId)
    expect(tracks).toHaveLength(2)
    expect(tracks.map(t => t.name).sort()).toEqual(['In P1', 'In both'])
  })

  it('should query tracks by tag', async () => {
    await LibraryService.addTrack(makeTrack({ name: 'Tagged', tags: ['rock', 'metal'], sourceId: 'a' }))
    await LibraryService.addTrack(makeTrack({ name: 'Other', tags: ['pop'], sourceId: 'b' }))

    const rockTracks = await LibraryService.getTracksByTag('rock')
    expect(rockTracks).toHaveLength(1)
    expect(rockTracks[0].name).toBe('Tagged')
  })
})

describe('tags', () => {
  it('should return all unique tags sorted', async () => {
    await LibraryService.addTrack(makeTrack({ tags: ['rock', 'metal'], sourceId: 'a' }))
    await LibraryService.addTrack(makeTrack({ tags: ['pop', 'rock'], sourceId: 'b' }))

    const tags = await LibraryService.getAllTags()
    expect(tags).toEqual(['metal', 'pop', 'rock'])
  })

  it('should return empty array when no tracks', async () => {
    const tags = await LibraryService.getAllTags()
    expect(tags).toEqual([])
  })
})
