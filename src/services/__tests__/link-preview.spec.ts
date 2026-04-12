import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '@/db'
import { ensurePreviewRecord, processQueue } from '../link-preview'

beforeEach(async () => {
  await db.linkPreviews.clear()
  vi.restoreAllMocks()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('ensurePreviewRecord', () => {
  it('should create a pending record when none exists', async () => {
    await ensurePreviewRecord('https://anilist.co/anime/123/')

    const record = await db.linkPreviews.get('https://anilist.co/anime/123/')
    expect(record).toBeDefined()
    expect(record!.status).toBe('pending')
    expect(record!.retryCount).toBe(0)
  })

  it('should not overwrite an existing fetched record', async () => {
    const blob = new Blob(['img'], { type: 'image/jpeg' })
    await db.linkPreviews.put({
      url: 'https://anilist.co/anime/123/',
      imageBlob: blob,
      status: 'fetched',
      fetchedAt: 1000,
      retryCount: 0,
    })

    await ensurePreviewRecord('https://anilist.co/anime/123/')

    const record = await db.linkPreviews.get('https://anilist.co/anime/123/')
    expect(record!.status).toBe('fetched')
    expect(record!.fetchedAt).toBe(1000)
  })

  it('should not overwrite an existing error record', async () => {
    await db.linkPreviews.put({
      url: 'https://anilist.co/anime/456/',
      status: 'error',
      error: 'HTTP 500',
      retryCount: 2,
    })

    await ensurePreviewRecord('https://anilist.co/anime/456/')

    const record = await db.linkPreviews.get('https://anilist.co/anime/456/')
    expect(record!.status).toBe('error')
    expect(record!.retryCount).toBe(2)
  })
})

describe('processQueue', () => {
  it('should fetch and store blob for valid anilist URL', async () => {
    const fakeBlob = new Blob(['fake-image'], { type: 'image/jpeg' })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      blob: () => Promise.resolve(fakeBlob),
    }))

    await db.linkPreviews.put({
      url: 'https://anilist.co/anime/12345/',
      status: 'pending',
      retryCount: 0,
    })

    await processQueue()

    const record = await db.linkPreviews.get('https://anilist.co/anime/12345/')
    expect(record!.status).toBe('fetched')
    expect(record!.imageBlob).toBeDefined()
    expect(record!.fetchedAt).toBeGreaterThan(0)
    expect(fetch).toHaveBeenCalledWith(`/api/linkPreview?url=${encodeURIComponent('https://img.anili.st/media/12345')}`)
  })

  it('should mark unsupported host as permanent error', async () => {
    await db.linkPreviews.put({
      url: 'https://example.com/some-page',
      status: 'pending',
      retryCount: 0,
    })

    await processQueue()

    const record = await db.linkPreviews.get('https://example.com/some-page')
    expect(record!.status).toBe('error')
    expect(record!.error).toBe('unsupported host')
    expect(record!.retryCount).toBe(3)
  })

  it('should increment retryCount on fetch failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')))

    await db.linkPreviews.put({
      url: 'https://anilist.co/anime/999/',
      status: 'pending',
      retryCount: 0,
    })

    await processQueue()

    const record = await db.linkPreviews.get('https://anilist.co/anime/999/')
    expect(record!.status).toBe('error')
    expect(record!.error).toBe('Network error')
    expect(record!.retryCount).toBe(1)
    expect(record!.nextRetryAt).toBeGreaterThan(Date.now() - 1000)
  })

  it('should skip error records with nextRetryAt in the future', async () => {
    vi.stubGlobal('fetch', vi.fn())

    await db.linkPreviews.put({
      url: 'https://anilist.co/anime/111/',
      status: 'error',
      retryCount: 1,
      nextRetryAt: Date.now() + 999999,
    })

    await processQueue()

    const record = await db.linkPreviews.get('https://anilist.co/anime/111/')
    expect(record!.retryCount).toBe(1)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('should retry error records with nextRetryAt in the past', async () => {
    const fakeBlob = new Blob(['img'], { type: 'image/jpeg' })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      blob: () => Promise.resolve(fakeBlob),
    }))

    await db.linkPreviews.put({
      url: 'https://anilist.co/anime/222/',
      status: 'error',
      retryCount: 1,
      nextRetryAt: Date.now() - 1000,
    })

    await processQueue()

    const record = await db.linkPreviews.get('https://anilist.co/anime/222/')
    expect(record!.status).toBe('fetched')
  })

  it('should not retry error records that exhausted retries', async () => {
    vi.stubGlobal('fetch', vi.fn())

    await db.linkPreviews.put({
      url: 'https://anilist.co/anime/333/',
      status: 'error',
      retryCount: 3,
      nextRetryAt: Date.now() - 1000,
    })

    await processQueue()

    const record = await db.linkPreviews.get('https://anilist.co/anime/333/')
    expect(record!.retryCount).toBe(3)
    expect(fetch).not.toHaveBeenCalled()
  })
})
