<script setup lang="ts">
import { Download } from '@lucide/vue'
import { saveAs } from 'file-saver'
import { toast } from 'vue-sonner'
import { Button } from '@/components/ui/button'
import { serializeAllCategorySetsCSV } from '@/lib/csv'
import { LibraryService } from '@/services'

async function handleExport() {
  try {
    const data = await LibraryService.exportAllCategorySets()
    const csv = serializeAllCategorySetsCSV(data)
    saveAs(new Blob([csv], { type: 'text/csv' }), 'category-sets.csv')
  }
  catch (e) {
    toast.error(e instanceof Error ? e.message : 'CSV export failed')
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
    >Export Sets CSV</span>
  </Button>
</template>
