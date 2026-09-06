import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { clearSession, setSession } from '../client'
import { getAlbumSongTags, getPlaylistSongTags, getTagIndex } from '../native'

function nativeResponse(body: unknown, headers: Record<string, string> = {}): Response {
  return {
    status: 200,
    headers: { get: (name: string) => headers[name.toLowerCase()] ?? null },
    json: async () => body,
  } as unknown as Response
}

function stubFetch(response: Response): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn().mockResolvedValue(response)
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

beforeEach(() => {
  setSession({
    baseUrl: 'http://localhost:4533',
    username: 'admin',
    subsonicSalt: 'c19b2d',
    subsonicToken: '26719a1196d2a940705a59634eb18eab',
    jwt: 'jwt',
    serverVersion: '0.54.0',
  })
})

afterEach(() => {
  clearSession()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('getAlbumSongTags', () => {
  it('keys the tag map by song id and asks for the whole album', async () => {
    const fetchMock = stubFetch(nativeResponse([
      { id: 'song-1', tags: { grouping: 'op', genre: ['Anime', 'J-Pop'] } },
      { id: 'song-2' },
    ]))

    const tags = await getAlbumSongTags('album-1')

    expect(fetchMock.mock.calls[0][0]).toBe('http://localhost:4533/api/song?album_id=album-1&_end=0')
    expect(tags.get('song-1')).toEqual({ grouping: ['op'], genre: ['Anime', 'J-Pop'] })
    expect(tags.get('song-2')).toEqual({})
  })
})

describe('getPlaylistSongTags', () => {
  it('keys the tag map by mediaFileId, not by the entry id', async () => {
    const fetchMock = stubFetch(nativeResponse([
      { id: '1', mediaFileId: 'song-42', tags: { grouping: 'ed' } },
      { id: '2', mediaFileId: 'song-7', tags: {} },
    ]))

    const tags = await getPlaylistSongTags('playlist-1')

    expect(fetchMock.mock.calls[0][0]).toBe('http://localhost:4533/api/playlist/playlist-1/tracks?_end=0')
    expect([...tags.keys()]).toEqual(['song-42', 'song-7'])
    expect(tags.get('song-42')).toEqual({ grouping: ['ed'] })
  })

  it('reports a missing mediaFileId as an unsupported shape instead of joining against nothing', async () => {
    stubFetch(nativeResponse([{ id: '1', tags: { grouping: 'ed' } }]))

    await expect(getPlaylistSongTags('playlist-1')).rejects.toMatchObject({ kind: 'unsupportedShape' })
  })
})

describe('getTagIndex', () => {
  it('groups values by tag name, unique and sorted', async () => {
    stubFetch(nativeResponse([
      { id: '1', tagName: 'grouping', tagValue: 'op' },
      { id: '2', tagName: 'grouping', tagValue: 'ed' },
      { id: '3', tagName: 'grouping', tagValue: 'op' },
      { id: '4', tagName: 'work', tagValue: 'Madoka' },
    ]))

    const index = await getTagIndex()

    expect(index.get('grouping')).toEqual(['ed', 'op'])
    expect(index.get('work')).toEqual(['Madoka'])
  })

  it('warns when the row count disagrees with x-total-count', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    stubFetch(nativeResponse([{ id: '1', tagName: 'grouping', tagValue: 'op' }], { 'x-total-count': '7436' }))

    await getTagIndex()

    expect(warn).toHaveBeenCalledOnce()
    expect(warn.mock.calls[0][0]).toContain('1 of 7436')
  })

  it('does not warn when the row count matches the header', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    stubFetch(nativeResponse([{ id: '1', tagName: 'grouping', tagValue: 'op' }], { 'x-total-count': '1' }))

    await getTagIndex()

    expect(warn).not.toHaveBeenCalled()
  })
})
