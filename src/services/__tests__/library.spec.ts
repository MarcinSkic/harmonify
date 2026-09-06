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

describe('importCategories', () => {
  beforeEach(async () => {
    await db.categories.clear()
  })

  it('overwrites a category stored under the same display name and clears fields the file drops', async () => {
    await db.categories.add({
      id: crypto.randomUUID(),
      displayName: 'OST',
      match: { all: [{ is: { grouping: 'ost' } }] },
      description: 'old',
      points: 5,
      createdAt: 1,
    })

    const result = await LibraryService.importCategories([
      { displayName: 'OST', match: { any: [{ gt: { popularity: 2 } }] } },
      { displayName: 'Anime OP', match: { all: [{ is: { grouping: 'op' } }] }, points: 10 },
    ])

    expect(result).toEqual({ created: 1, updated: 1 })

    const stored = await LibraryService.getAllCategories()
    const overwritten = stored.find(c => c.displayName === 'OST')!
    expect(overwritten.match).toEqual({ any: [{ gt: { popularity: 2 } }] })
    expect(overwritten.points).toBeUndefined()
    expect(overwritten.description).toBeUndefined()
    // The row keeps its identity, so category set members still point at it.
    expect(overwritten.createdAt).toBe(1)
    expect(stored.find(c => c.displayName === 'Anime OP')!.points).toBe(10)
  })
})

describe('setCategorySetValueLimitations', () => {
  beforeEach(async () => {
    await db.categorySets.clear()
  })

  it('rejects a duplicate name with an error and leaves the stored row unchanged', async () => {
    const id = await LibraryService.addCategorySet('Konkurs')

    await expect(LibraryService.setCategorySetValueLimitations(id, [
      { name: 'work', selfLimit: 3 },
      { name: 'work', selfLimit: 1 },
    ])).rejects.toThrow(/work/)

    const stored = (await db.categorySets.get(id))!
    expect(stored.valueLimitations).toEqual([])
  })

  it('rejects a duplicate pair limit name inside one entry and leaves the stored row unchanged', async () => {
    const id = await LibraryService.addCategorySet('Konkurs')

    await expect(LibraryService.setCategorySetValueLimitations(id, [
      {
        name: 'work',
        selfLimit: 3,
        otherValuesLimit: [
          { name: 'grouping', limit: 1 },
          { name: 'grouping', limit: 2 },
        ],
      },
    ])).rejects.toThrow(/grouping/)

    const stored = (await db.categorySets.get(id))!
    expect(stored.valueLimitations).toEqual([])
  })

  it('sorts the stored entries by name regardless of input order', async () => {
    const id = await LibraryService.addCategorySet('Konkurs')

    await LibraryService.setCategorySetValueLimitations(id, [
      { name: 'work', selfLimit: 3 },
      { name: 'album', selfLimit: 2 },
      { name: 'grouping', selfLimit: 1 },
    ])

    const stored = (await db.categorySets.get(id))!
    expect(stored.valueLimitations.map(l => l.name)).toEqual(['album', 'grouping', 'work'])
  })
})

describe('setCategorySetMinDistances', () => {
  beforeEach(async () => {
    await db.categorySets.clear()
  })

  it('rejects a duplicate name with an error and leaves the stored row unchanged', async () => {
    const id = await LibraryService.addCategorySet('Konkurs')

    await expect(LibraryService.setCategorySetMinDistances(id, [
      { name: 'work', distance: 5 },
      { name: 'work', distance: 2 },
    ])).rejects.toThrow(/work/)

    const stored = (await db.categorySets.get(id))!
    expect(stored.minDistances).toEqual([])
  })

  it('sorts the stored entries by name regardless of input order', async () => {
    const id = await LibraryService.addCategorySet('Konkurs')

    await LibraryService.setCategorySetMinDistances(id, [
      { name: 'work', distance: 5 },
      { name: 'album', distance: 2 },
      { name: 'grouping', distance: 4 },
    ])

    const stored = (await db.categorySets.get(id))!
    expect(stored.minDistances.map(d => d.name)).toEqual(['album', 'grouping', 'work'])
  })
})

describe('importCategorySets', () => {
  beforeEach(async () => {
    await db.categorySets.clear()
    await db.categorySetMembers.clear()
  })

  it('replaces both rule arrays of an existing set with what the file says', async () => {
    // An import is an overwrite, and it has to overwrite both arrays: replacing only the
    // proportions would leave the set as a mix of the file's limits and the spacing it had before.
    const id = await LibraryService.addCategorySet('Konkurs')
    await LibraryService.setCategorySetValueLimitations(id, [{ name: 'work', selfLimit: 3 }])
    await LibraryService.setCategorySetMinDistances(id, [{ name: 'work', distance: 5 }])

    // No category names in the row, so this cannot land in the "unknown category, leave the set
    // alone" branch — the set really is rewritten here.
    const result = await LibraryService.importCategorySets([{
      name: 'Konkurs',
      categories: [],
      valueLimitations: [{ name: 'album', selfLimit: 1 }],
      minDistances: [{ name: 'album', distance: 3 }],
    }])

    expect(result.created).toBe(0)
    expect(result.updated).toBe(1)
    expect(result.unchangedSets).toEqual([])

    const stored = (await db.categorySets.get(id))!
    expect(stored.valueLimitations).toEqual([{ name: 'album', selfLimit: 1 }])
    expect(stored.minDistances).toEqual([{ name: 'album', distance: 3 }])
  })

  it('carries the distances of a new set in from the file', async () => {
    const result = await LibraryService.importCategorySets([{
      name: 'Fresh',
      categories: [],
      valueLimitations: [],
      minDistances: [{ name: 'work', distance: 5 }],
    }])

    expect(result.created).toBe(1)

    const stored = (await db.categorySets.where('name').equals('Fresh').first())!
    expect(stored.minDistances).toEqual([{ name: 'work', distance: 5 }])
  })
})
