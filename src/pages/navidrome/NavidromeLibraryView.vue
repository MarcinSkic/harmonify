<script setup lang="ts">
import type { SubsonicAlbum, SubsonicPlaylist, SubsonicSong } from '@/services/navidrome'
import { ArrowLeft, Home } from '@lucide/vue'
import { computed, ref } from 'vue'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useLoadNavidromeLibrary } from '@/composables/useLoadNavidromeLibrary'
import { reportNavidromeError } from '@/lib/navidrome'
import { NavidromeService } from '@/services'
import { useNavidromeStore } from '@/stores'
import NavidromeAlbumGrid from './components/NavidromeAlbumGrid.vue'
import NavidromeAudioPreview from './components/NavidromeAudioPreview.vue'
import NavidromeOverlayCsvExportButton from './components/NavidromeOverlayCsvExportButton.vue'
import NavidromeOverlayCsvImportButton from './components/NavidromeOverlayCsvImportButton.vue'
import NavidromePlaylistGrid from './components/NavidromePlaylistGrid.vue'
import NavidromeTrackTable from './components/NavidromeTrackTable.vue'
import NavidromeTrackTags from './components/NavidromeTrackTags.vue'

interface Selection {
  title: string
  subtitle: string
  songs: SubsonicSong[]
}

const navidromeStore = useNavidromeStore()
const {
  albums,
  albumPage,
  hasNextAlbumPage,
  isLoadingAlbums,
  goToAlbumPage,
  playlists,
  playlistPage,
  hasNextPlaylistPage,
  isLoadingPlaylists,
  goToPlaylistPage,
  loadError,
} = useLoadNavidromeLibrary()

// A failure while paging keeps whatever is on screen — the toast already said what went wrong.
const isEmptyAfterError = computed(
  () => loadError.value && albums.value.length === 0 && playlists.value.length === 0,
)

const tab = ref('albums')
const selection = ref<Selection | null>(null)
const isLoadingSelection = ref(false)
const previewedSong = ref<SubsonicSong | null>(null)
const tagsSong = ref<SubsonicSong | null>(null)
const tagsDialogOpen = ref(false)

// A slower earlier response must not replace the album the user opened afterwards.
let selectionRequest = 0

async function openSelection(load: () => Promise<Selection>) {
  const request = ++selectionRequest
  isLoadingSelection.value = true
  previewedSong.value = null

  try {
    const loaded = await load()

    if (request === selectionRequest)
      selection.value = loaded
  }
  catch (error) {
    reportNavidromeError(error, 'Could not load the tracks')
    navidromeStore.reportSessionError(error)
  }
  finally {
    if (request === selectionRequest)
      isLoadingSelection.value = false
  }
}

function openAlbum(album: SubsonicAlbum) {
  openSelection(async () => {
    const { songs } = await NavidromeService.getAlbum(album.id)
    return { title: album.name, subtitle: album.artist ?? 'Unknown artist', songs }
  })
}

function openPlaylist(playlist: SubsonicPlaylist) {
  openSelection(async () => {
    const { songs } = await NavidromeService.getPlaylist(playlist.id)
    return { title: playlist.name, subtitle: playlist.comment ?? 'Playlist', songs }
  })
}

function closeSelection() {
  selectionRequest++
  selection.value = null
  previewedSong.value = null
  isLoadingSelection.value = false
}

function showTags(song: SubsonicSong) {
  tagsSong.value = song
  tagsDialogOpen.value = true
}
</script>

<template>
  <div class="flex h-screen flex-col">
    <header class="flex items-center gap-3 border-b p-4">
      <Button v-if="selection" variant="ghost" size="icon" title="Back" @click="closeSelection">
        <ArrowLeft class="size-4" />
      </Button>
      <RouterLink v-else to="/">
        <Button variant="ghost" size="icon" title="Home">
          <Home class="size-4" />
        </Button>
      </RouterLink>

      <div class="min-w-0">
        <h1 class="truncate text-lg font-semibold">
          {{ selection?.title ?? 'Navidrome library' }}
        </h1>
        <p class="truncate text-xs text-muted-foreground">
          {{ selection?.subtitle ?? navidromeStore.session?.baseUrl }}
        </p>
      </div>
    </header>

    <div v-if="!navidromeStore.isConnected" class="
      flex flex-1 flex-col items-center justify-center gap-3
    "
    >
      <p class="text-sm text-muted-foreground">
        You are not connected to Navidrome.
      </p>
      <Button @click="navidromeStore.openConnectDialog()">
        Connect Navidrome
      </Button>
    </div>

    <p v-else-if="isEmptyAfterError" class="
      flex flex-1 items-center justify-center text-sm text-muted-foreground
    "
    >
      Failed to load the Navidrome library.
    </p>

    <template v-else>
      <ScrollArea v-if="isLoadingSelection" class="min-h-0 flex-1">
        <div class="space-y-2 p-4">
          <Skeleton v-for="i in 8" :key="i" class="h-10 w-full" />
        </div>
      </ScrollArea>

      <ScrollArea v-else-if="selection" class="min-h-0 flex-1">
        <NavidromeTrackTable
          :songs="selection.songs"
          :previewed-song-id="previewedSong?.id"
          :source-name="selection.title"
          @preview="previewedSong = $event"
          @show-tags="showTags"
        />
      </ScrollArea>

      <Tabs v-else v-model="tab" class="flex min-h-0 flex-1 flex-col">
        <div class="mx-4 mt-3 flex flex-wrap items-center justify-between gap-2">
          <TabsList class="grid w-auto max-w-md grid-cols-2">
            <TabsTrigger value="albums">
              Albums
            </TabsTrigger>
            <TabsTrigger value="playlists">
              Playlists
            </TabsTrigger>
          </TabsList>
          <div class="flex gap-2">
            <NavidromeOverlayCsvImportButton />
            <NavidromeOverlayCsvExportButton />
          </div>
        </div>
        <TabsContent value="albums" class="flex min-h-0 flex-1 flex-col">
          <ScrollArea class="min-h-0 flex-1">
            <NavidromeAlbumGrid
              :albums="albums"
              :is-loading="isLoadingAlbums"
              :page="albumPage"
              :has-next-page="hasNextAlbumPage"
              @select="openAlbum"
              @previous="goToAlbumPage(albumPage - 1)"
              @next="goToAlbumPage(albumPage + 1)"
            />
          </ScrollArea>
        </TabsContent>
        <TabsContent value="playlists" class="flex min-h-0 flex-1 flex-col">
          <ScrollArea class="min-h-0 flex-1">
            <NavidromePlaylistGrid
              :playlists="playlists"
              :is-loading="isLoadingPlaylists"
              :page="playlistPage"
              :has-next-page="hasNextPlaylistPage"
              @select="openPlaylist"
              @previous="goToPlaylistPage(playlistPage - 1)"
              @next="goToPlaylistPage(playlistPage + 1)"
            />
          </ScrollArea>
        </TabsContent>
      </Tabs>

      <NavidromeAudioPreview
        v-if="previewedSong"
        :song="previewedSong"
        @close="previewedSong = null"
      />
    </template>

    <NavidromeTrackTags v-model:open="tagsDialogOpen" :song="tagsSong" />
  </div>
</template>
