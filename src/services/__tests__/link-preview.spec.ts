import type { GameResult } from '@/db/schemas'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '@/db'
import { ensurePreviewRecord, processQueue, retryPreview, startupSync } from '../link-preview'

function imageResponse() {
  return {
    ok: true,
    headers: { get: (key: string) => key === 'content-type' ? 'image/jpeg' : null },
    blob: () => Promise.resolve(new Blob(['img'], { type: 'image/jpeg' })),
  }
}

beforeEach(async () => {
  await db.linkPreviews.clear()
  vi.restoreAllMocks()
  // A settling default, so a drain nobody awaits always runs to its end and releases the module's
  // `isRunning` — tests that need another outcome stub `fetch` themselves.
  vi.stubGlobal('fetch', vi.fn(async () => imageResponse()))
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('ensurePreviewRecord', () => {
  it('should create a pending record when none exists', async () => {
    await ensurePreviewRecord('https://img.anili.st/media/123')

    const record = await db.linkPreviews.get('https://img.anili.st/media/123')
    expect(record).toBeDefined()
    expect(record!.status).toBe('pending')
    expect(record!.retryCount).toBe(0)
  })

  it('should not overwrite an existing fetched record', async () => {
    const blob = new Blob(['img'], { type: 'image/jpeg' })
    await db.linkPreviews.put({
      url: 'https://img.anili.st/media/123',
      imageBlob: blob,
      status: 'fetched',
      fetchedAt: 1000,
      retryCount: 0,
    })

    await ensurePreviewRecord('https://img.anili.st/media/123')

    const record = await db.linkPreviews.get('https://img.anili.st/media/123')
    expect(record!.status).toBe('fetched')
    expect(record!.fetchedAt).toBe(1000)
  })

  it('should not overwrite an existing error record', async () => {
    await db.linkPreviews.put({
      url: 'https://example.com/image.jpg',
      status: 'error',
      error: 'HTTP 500',
      retryCount: 2,
    })

    await ensurePreviewRecord('https://example.com/image.jpg')

    const record = await db.linkPreviews.get('https://example.com/image.jpg')
    expect(record!.status).toBe('error')
    expect(record!.retryCount).toBe(2)
  })
})

describe('processQueue', () => {
  it('should fetch and store blob via proxy', async () => {
    const fakeBlob = new Blob(['fake-image'], { type: 'image/jpeg' })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      headers: { get: (key: string) => key === 'content-type' ? 'image/jpeg' : null },
      blob: () => Promise.resolve(fakeBlob),
    }))

    await db.linkPreviews.put({
      url: 'https://img.anili.st/media/12345',
      status: 'pending',
      retryCount: 0,
    })

    await processQueue()

    const record = await db.linkPreviews.get('https://img.anili.st/media/12345')
    expect(record!.status).toBe('fetched')
    expect(record!.imageBlob).toBeDefined()
    expect(record!.fetchedAt).toBeGreaterThan(0)
    expect(fetch).toHaveBeenCalledWith(`/api/linkPreview?url=${encodeURIComponent('https://img.anili.st/media/12345')}`)
  })

  it('should increment retryCount on fetch failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')))

    await db.linkPreviews.put({
      url: 'https://example.com/image.jpg',
      status: 'pending',
      retryCount: 0,
    })

    await processQueue()

    const record = await db.linkPreviews.get('https://example.com/image.jpg')
    expect(record!.status).toBe('error')
    expect(record!.error).toBe('Network error')
    expect(record!.retryCount).toBe(1)
    expect(record!.nextRetryAt).toBeGreaterThan(Date.now() - 1000)
  })

  it('should skip error records with nextRetryAt in the future', async () => {
    vi.stubGlobal('fetch', vi.fn())

    await db.linkPreviews.put({
      url: 'https://example.com/image.jpg',
      status: 'error',
      retryCount: 1,
      nextRetryAt: Date.now() + 999999,
    })

    await processQueue()

    const record = await db.linkPreviews.get('https://example.com/image.jpg')
    expect(record!.retryCount).toBe(1)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('should retry error records with nextRetryAt in the past', async () => {
    const fakeBlob = new Blob(['img'], { type: 'image/jpeg' })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      headers: { get: (key: string) => key === 'content-type' ? 'image/jpeg' : null },
      blob: () => Promise.resolve(fakeBlob),
    }))

    await db.linkPreviews.put({
      url: 'https://example.com/image.jpg',
      status: 'error',
      retryCount: 1,
      nextRetryAt: Date.now() - 1000,
    })

    await processQueue()

    const record = await db.linkPreviews.get('https://example.com/image.jpg')
    expect(record!.status).toBe('fetched')
  })

  it('should drain records queued while the drain is already running', async () => {
    const fakeBlob = new Blob(['img'], { type: 'image/jpeg' })
    let calls = 0
    let callsDuringNestedInvocation: number | null = null

    vi.stubGlobal('fetch', vi.fn(async () => {
      calls += 1
      if (calls === 1) {
        await db.linkPreviews.put({
          url: 'https://example.com/second.jpg',
          status: 'pending',
          retryCount: 0,
        })
        await processQueue()
        callsDuringNestedInvocation = calls
      }
      return {
        ok: true,
        headers: { get: (key: string) => key === 'content-type' ? 'image/jpeg' : null },
        blob: () => Promise.resolve(fakeBlob),
      }
    }))

    await db.linkPreviews.put({
      url: 'https://example.com/first.jpg',
      status: 'pending',
      retryCount: 0,
    })

    await processQueue()

    expect(callsDuringNestedInvocation).toBe(1)
    expect((await db.linkPreviews.get('https://example.com/first.jpg'))!.status).toBe('fetched')
    expect((await db.linkPreviews.get('https://example.com/second.jpg'))!.status).toBe('fetched')
  })

  it('should not retry error records that exhausted retries', async () => {
    vi.stubGlobal('fetch', vi.fn())

    await db.linkPreviews.put({
      url: 'https://example.com/image.jpg',
      status: 'error',
      retryCount: 3,
      nextRetryAt: Date.now() - 1000,
    })

    await processQueue()

    const record = await db.linkPreviews.get('https://example.com/image.jpg')
    expect(record!.retryCount).toBe(3)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('should re-attempt a URL that retryPreview requeues mid-drain', async () => {
    const fakeBlob = new Blob(['img'], { type: 'image/jpeg' })
    let firstUrlAttempts = 0
    let requeued = false

    vi.stubGlobal('fetch', vi.fn(async (input: string) => {
      if (input.includes('a.jpg')) {
        firstUrlAttempts += 1
        if (firstUrlAttempts === 1)
          throw new Error('Network error')
      }
      else if (firstUrlAttempts === 1 && !requeued) {
        // the host hits Retry while the drain is still working through the queue
        requeued = true
        await retryPreview('https://example.com/a.jpg')
      }
      return {
        ok: true,
        headers: { get: (key: string) => key === 'content-type' ? 'image/jpeg' : null },
        blob: () => Promise.resolve(fakeBlob),
      }
    }))

    await db.linkPreviews.bulkPut([
      { url: 'https://example.com/a.jpg', status: 'pending', retryCount: 0 },
      { url: 'https://example.com/b.jpg', status: 'pending', retryCount: 0 },
    ])

    await processQueue()

    expect(requeued).toBe(true)
    expect(firstUrlAttempts).toBe(2)
    expect((await db.linkPreviews.get('https://example.com/a.jpg'))!.status).toBe('fetched')
  })
})

