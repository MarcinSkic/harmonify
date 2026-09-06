/**
 * Fisher–Yates shuffle. Returns a new array in random order; leaves the input untouched.
 * Shared by `categoryPool.ts` (per-category pools) and `LocalSetupView.vue` (order fed into
 * `applyValuesLimitations`, whose cut depends on input order — main plan §4.3).
 */
export function shuffle<T>(arr: T[]): T[] {
  const result = [...arr]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]]
  }
  return result
}
