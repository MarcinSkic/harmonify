import type { TrackOverlay } from '@/db/schemas'
import type { SubsonicSong } from '@/services/navidrome'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { deriveOverlayKey } from '@/lib/trackOverlayKey'
import { materializePool } from '../navidromeGameSource'

const getAlbum = vi.fn()
const getPlaylist = vi.fn()
const getOverlaysByKeys = vi.fn()

vi.mock('@/services', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services')>()
  return {
    ...actual,
    NavidromeService: {
      ...actual.NavidromeService,
      getAlbum: (id: string) => getAlbum(id),
      getPlaylist: (id: string) => getPlaylist(id),
    },
    LibraryOverlayService: {
      ...actual.LibraryOverlayService,
      getOverlaysByKeys: (keys: string[]) => getOverlaysByKeys(keys),
    },
  }
})

function makeSong(overrides: Partial<SubsonicSong> = {}): SubsonicSong {
  return {
    id: 'song-1',
    title: 'Song One',
    artist: 'Artist',
    album: 'Album',
    albumId: 'album-1',
    discNumber: 1,
    track: 1,
    duration: 200,
    coverArt: 'cover-1',
    ...overrides,
  }
}

function makeOverlay(overrides: Partial<TrackOverlay> = {}): TrackOverlay {
  return {
    id: 'key',
    title: 'Song One',
    playbackRange: null,
    enabled: true,
    customFields: {},
    updatedAt: 1,
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  getOverlaysByKeys.mockResolvedValue(new Map())
})

describe('materializePool', () => {
  it('dedups a track present in two selected sources', async () => {
    const song = makeSong({ id: 'song-1' })
    getAlbum.mockResolvedValue({ album: { id: 'album-1', name: 'Album' }, songs: [song] })
    getPlaylist.mockResolvedValue({ playlist: { id: 'playlist-1', name: 'Playlist' }, songs: [song] })

    const pool = await materializePool([
      { type: 'album', id: 'album-1', name: 'Album' },
      { type: 'playlist', id: 'playlist-1', name: 'Playlist' },
    ])

    expect(pool).toHaveLength(1)
    expect(pool[0].id).toBe('song-1')
  })

  it('excludes tracks whose overlay has enabled: false', async () => {
    const enabledSong = makeSong({ id: 'song-1', title: 'Enabled Song' })
    const disabledSong = makeSong({ id: 'song-2', title: 'Disabled Song' })
    getAlbum.mockResolvedValue({ album: { id: 'album-1', name: 'Album' }, songs: [enabledSong, disabledSong] })

    const disabledKey = deriveOverlayKey({
      musicBrainzId: disabledSong.musicBrainzId,
      albumId: disabledSong.albumId,
      discNumber: disabledSong.discNumber,
      track: disabledSong.track,
      title: disabledSong.title,
    })
    getOverlaysByKeys.mockResolvedValue(new Map([
      [disabledKey, makeOverlay({ id: disabledKey, title: 'Disabled Song', enabled: false })],
    ]))

    const pool = await materializePool([{ type: 'album', id: 'album-1', name: 'Album' }])

    expect(pool.map(t => t.id)).toEqual(['song-1'])
  })

  it('applies playbackRange/previewImageUrl from the overlay when present', async () => {
    const song = makeSong({ id: 'song-1' })
    getAlbum.mockResolvedValue({ album: { id: 'album-1', name: 'Album' }, songs: [song] })

    const key = deriveOverlayKey({
      musicBrainzId: song.musicBrainzId,
      albumId: song.albumId,
      discNumber: song.discNumber,
      track: song.track,
      title: song.title,
    })
    getOverlaysByKeys.mockResolvedValue(new Map([
      [key, makeOverlay({
        id: key,
        title: song.title,
        playbackRange: { startMs: 5000, endMs: 15000 },
        previewImageUrl: 'https://example.com/preview.png',
      })],
    ]))

    const pool = await materializePool([{ type: 'album', id: 'album-1', name: 'Album' }])

    expect(pool[0].playbackRange).toEqual({ startMs: 5000, endMs: 15000 })
    expect(pool[0].previewImageUrl).toBe('https://example.com/preview.png')
  })

  it('falls back to default values (null playbackRange, undefined previewImageUrl) when there is no overlay', async () => {
    const song = makeSong({ id: 'song-1' })
    getAlbum.mockResolvedValue({ album: { id: 'album-1', name: 'Album' }, songs: [song] })

    const pool = await materializePool([{ type: 'album', id: 'album-1', name: 'Album' }])

    expect(pool).toHaveLength(1)
    expect(pool[0].playbackRange).toBeNull()
    expect(pool[0].previewImageUrl).toBeUndefined()
  })
})
