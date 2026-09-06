<script setup lang="ts">
import { Download } from '@lucide/vue'
import { saveAs } from 'file-saver'
import { toast } from 'vue-sonner'
import { Button } from '@/components/ui/button'
import { serializeCategorySetsJSON } from '@/lib/categoryJson'
import { LibraryService } from '@/services'

async function handleExport() {
  try {
    const data = await LibraryService.exportAllCategorySets()
    const json = serializeCategorySetsJSON(data)
    saveAs(new Blob([json], { type: 'application/json' }), 'category-sets.json')
  }
  catch (e) {
    toast.error(e instanceof Error ? e.message : 'JSON export failed')
  }
}
</script>

<template>
  <Button variant="outline" class="gap-2" @click="handleExport">
    <Download class="size-4" />
    <span
      class="
        hidden
        sm:inline
      "
    >Export Sets JSON</span>
  </Button>
</template>
