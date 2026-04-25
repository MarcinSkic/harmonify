<script setup lang="ts">
import { FileSpreadsheet } from '@lucide/vue'
import { ref } from 'vue'
import { toast } from 'vue-sonner'
import { Button } from '@/components/ui/button'
import { parseCategorySetCSV } from '@/lib/csv'
import { LibraryService } from '@/services'

const csvInput = ref<HTMLInputElement | null>(null)

async function onFileSelected(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file)
    return

  try {
    const text = await file.text()
    const { rows, errors } = parseCategorySetCSV(text)
    const result = await LibraryService.importCategorySet(rows)

    toast.success(`Imported ${result.created + result.updated} sets (${result.created} created, ${result.updated} updated)`)

    if (errors.length > 0) {
      toast.warning(
        `Skipped ${errors.length} rows: ${errors.slice(0, 3).map(e => `row ${e.rowIndex}: ${e.message}`).join(', ')}${errors.length > 3 ? '…' : ''}`,
      )
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
    @change="onFileSelected"
  >
  <Button variant="outline" class="gap-2" @click="csvInput?.click()">
    <FileSpreadsheet class="size-4" />
    <span
      class="
        hidden
        sm:inline
      "
    >Import Sets CSV</span>
  </Button>
</template>
