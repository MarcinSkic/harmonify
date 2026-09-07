import type { VueWrapper } from '@vue/test-utils'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '@/db'
import { LibraryOverlayService } from '@/services'
import NavidromeOverlayCsvImportButton from '../NavidromeOverlayCsvImportButton.vue'

const toast = vi.hoisted(() => ({ success: vi.fn(), warning: vi.fn(), error: vi.fn() }))
vi.mock('vue-sonner', async importOriginal => ({
  ...await importOriginal<typeof import('vue-sonner')>(),
  toast,
}))

let wrapper: VueWrapper | null = null

/** Drives the component the way the user does — the import logic is not exported on its own. */
async function importCSV(lines: string[]) {
  wrapper = mount(NavidromeOverlayCsvImportButton)
  const input = wrapper.find('input[type="file"]')
  Object.defineProperty(input.element, 'files', {
    value: [new File([lines.join('\n')], 'overlay.csv', { type: 'text/csv' })],
    configurable: true,
  })
  await input.trigger('change')
  // Reading the file and every Dexie write resolve well past the next microtask, so the closing
  // toast — the last thing the import does — is what marks the whole run as finished. The error one
  // counts too: a failed import should break the assertion that follows, not time out here.
  await vi.waitFor(() => expect(toast.success.mock.calls.length + toast.error.mock.calls.length).toBeGreaterThan(0))
  await flushPromises()
}

beforeEach(async () => {
  vi.clearAllMocks()
  await db.trackOverlays.clear()
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
})

describe('overlay CSV import', () => {
  it('writes the identity the sheet carries, not the key, as the overlay title', async () => {
    await importCSV([
      'musicBrainzId,albumId,discNumber,track,title,artist,playbackRange',
      'mbid-1,album-1,1,2,Real Title,Real Artist,0:10-0:20',
    ])

    const overlay = await LibraryOverlayService.getOverlay('mbid-1')
    expect(overlay!.title).toBe('Real Title')
    expect(overlay!.artist).toBe('Real Artist')
    expect(overlay!.albumId).toBe('album-1')
    expect(overlay!.discNumber).toBe(1)
    expect(overlay!.track).toBe(2)
    expect(overlay!.playbackRange).toEqual({ startMs: 10000, endMs: 20000 })
  })

  it('imports a row without a musicBrainzId under its composite key', async () => {
    await importCSV([
      'musicBrainzId,albumId,discNumber,track,title,artist,playbackRange,Popularity',
      ',album-1,1,2,No MBID Track,Some Artist,0:10-0:20,7',
    ])

    const overlay = await LibraryOverlayService.getOverlay('album-1|1|2|No MBID Track')
    expect(overlay!.title).toBe('No MBID Track')
    expect(overlay!.musicBrainzId).toBeUndefined()
    expect(overlay!.customFields).toEqual({ Popularity: '7' })
  })

  it('keeps the identity of the stored overlay for fields the sheet does not carry', async () => {
    await LibraryOverlayService.upsertOverlay(
      { musicBrainzId: 'mbid-1', albumId: 'album-1', discNumber: 1, track: 2, title: 'Stored Title', artist: 'Stored Artist' },
      {},
    )

    await importCSV(['musicBrainzId,Popularity', 'mbid-1,9'])

    const overlay = await LibraryOverlayService.getOverlay('mbid-1')
    expect(overlay!.title).toBe('Stored Title')
    expect(overlay!.artist).toBe('Stored Artist')
    expect(overlay!.albumId).toBe('album-1')
    expect(overlay!.customFields).toEqual({ Popularity: '9' })
  })

  it('reports matches by musicBrainzId, matches by composite key and skipped rows separately', async () => {
    await importCSV([
      'musicBrainzId,albumId,discNumber,track,title',
      'mbid-1,album-1,1,2,By MBID',
      ',album-1,1,3,By Composite Key',
      ',,,,Nothing To Key By',
    ])

    expect(toast.success).toHaveBeenCalledWith('Imported 1 by musicBrainzId, 1 by album/track, skipped 1')
    expect(toast.warning).toHaveBeenCalledWith(expect.stringContaining('Nothing To Key By'))
    expect(await LibraryOverlayService.getOverlay('album-1|1|3|By Composite Key')).toBeDefined()
  })
})
