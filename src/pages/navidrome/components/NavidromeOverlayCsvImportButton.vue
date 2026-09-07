<script setup lang="ts">
import type { OverlayCsvRow } from '@/lib/csv'
import type { OverlayKeySource } from '@/lib/trackOverlayKey'
import { FileSpreadsheet } from '@lucide/vue'
import { ref } from 'vue'
import { toast } from 'vue-sonner'
import { Button } from '@/components/ui/button'
import { parseOverlayCSV } from '@/lib/csv'
import { LibraryOverlayService } from '@/services'

const csvInput = ref<HTMLInputElement | null>(null)

/**
 * A row carries its own key and identity — `parseOverlayCSV` derives the key exactly the way the
 * app does — so the import writes that identity straight from the file instead of guessing it.
 * Fields the sheet leaves out keep the value of the overlay already stored under this key, so a
 * narrow sheet (say, one custom field for a hundred tracks) never blanks the identity snapshot
 * readable exports are built from. That existing overlay was looked up by the key its own identity
 * produced, so those fallbacks can never move the row onto a different key.
 */
async function importRow(row: OverlayCsvRow) {
  const existing = await LibraryOverlayService.getOverlay(row.key)

  const source: OverlayKeySource & { artist?: string } = {
    musicBrainzId: row.identity.musicBrainzId,
    albumId: row.identity.albumId ?? existing?.albumId,
    discNumber: row.identity.discNumber ?? existing?.discNumber,
    track: row.identity.track ?? existing?.track,
    // An overlay must have a title; a row keyed by its MBID need not carry one. The key is the last
    // resort — reachable only for a sheet with no title column, never for our own export.
    title: row.identity.title ?? existing?.title ?? row.key,
    artist: row.artist ?? existing?.artist,
  }

  await LibraryOverlayService.upsertOverlay(source, {
    ...(row.playbackRange !== undefined && { playbackRange: row.playbackRange }),
    ...(row.previewImageUrl !== undefined && { previewImageUrl: row.previewImageUrl }),
    ...(row.enabled !== undefined && { enabled: row.enabled }),
  })

  for (const [name, value] of Object.entries(row.customFields))
    await LibraryOverlayService.setCustomField(source, name, value)
}

async function onCSVFileSelected(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file)
    return

  try {
    const text = await file.text()
    const { rows, unmapped } = parseOverlayCSV(text)

    for (const row of rows)
      await importRow(row)

    // Two ways to match, so two counts: an MBID travels between instances, the composite key of
    // album/disc/track/title only holds as long as those tags stay put.
    const byMusicBrainzId = rows.filter(r => r.identity.musicBrainzId).length
    toast.success(
      `Imported ${byMusicBrainzId} by musicBrainzId, ${rows.length - byMusicBrainzId} by album/track, skipped ${unmapped.length}`,
    )

    if (unmapped.length > 0) {
      const shown = unmapped.slice(0, 10).map(u => u.title ?? `row ${u.rowIndex}`)
      const more = unmapped.length > 10 ? ` and ${unmapped.length - 10} more` : ''
      toast.warning(`Skipped rows with neither a musicBrainzId nor an albumId and title: ${shown.join(', ')}${more}`)
    }
  }
  catch (e) {
    toast.error(e instanceof Error ? e.message : 'CSV import failed')
  }
  finally {
    if (csvInput.value)
      csvInput.value.value = ''
  }
}
</script>

<template>
  <input
    ref="csvInput"
    type="file"
    accept=".csv"
    class="hidden"
    @change="onCSVFileSelected"
  >
  <Button variant="outline" size="sm" class="gap-1.5" @click="csvInput?.click()">
    <FileSpreadsheet class="size-4" />
    <span
      class="
        hidden
        sm:inline
      "
    >Import CSV</span>
  </Button>
</template>
