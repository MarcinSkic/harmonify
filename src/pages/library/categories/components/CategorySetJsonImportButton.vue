<script setup lang="ts">
import { FileBraces } from '@lucide/vue'
import { ref } from 'vue'
import { toast } from 'vue-sonner'
import { Button } from '@/components/ui/button'
import { parseCategorySetsJSON } from '@/lib/categoryJson'
import { LibraryService } from '@/services'

const jsonInput = ref<HTMLInputElement | null>(null)

async function onFileSelected(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file)
    return

  try {
    const text = await file.text()
    const { rows, errors } = parseCategorySetsJSON(text)
    const { created, updated, unchangedSets, unknownCategories } = await LibraryService.importCategorySets(rows)

    toast.success(`Imported ${created + updated} sets (${created} created, ${updated} replaced)`)

    if (errors.length > 0) {
      toast.warning(
        `Skipped ${errors.length} ${errors.length === 1 ? 'entry' : 'entries'}: ${errors.slice(0, 3).map(e => `#${e.index}: ${e.message}`).join(', ')}${errors.length > 3 ? '…' : ''}`,
      )
    }

    if (unknownCategories.length > 0) {
      const names = [...new Set(unknownCategories)]
      toast.warning(
        `Unknown categories, left out of their sets: ${names.slice(0, 3).join(', ')}${names.length > 3 ? '…' : ''}`,
      )
    }

    if (unchangedSets.length > 0) {
      toast.warning(
        `Left untouched because of those unknown categories: ${unchangedSets.slice(0, 3).join(', ')}${unchangedSets.length > 3 ? '…' : ''}`,
      )
    }
  }
  catch (e) {
    toast.error(e instanceof Error ? e.message : 'JSON import failed')
  }
  finally {
    if (jsonInput.value)
      jsonInput.value.value = ''
  }
}
</script>

<template>
  <input
    ref="jsonInput"
    type="file"
    accept=".json,application/json"
    class="hidden"
    @change="onFileSelected"
  >
  <Button variant="outline" class="gap-2" @click="jsonInput?.click()">
    <FileBraces class="size-4" />
    <span
      class="
        hidden
        sm:inline
      "
    >Import Sets JSON</span>
  </Button>
</template>
