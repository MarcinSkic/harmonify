import type { RemovableRef } from '@vueuse/core'
import type { Cover } from '../types/'
import { useStorage } from '@vueuse/core'
import { defineStore } from 'pinia'
import { LOCAL_STORAGE } from '@/consts'

export const useCoversStore = defineStore('covers', {
  state: (): {
    savedCovers: RemovableRef<Cover[]>
  } => {
    return {
      savedCovers: useStorage<Cover[]>(LOCAL_STORAGE.SAVED_COVERS, []),
    }
  },
})
