<script setup lang="ts">
import { ref } from 'vue'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import LibraryHeader from './components/LibraryHeader.vue'
import PlaylistSidebar from './components/PlaylistSidebar.vue'
import SpotifyImportDialog from './components/SpotifyImportDialog.vue'
import TrackTable from './components/TrackTable.vue'

const mobileTab = ref('tracks')
const showSpotifyImport = ref(false)
</script>

<template>
  <div class="flex h-screen flex-col">
    <!-- Desktop layout -->
    <div
      class="
        hidden h-full
        md:flex
      "
    >
      <aside class="w-64 shrink-0 border-r">
        <PlaylistSidebar />
      </aside>
      <div class="flex flex-1 flex-col overflow-hidden">
        <LibraryHeader @spotify-import="showSpotifyImport = true" />
        <div class="flex-1 overflow-auto">
          <TrackTable />
        </div>
      </div>
    </div>

    <!-- Mobile layout -->
    <div
      class="
        flex flex-1 flex-col overflow-hidden
        md:hidden
      "
    >
      <LibraryHeader @spotify-import="showSpotifyImport = true" />
      <Tabs v-model="mobileTab" class="flex flex-1 flex-col overflow-hidden">
        <TabsList class="mx-4 mt-2 grid w-auto grid-cols-2">
          <TabsTrigger value="tracks">
            Tracks
          </TabsTrigger>
          <TabsTrigger value="playlists">
            Playlists
          </TabsTrigger>
        </TabsList>
        <TabsContent value="tracks" class="flex-1 overflow-auto">
          <TrackTable />
        </TabsContent>
        <TabsContent value="playlists" class="flex-1 overflow-auto">
          <PlaylistSidebar />
        </TabsContent>
      </Tabs>
    </div>

    <SpotifyImportDialog v-model:open="showSpotifyImport" />
  </div>
</template>
