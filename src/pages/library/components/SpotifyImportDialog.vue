<script setup lang="ts">
import { useCookies } from '@vueuse/integrations/useCookies'
import { computed } from 'vue'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import SpotifyImportContent from './SpotifyImportContent.vue'

const open = defineModel<boolean>('open', { required: true })

const cookies = useCookies()
const isLoggedIn = computed(() => !!cookies.get('access_token') || !!cookies.get('refresh_token'))

function connectToSpotify() {
  window.location.href = '/api/token/request'
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="flex max-h-[85vh] max-w-2xl flex-col">
      <DialogHeader>
        <DialogTitle>Import from Spotify</DialogTitle>
        <DialogDescription>Select playlists and albums to import into your library.</DialogDescription>
      </DialogHeader>

      <template v-if="isLoggedIn">
        <SpotifyImportContent v-if="open" @imported="open = false" />
      </template>
      <div v-else class="flex flex-col items-center gap-4 py-8">
        <img alt="Spotify logo" src="@/assets/Spotify_Logo_RGB_White.png" width="140">
        <p class="text-sm text-muted-foreground">
          Connect your Spotify account to import playlists and albums.
        </p>
        <Button @click="connectToSpotify">
          Connect to Spotify
        </Button>
      </div>
    </DialogContent>
  </Dialog>
</template>
