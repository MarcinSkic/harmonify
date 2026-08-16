<script setup lang="ts">
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { MusicServerService } from '@/services'
import ServerImportContent from './ServerImportContent.vue'

const open = defineModel<boolean>('open', { required: true })

const baseUrl = MusicServerService.getBaseUrl()
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="flex max-h-[85vh] max-w-3xl flex-col">
      <DialogHeader>
        <DialogTitle>
          Import from music server
          <span v-if="baseUrl" class="text-sm font-normal text-muted-foreground">({{ baseUrl }})</span>
        </DialogTitle>
        <DialogDescription>Select playlists to import into your library.</DialogDescription>
      </DialogHeader>

      <ServerImportContent v-if="open" @imported="open = false" />
    </DialogContent>
  </Dialog>
</template>
