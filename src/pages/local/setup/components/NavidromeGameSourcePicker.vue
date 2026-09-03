<script setup lang="ts">
import type { NavidromeCoverTile } from '@/pages/navidrome/types'
import type { NavidromeGameSourceRef } from '@/services/navidromeGameSource'
import { computed, ref } from 'vue'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useLoadNavidromeLibrary } from '@/composables/useLoadNavidromeLibrary'
import NavidromeCoverGrid from '@/pages/navidrome/components/NavidromeCoverGrid.vue'
import { NavidromeService } from '@/services'

const selected = defineModel<NavidromeGameSourceRef[]>('selected', { required: true })

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
} = useLoadNavidromeLibrary()

const tab = ref('albums')

const albumTiles = computed<NavidromeCoverTile[]>(() => albums.value.map(album => ({
  id: album.id,
  title: album.name,
  subtitle: album.artist ?? 'Unknown artist',
  coverArt: album.coverArt ?? album.id,
})))

const playlistTiles = computed<NavidromeCoverTile[]>(() => playlists.value.map(playlist => ({
  id: playlist.id,
  title: playlist.name,
  subtitle: `${playlist.songCount ?? 0} tracks`,
  coverArt: playlist.coverArt,
})))

const selectedAlbumIds = computed(() => selected.value.filter(s => s.type === 'album').map(s => s.id))
const selectedPlaylistIds = computed(() => selected.value.filter(s => s.type === 'playlist').map(s => s.id))

// A tile is only ever added while it is on screen, so looking it up among the currently loaded
// tiles is enough to fill in `name`/`imageUrl` — ids removed from `ids` never need a tile lookup.
function updateSelection(type: NavidromeGameSourceRef['type'], ids: string[], tiles: NavidromeCoverTile[]) {
  const others = selected.value.filter(s => s.type !== type)
  const refs = ids.map((id): NavidromeGameSourceRef => {
    const existing = selected.value.find(s => s.type === type && s.id === id)
    if (existing)
      return existing

    const tile = tiles.find(t => t.id === id)
    return {
      type,
      id,
      name: tile?.title ?? id,
      imageUrl: tile?.coverArt ? NavidromeService.getCoverArtUrl(tile.coverArt, 300) : undefined,
    }
  })
  selected.value = [...others, ...refs]
}
</script>

<template>
  <div class="flex h-full flex-col gap-2 rounded-lg border p-4">
    <h2
      class="
        text-center text-xl font-bold
        lg:text-3xl
      "
    >
      Source
    </h2>
    <p class="text-center text-sm text-muted-foreground">
      {{ selected.length }} {{ selected.length === 1 ? 'source' : 'sources' }} selected
    </p>

    <Tabs v-model="tab" class="flex min-h-0 flex-1 flex-col">
      <TabsList class="w-full shrink-0">
        <TabsTrigger value="albums" class="flex-1">
          Albums
        </TabsTrigger>
        <TabsTrigger value="playlists" class="flex-1">
          Playlists
        </TabsTrigger>
      </TabsList>
      <TabsContent value="albums" class="min-h-0 flex-1">
        <ScrollArea class="h-full">
          <NavidromeCoverGrid
            :tiles="albumTiles"
            :is-loading="isLoadingAlbums"
            :page="albumPage"
            :has-next-page="hasNextAlbumPage"
            selectable
            :selected-ids="selectedAlbumIds"
            empty-message="No albums in this library."
            @update:selected-ids="updateSelection('album', $event, albumTiles)"
            @previous="goToAlbumPage(albumPage - 1)"
            @next="goToAlbumPage(albumPage + 1)"
          />
        </ScrollArea>
      </TabsContent>
      <TabsContent value="playlists" class="min-h-0 flex-1">
        <ScrollArea class="h-full">
          <NavidromeCoverGrid
            :tiles="playlistTiles"
            :is-loading="isLoadingPlaylists"
            :page="playlistPage"
            :has-next-page="hasNextPlaylistPage"
            selectable
            :selected-ids="selectedPlaylistIds"
            empty-message="No playlists in this library."
            @update:selected-ids="updateSelection('playlist', $event, playlistTiles)"
            @previous="goToPlaylistPage(playlistPage - 1)"
            @next="goToPlaylistPage(playlistPage + 1)"
          />
        </ScrollArea>
      </TabsContent>
    </Tabs>
  </div>
</template>
