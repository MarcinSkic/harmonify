<script setup lang="ts">
import { Download } from '@lucide/vue'
import { saveAs } from 'file-saver'
import { toast } from 'vue-sonner'
import { Button } from '@/components/ui/button'
import { serializeOverlayCSV } from '@/lib/csv'
import { LibraryOverlayService } from '@/services'

async function handleExport() {
  try {
    const overlays = await LibraryOverlayService.getAllOverlays()
    const csv = serializeOverlayCSV(overlays)
    saveAs(new Blob([csv], { type: 'text/csv' }), 'navidrome-overlay.csv')
  }
  catch (e) {
    toast.error(e instanceof Error ? e.message : 'CSV export failed')
  }
}
</script>

<template>
  <Button variant="outline" size="sm" class="gap-1.5" @click="handleExport">
    <Download class="size-4" />
    <span
      class="
        hidden
        sm:inline
      "
    >Export CSV</span>
  </Button>
</template>
