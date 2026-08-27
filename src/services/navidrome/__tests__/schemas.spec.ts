import { describe, expect, it } from 'vitest'
import { nativeSongSchema, subsonicAlbumListSchema, subsonicPlaylistsSchema } from '../schemas'

describe('nativeSongSchema', () => {
  it('should normalize a missing tags field to an empty map', () => {
    // Navidrome serializes `tags` with `omitempty`, so an untagged song has no such field at all.
    const song = nativeSongSchema.parse({ id: 'abc', title: 'Colors' })

    expect(song.tags).toEqual({})
  })

  it('should normalize a single tag value to a list', () => {
    const song = nativeSongSchema.parse({ id: 'abc', tags: { grouping: 'op' } })

    expect(song.tags.grouping).toEqual(['op'])
  })

  it('should keep a multi-valued tag as a list', () => {
    const song = nativeSongSchema.parse({ id: 'abc', tags: { grouping: ['op', 'insert'] } })

    expect(song.tags.grouping).toEqual(['op', 'insert'])
  })

  it('should keep unknown fields from a newer server', () => {
    const song = nativeSongSchema.parse({ id: 'abc', somethingNew: 42 })

    expect(song.id).toBe('abc')
  })

  it('should fail on a foreign response shape', () => {
    expect(nativeSongSchema.safeParse({ hello: 'world' }).success).toBe(false)
    expect(nativeSongSchema.safeParse({ id: 'abc', tags: { grouping: [1, 2] } }).success).toBe(false)
  })
})

describe('subsonic collection schemas', () => {
  it('should accept an album list without the album field', () => {
    const parsed = subsonicAlbumListSchema.parse({ albumList2: {} })

    expect(parsed.albumList2.album).toBeUndefined()
  })

  it('should accept a playlists response without the playlist field', () => {
    const parsed = subsonicPlaylistsSchema.parse({ playlists: {} })

    expect(parsed.playlists.playlist).toBeUndefined()
  })
})
