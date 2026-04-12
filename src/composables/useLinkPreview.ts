import type { Ref } from 'vue'
import type { LinkPreviewStatus } from '@/db/schemas'
import { computed, ref, watch } from 'vue'
import { db } from '@/db'
import { useLiveQuery } from './useLiveQuery'

export function useLinkPreview(previewPageUrl: Ref<string | undefined>) {
  const preview = useLiveQuery(
    async () => {
      if (!previewPageUrl.value)
        return null
      return await db.linkPreviews.get(previewPageUrl.value) ?? null
    },
    null,
    [previewPageUrl],
  )

  const blobUrl = ref<string | null>(null)

  watch(preview, (record, _, onCleanup) => {
    if (record?.status === 'fetched' && record.imageBlob?.size) {
      const url = URL.createObjectURL(record.imageBlob)
      blobUrl.value = url
      onCleanup(() => URL.revokeObjectURL(url))
    }
    else {
      blobUrl.value = null
    }
  }, { immediate: true })

  const status = computed<LinkPreviewStatus | null>(() => preview.value?.status ?? null)

  return { blobUrl, status }
}
