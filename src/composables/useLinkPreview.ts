import type { Ref } from 'vue'
import type { LinkPreviewStatus } from '@/db/schemas'
import { computed, ref, watch } from 'vue'
import { db } from '@/db'
import { useLiveQuery } from './useLiveQuery'

export function useLinkPreview(previewImageUrl: Ref<string | undefined>) {
  const preview = useLiveQuery(
    async () => {
      if (!previewImageUrl.value)
        return null
      return await db.linkPreviews.get(previewImageUrl.value) ?? null
    },
    null,
    [previewImageUrl],
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