describe('startupSync', () => {
  const OVERLAY_URL = 'https://example.com/overlay.jpg'
  const RESULT_URL = 'https://example.com/result.jpg'
  const LOCAL_GAME_URL = 'https://example.com/frozen.jpg'

  function gameResultWithPreview(url: string): GameResult {
    return {
      id: '11111111-1111-4111-8111-111111111111',
      createdAt: 1,
      finishedAt: 2,
      gameMode: 'random',
      teams: [],
      selectedPlaylists: [],
      rounds: [{
        roundNumber: 1,
        trackId: 'track-1',
        trackSourceId: 'source-1',
        trackName: 'Track',
        trackArtists: ['Artist'],
        albumName: 'Album',
        previewImageUrl: url,
        teamScores: [],
      }],
    }
  }

  beforeEach(async () => {
    await db.trackOverlays.clear()
    await db.gameResults.clear()
    await db.localGames.clear()
  })

  /**
   * `startupSync` fires `processQueue` without awaiting it, so a test that leaves a `pending`
   * record has to wait that drain out — otherwise its `isRunning` swallows the first
   * `processQueue` of whichever test runs next. The queue sleeps `DELAY_BETWEEN_REQUESTS_MS`
   * (200 ms) after its last record before it looks for more work and releases the flag.
   */
  async function waitForDrainToFinish(): Promise<void> {
    await vi.waitFor(async () => {
      expect(await db.linkPreviews.where('status').equals('pending').count()).toBe(0)
    })
    await new Promise(resolve => setTimeout(resolve, 300))
  }

  it('should create a pending record for an overlay URL that has none', async () => {
    // Gated rather than settling on its own: the drain `startupSync` fires waits here, so the
    // record is provably still `pending` when it is read, and it is released before the test ends.
    let releaseFetch = (): void => {}
    const gate = new Promise<void>((resolve) => {
      releaseFetch = resolve
    })
    vi.stubGlobal('fetch', vi.fn(async () => {
      await gate
      return imageResponse()
    }))

    await db.trackOverlays.put({
      id: 'overlay-1',
      title: 'Track',
      playbackRange: null,
      previewImageUrl: OVERLAY_URL,
      enabled: true,
      customFields: {},
      updatedAt: 1,
    })

    await startupSync()

    const record = await db.linkPreviews.get(OVERLAY_URL)
    expect(record).toBeDefined()
    expect(record!.status).toBe('pending')

    releaseFetch()
    await waitForDrainToFinish()
  })

  it('should delete a record nothing points at anymore', async () => {
    await db.linkPreviews.put({
      url: 'https://example.com/orphan.jpg',
      imageBlob: new Blob(['img'], { type: 'image/jpeg' }),
      status: 'fetched',
      fetchedAt: 1,
      retryCount: 0,
    })

    await startupSync()

    expect(await db.linkPreviews.get('https://example.com/orphan.jpg')).toBeUndefined()
  })

  it('should keep a record held only by a saved game result', async () => {
    await db.gameResults.put(gameResultWithPreview(RESULT_URL))
    await db.linkPreviews.put({
      url: RESULT_URL,
      imageBlob: new Blob(['img'], { type: 'image/jpeg' }),
      status: 'fetched',
      fetchedAt: 1,
      retryCount: 0,
    })

    await startupSync()

    expect((await db.linkPreviews.get(RESULT_URL))!.status).toBe('fetched')
  })

  it('should keep a record held only by a frozen Navidrome track of an unfinished game', async () => {
    // Untyped handle on purpose: this is the shape of a game frozen before the migration — no
    // `rounds`, so it exercises the `?? []` fallback alongside `navidromeTracks`.
    await db.table('localGames').put({
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      status: 'playing',
      createdAt: 1,
      navidromeTracks: { 'song-1': { previewImageUrl: LOCAL_GAME_URL } },
    })
    await db.linkPreviews.put({
      url: LOCAL_GAME_URL,
      imageBlob: new Blob(['img'], { type: 'image/jpeg' }),
      status: 'fetched',
      fetchedAt: 1,
      retryCount: 0,
    })

    await startupSync()

    expect((await db.linkPreviews.get(LOCAL_GAME_URL))!.status).toBe('fetched')
  })
})
