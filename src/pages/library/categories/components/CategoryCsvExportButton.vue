<script setup lang="ts">
import { Download } from '@lucide/vue'
import { saveAs } from 'file-saver'
import { toast } from 'vue-sonner'
import { Button } from '@/components/ui/button'
import { serializeCategoriesCSV } from '@/lib/csv'
import { useCategoriesStore } from '@/stores'

const categoriesStore = useCategoriesStore()

function handleExport() {
  try {
    const csv = serializeCategoriesCSV(categoriesStore.categories)
    saveAs(new Blob([csv], { type: 'text/csv' }), 'categories.csv')
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
    >Export CSV</span>
  </Button>
</template>
