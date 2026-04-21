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
})
