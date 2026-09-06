<script setup lang="ts">
import { Download } from '@lucide/vue'
import { saveAs } from 'file-saver'
import { toast } from 'vue-sonner'
import { Button } from '@/components/ui/button'
import { serializeCategoriesJSON } from '@/lib/categoryJson'
import { useCategoriesStore } from '@/stores'

const categoriesStore = useCategoriesStore()

function handleExport() {
  try {
    const json = serializeCategoriesJSON(categoriesStore.categories)
    saveAs(new Blob([json], { type: 'application/json' }), 'categories.json')
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
    >Export JSON</span>
  </Button>
</template>
