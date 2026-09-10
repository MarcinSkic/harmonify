import { db } from '@/db'

const MAX_RETRIES = 3
const BACKOFF_BASE_MS = 5000
const DELAY_BETWEEN_REQUESTS_MS = 200

let isRunning = false
let queuedWhileRunning = false
/** URLs already tried in the current drain — see the termination argument in `processQueue`. */
const attempted = new Set<string>()

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
  if (isRunning) {
    queuedWhileRunning = true
    return
  }
  isRunning = true
  attempted.clear()
  try {
    // Writers during a drain (CSV import writes row by row) only flip the flag, so the snapshot is
    // re-taken until nothing new arrives; JS is single-threaded and there is no `await` between the
    // `while` check and `finally { isRunning = false }`, so no write can lose its wakeup in that gap.
    // `attempted` bounds the reruns: a row left `pending` by a failing status update would otherwise
    // spin forever.
    do {
      queuedWhileRunning = false
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

      const queue = [...pending, ...retryable].filter(p => !attempted.has(p.url))

      for (const preview of queue) {
        attempted.add(preview.url)
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
    } while (queuedWhileRunning)
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
  // A manual retry is an explicit decision of the host, so it beats the loop guard — that guard
  // exists for automatic requeues, not for a URL somebody asked for again.
  attempted.delete(url)
  processQueue()
}

/**
 * Every URL the app can still show a preview for. `db.tracks` — the old `/library` slice — is
 * deliberately left out: a preview held by nothing but its tracks gets deleted, so the thumbnail in
 * `src/pages/library/components/TrackRow.vue` disappears after the first start and comes back with
 * a fresh CSV import of that slice. That slice is out of scope for v5.
 */
async function collectReferencedUrls(): Promise<Set<string>> {
  const urls = new Set<string>()
  // `each` rather than `toArray`: only the URLs are wanted, and these tables have a row per track
  // and per played game.
  await db.trackOverlays.each((overlay) => {
    if (overlay.previewImageUrl)
      urls.add(overlay.previewImageUrl)
  })
  await db.gameResults.each((result) => {
    for (const round of result.rounds) {
      if (round.previewImageUrl)
        urls.add(round.previewImageUrl)
    }
  })
  // Games frozen before the Navidrome migration can lack `rounds` and `navidromeTracks` entirely —
  // `localGameSchema` never parses what comes out of Dexie, so defaults do not fire on read.
  await db.localGames.each((game) => {
    for (const round of game.rounds ?? []) {
      if (round.previewImageUrl)
        urls.add(round.previewImageUrl)
    }
    for (const track of Object.values(game.navidromeTracks ?? {})) {
      if (track.previewImageUrl)
        urls.add(track.previewImageUrl)
    }
  })
  return urls
}

/**
 * Reconciles the preview table with what the rest of the database points at: overlays written
 * before previews were queued get their record here, and records nothing points at anymore go.
 */
export async function startupSync(): Promise<void> {
  const referenced = await collectReferencedUrls()
  for (const url of referenced)
    await ensurePreviewRecord(url)

  // Keys only — the rows carry image blobs and there is no reason to load them just to compare.
  const stored = await db.linkPreviews.toCollection().primaryKeys()
  // Second scan, and only URLs unreferenced in both are deleted. An overlay saved while this ran
  // (`upsertOverlay` → `triggerForUrls`) is missing from the first scan, and deleting on that alone
  // would drop the preview the host had just asked for. The rescan is enough without a transaction
  // because the writer stores the overlay row *before* the preview record: a key present in
  // `stored` therefore has its referencing row in place by the time this scan reads it.
  const stillReferenced = await collectReferencedUrls()
  const orphaned = stored.filter(url => !referenced.has(url) && !stillReferenced.has(url))
  if (orphaned.length > 0)
    await db.linkPreviews.bulkDelete(orphaned)

  processQueue()
}
