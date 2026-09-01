import { toast } from 'vue-sonner'
import { NavidromeService } from '@/services'

/**
 * A `NavidromeError` already carries a message telling the user what to fix. Anything else (a Zod
 * mismatch on a Subsonic payload, a bug) goes to the console and reaches the user as the caller's
 * generic message — a raw validation dump helps nobody.
 */
export function reportNavidromeError(error: unknown, fallbackMessage: string): void {
  console.error(error)
  toast.error(error instanceof NavidromeService.NavidromeError ? error.message : fallbackMessage)
}

/** Out of the tested range means a warning, never a block — called once per connection path. */
export function warnAboutUntestedVersion(version: string): void {
  if (!version || NavidromeService.isVersionTested(version))
    return

  const { min, maxExclusive } = NavidromeService.NAVIDROME_TESTED_RANGE
  toast.warning(
    `Navidrome ${version} is outside the tested range (${min} up to but excluding ${maxExclusive}). `
    + 'Harmonify keeps working, but the native API may have changed.',
  )
}
