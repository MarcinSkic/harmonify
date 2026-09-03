import type { FrozenNavidromeTrack } from '@/services/navidromeGameSource'
import { describe, expect, it, vi } from 'vitest'
import { toDisplayTrack } from '../navidromeTrack'

vi.mock('@/services', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services')>()
  return {
    ...actual,
    NavidromeService: {
      ...actual.NavidromeService,
      getCoverArtUrl: (id: string) => `cover-url/${id}`,
      getStreamUrl: (id: string) => `stream-url/${id}`,
    },
  }
})

function makeFrozenTrack(overrides: Partial<FrozenNavidromeTrack> = {}): FrozenNavidromeTrack {
  return {
    id: 'song-1',
    overlayKey: 'key-1',
    title: 'Song One',
    playbackRange: null,
    ...overrides,
  }
}

describe('toDisplayTrack', () => {
  it('maps a frozen track into a full Track for the round UI/player', () => {
    const track = toDisplayTrack(makeFrozenTrack({
      artist: 'Artist',
      albumName: 'Album',
      coverArt: 'cover-1',
      durationMs: 180_000,
      playbackRange: { startMs: 1000, endMs: 5000 },
      previewImageUrl: 'https://example.com/preview.png',
    }))

    expect(track).toMatchObject({
      id: 'song-1',
      sourceId: 'song-1',
      name: 'Song One',
      artists: ['Artist'],
      albumName: 'Album',
      albumImageUrl: 'cover-url/cover-1',
      audioUrl: 'stream-url/song-1',
      durationMs: 180_000,
      playbackRange: { startMs: 1000, endMs: 5000 },
      previewImageUrl: 'https://example.com/preview.png',
      tags: [],
      playlistIds: [],
      metadataSource: 'navidrome',
      enabledByPlaylist: {},
    })
  })

  it('falls back to safe defaults for missing optional fields', () => {
    const track = toDisplayTrack(makeFrozenTrack())

    expect(track.artists).toEqual([])
    expect(track.albumName).toBe('')
    expect(track.albumImageUrl).toBeUndefined()
    expect(track.durationMs).toBe(0)
    expect(track.previewImageUrl).toBeUndefined()
  })
})
