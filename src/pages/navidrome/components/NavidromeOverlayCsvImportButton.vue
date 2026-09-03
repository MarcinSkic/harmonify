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
 * A CSV row only carries `musicBrainzId` as the matching key (see the fallback-key decision in the
 * plan) — no `title`/`albumId`/`discNumber`/`track` to key by. Those identity fields are kept from
 * whatever overlay already exists for this key (falling back to the id itself for a brand-new row)
 * so importing a CSV never blanks out the identity snapshot used for readable exports.
 */
async function importRow(row: OverlayCsvRow) {
  const existing = await LibraryOverlayService.getOverlay(row.musicBrainzId)

  const source: OverlayKeySource & { artist?: string } = {
    musicBrainzId: row.musicBrainzId,
    albumId: existing?.albumId,
    discNumber: existing?.discNumber,
    track: existing?.track,
    title: existing?.title ?? row.musicBrainzId,
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

    toast.success(`Imported ${rows.length}, skipped ${unmapped.length} without musicBrainzId`)

    if (unmapped.length > 0) {
      const shown = unmapped.slice(0, 10).map(u => u.title ?? `row ${u.rowIndex}`)
      const more = unmapped.length > 10 ? ` and ${unmapped.length - 10} more` : ''
      toast.warning(`Skipped rows without a musicBrainzId: ${shown.join(', ')}${more}`)
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
