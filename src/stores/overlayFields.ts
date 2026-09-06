import type { OverlayField } from '@/db/schemas'
import { defineStore } from 'pinia'
import { useLiveQuery } from '@/composables/useLiveQuery'
import { LibraryOverlayService } from '@/services'

export const useOverlayFieldsStore = defineStore('overlayFields', () => {
  const overlayFields = useLiveQuery(
    () => LibraryOverlayService.listOverlayFields(),
    [] as OverlayField[],
  )

  async function upsert(name: string, type: OverlayField['type']) {
    return LibraryOverlayService.upsertOverlayField(name, type)
  }

  async function remove(name: string) {
    return LibraryOverlayService.deleteOverlayField(name)
  }

  return {
    overlayFields,
    upsert,
    remove,
  }
})
