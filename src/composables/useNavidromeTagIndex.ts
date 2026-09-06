import { computed, ref } from 'vue'
import { reportNavidromeError } from '@/lib/navidrome'
import { NavidromeService } from '@/services'
import { useNavidromeStore } from '@/stores'

/**
 * Navidrome's tag names and their values, used to suggest fields and operands while editing a
 * category predicate.
 *
 * `/api/tag` answers in one unpaginated call, so it is fetched once per scope on demand (never per
 * keystroke) and kept. Without a session, or when the call fails, the suggestions stay empty and
 * the editor keeps working on free text — a category may name a field Navidrome does not know yet.
 */
export function useNavidromeTagIndex() {
  const navidromeStore = useNavidromeStore()

  const tagIndex = ref<Map<string, string[]>>(new Map())
  const isLoading = ref(false)
  let hasLoaded = false

  const tagNames = computed(() => [...tagIndex.value.keys()])

  function valuesFor(tagName: string): string[] {
    return tagIndex.value.get(tagName) ?? []
  }

  async function load(): Promise<void> {
    if (hasLoaded || isLoading.value || !navidromeStore.isConnected)
      return

    isLoading.value = true

    try {
      tagIndex.value = await NavidromeService.getTagIndex()
      hasLoaded = true
    }
    catch (error) {
      reportNavidromeError(error, 'Failed to load Navidrome tags')
      navidromeStore.reportSessionError(error)
    }
    finally {
      isLoading.value = false
    }
  }

  return {
    tagIndex,
    tagNames,
    isLoading,
    valuesFor,
    load,
  }
}
