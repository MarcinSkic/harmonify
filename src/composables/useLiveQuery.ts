import type { Ref, WatchSource } from 'vue'
import { liveQuery } from 'dexie'
import { onScopeDispose, shallowRef, watch } from 'vue'

export function useLiveQuery<T>(
  querier: () => T | Promise<T>,
  defaultValue: T,
  deps?: WatchSource[],
): Ref<T> {
  const result = shallowRef<T>(defaultValue)
  let subscription = liveQuery(querier).subscribe({
    next: value => result.value = value,
  })

  if (deps?.length) {
    watch(deps, () => {
      subscription.unsubscribe()
      subscription = liveQuery(querier).subscribe({
        next: value => result.value = value,
      })
    })
  }

  onScopeDispose(() => subscription.unsubscribe())
  return result
}
