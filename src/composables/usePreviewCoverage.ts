import type { Ref } from 'vue'
import { db } from '@/db'
import { useLiveQuery } from './useLiveQuery'

export interface PreviewCoverage {
  total: number
  ready: number
  pending: number
  failed: number
}

/**
 * How far the cover previews for `urls` have got — live, because `useLiveQuery` re-runs the count
 * as blobs land in the table.
 *
 * Read through `primaryKeys()` on the `status` index rather than `bulkGet(urls)`: the rows carry
 * `imageBlob`, and a pool of two hundred covers would be materialized in full on every
 * re-subscription just to be reduced to four numbers.
 *
 * `pending` is what is left over — a URL with no row yet is the gap between `triggerForUrls` and
 * its write, so counting it as pending keeps the counter monotonic instead of flashing "0 of N"
 * before the records exist. Every `error` counts as failed, including the ones the queue will still
 * retry on its own: the count corrects itself live when a retry succeeds, and the alternative is
 * reverse-engineering the service's retry budget out of a stored record.
 *
 * Counted per distinct URL: two tracks sharing a cover are one fetch, so they must not read as two.
 */
export function usePreviewCoverage(urls: Ref<string[]>): Ref<PreviewCoverage> {
  return useLiveQuery<PreviewCoverage>(
    async () => {
      const wanted = new Set(urls.value)
      const total = wanted.size
      if (total === 0)
        return { total: 0, ready: 0, pending: 0, failed: 0 }

      const fetched = await db.linkPreviews.where('status').equals('fetched').primaryKeys()
      const errored = await db.linkPreviews.where('status').equals('error').primaryKeys()

      const ready = fetched.filter(url => wanted.has(url)).length
      const failed = errored.filter(url => wanted.has(url)).length

      return { total, ready, pending: total - ready - failed, failed }
    },
    { total: 0, ready: 0, pending: 0, failed: 0 },
    [urls],
  )
}
