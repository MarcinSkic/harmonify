<script setup lang="ts">
import { Loader2 } from 'lucide-vue-next'
import Cookies from 'universal-cookie'
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { toast } from 'vue-sonner'
import SpotifyLibraryDisplay from '@/components/spotify/SpotifyLibraryDisplay.vue'
import { Button } from '@/components/ui/button'
import { useLoadSpotifyLibrary } from '@/composables/useLoadSpotifyLibrary'
import { LibraryImportService } from '@/services'
import { useSpotifyLibraryStore } from '@/stores'

const emit = defineEmits<{
  imported: []
}>()

const router = useRouter()
const cookies = new Cookies(null, { path: '/' })
const spotifyLibraryStore = useSpotifyLibraryStore()

const isImporting = ref(false)
const { isLoadError } = useLoadSpotifyLibrary()

async function handleImport() {
  isImporting.value = true
  try {
    const accessToken = cookies.get('access_token')
    const result = await LibraryImportService.importFromSpotify(
      accessToken,
      router,
      spotifyLibraryStore.playlists ?? [],
      spotifyLibraryStore.albums ?? [],
      spotifyLibraryStore.favourites ?? null,
      spotifyLibraryStore.favouritesSelected,
    )
    toast.success(`Imported ${result.trackCount} tracks into ${result.playlistCount} playlists`)
    emit('imported')
  }
  catch {
    toast.error('Import failed')
  }
  finally {
    isImporting.value = false
  }
}
</script>

<template>
  <template v-if="!isLoadError">
    <SpotifyLibraryDisplay v-model:favourites-selected="spotifyLibraryStore.favouritesSelected" />

    <div class="flex justify-end pt-2">
      <Button :disabled="isImporting" @click="handleImport">
        <Loader2 v-if="isImporting" class="size-4 animate-spin" />
        {{ isImporting ? 'Importing...' : 'Import selected' }}
      </Button>
    </div>
  </template>
  <p v-else class="py-4 text-center text-sm text-muted-foreground">
    Could not load Spotify library.
  </p>
</template>
