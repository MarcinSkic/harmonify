<script setup lang="ts">
import { FileSpreadsheet } from '@lucide/vue'
import { ref } from 'vue'
import { toast } from 'vue-sonner'
import { Button } from '@/components/ui/button'
import { parseCSV } from '@/lib/csv'
import { LibraryService } from '@/services'
import { useLibraryStore } from '@/stores'

const libraryStore = useLibraryStore()
const csvInput = ref<HTMLInputElement | null>(null)

async function onCSVFileSelected(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file || !libraryStore.selectedPlaylistId)
    return

  try {
    const text = await file.text()
    const rows = parseCSV(text)
    const result = await LibraryService.applyCSVToPlaylist(libraryStore.selectedPlaylistId, rows)

    toast.success(`Updated ${result.updated} tracks`)

    if (result.notFound.length > 0)
      toast.warning(`${result.notFound.length} rows not matched: ${result.notFound.slice(0, 5).join(', ')}${result.notFound.length > 5 ? '…' : ''}`)
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
  <Button variant="outline" class="gap-2" @click="csvInput?.click()">
    <FileSpreadsheet class="size-4" />
    <span
      class="
        hidden
        sm:inline
      "
    >CSV</span>
  </Button>
</template>
