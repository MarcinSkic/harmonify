import { db } from '@/db'

const MAX_RETRIES = 3
const BACKOFF_BASE_MS = 5000
const DELAY_BETWEEN_REQUESTS_MS = 200

let isRunning = false

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export async function ensurePreviewRecord(url: string): Promise<void> {
  const existing = await db.linkPreviews.get(url)
  if (existing)
    return
  await db.linkPreviews.put({
    url,
    status: 'pending',
    retryCount: 0,
  })
}

export async function processQueue(): Promise<void> {
  if (isRunning)
    return
  isRunning = true
  try {
    const now = Date.now()
    const pending = await db.linkPreviews
      .where('status')
      .equals('pending')
      .toArray()
    const retryable = await db.linkPreviews
      .where('status')
      .equals('error')
      .filter(p => p.retryCount < MAX_RETRIES && (p.nextRetryAt === undefined || p.nextRetryAt <= now))
      .toArray()

    const queue = [...pending, ...retryable]

    for (const preview of queue) {
      try {
        const proxyUrl = `/api/linkPreview?url=${encodeURIComponent(preview.url)}`
        const response = await fetch(proxyUrl)
        if (!response.ok)
          throw new Error(`HTTP ${response.status}`)
        const contentType = response.headers.get('content-type') ?? ''
        if (!contentType.startsWith('image/'))
          throw new Error(`Unexpected content type: ${contentType}`)
        const blob = await response.blob()
        await db.linkPreviews.update(preview.url, {
          imageBlob: blob,
          status: 'fetched' as const,
          fetchedAt: Date.now(),
          error: undefined,
          nextRetryAt: undefined,
        })
      }
      catch (err) {
        const newRetryCount = preview.retryCount + 1
        await db.linkPreviews.update(preview.url, {
          status: 'error' as const,
          error: err instanceof Error ? err.message : 'fetch failed',
          retryCount: newRetryCount,
          nextRetryAt: newRetryCount < MAX_RETRIES
            ? Date.now() + BACKOFF_BASE_MS * 2 ** newRetryCount
            : undefined,
        })
      }

      await delay(DELAY_BETWEEN_REQUESTS_MS)
    }
  }
  finally {
    isRunning = false
  }
}

export async function triggerForUrls(urls: string[]): Promise<void> {
  for (const url of urls)
    await ensurePreviewRecord(url)
  processQueue()
}

export async function retryPreview(url: string): Promise<void> {
  await db.linkPreviews.update(url, {
    status: 'pending' as const,
    retryCount: 0,
    error: undefined,
    nextRetryAt: undefined,
  })
  processQueue()
}

export function startupSync(): void {
  processQueue()
}
