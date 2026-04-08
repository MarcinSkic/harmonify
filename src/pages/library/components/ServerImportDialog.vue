<script setup lang="ts">
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import ServerImportContent from './ServerImportContent.vue'

const open = defineModel<boolean>('open', { required: true })
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="flex max-h-[85vh] max-w-2xl flex-col">
      <DialogHeader>
        <DialogTitle>Import from music server</DialogTitle>
        <DialogDescription>Select playlists to import into your library.</DialogDescription>
      </DialogHeader>

      <ServerImportContent v-if="open" @imported="open = false" />
    </DialogContent>
  </Dialog>
</template>
