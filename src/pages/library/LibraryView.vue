<script setup lang="ts">
import { ref } from 'vue'
import LibraryHeader from '@/components/library/LibraryHeader.vue'
import PlaylistSidebar from '@/components/library/PlaylistSidebar.vue'
import TrackTable from '@/components/library/TrackTable.vue'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

const mobileTab = ref('tracks')
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
        <LibraryHeader />
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
      <LibraryHeader />
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
  </div>
</template>
