<script setup lang="ts">
import { FileBraces } from '@lucide/vue'
import { ref } from 'vue'
import { toast } from 'vue-sonner'
import { Button } from '@/components/ui/button'
import { parseCategoriesJSON } from '@/lib/categoryJson'
import { LibraryService } from '@/services'

const jsonInput = ref<HTMLInputElement | null>(null)

async function onFileSelected(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file)
    return

  try {
    const text = await file.text()
    const { rows, errors } = parseCategoriesJSON(text)
    const { created, updated } = await LibraryService.importCategories(rows)

    toast.success(`Imported ${created + updated} categories (${created} created, ${updated} overwritten)`)

    if (errors.length > 0) {
      toast.warning(
        `Skipped ${errors.length} ${errors.length === 1 ? 'entry' : 'entries'}: ${errors.slice(0, 3).map(e => `#${e.index}: ${e.message}`).join(', ')}${errors.length > 3 ? '…' : ''}`,
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
    >Import JSON</span>
  </Button>
</template>
