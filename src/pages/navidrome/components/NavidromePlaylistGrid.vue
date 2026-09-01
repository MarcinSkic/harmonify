<script setup lang="ts">
import type { NavidromeCoverTile } from '../types'
import type { SubsonicPlaylist } from '@/services/navidrome'
import { computed } from 'vue'
import NavidromeCoverGrid from './NavidromeCoverGrid.vue'

const props = defineProps<{
  playlists: SubsonicPlaylist[]
  isLoading: boolean
  page: number
  hasNextPage: boolean
}>()

const emit = defineEmits<{
  select: [playlist: SubsonicPlaylist]
  previous: []
  next: []
}>()

const tiles = computed<NavidromeCoverTile[]>(() => props.playlists.map(playlist => ({
  id: playlist.id,
  title: playlist.name,
  subtitle: `${playlist.songCount ?? 0} tracks`,
  coverArt: playlist.coverArt,
})))

function select(id: string) {
  const playlist = props.playlists.find(p => p.id === id)

  if (playlist)
    emit('select', playlist)
}
</script>

<template>
  <NavidromeCoverGrid
    :tiles="tiles"
    :is-loading="isLoading"
    :page="page"
    :has-next-page="hasNextPage"
    empty-message="No playlists in this library."
    @select="select"
    @previous="$emit('previous')"
    @next="$emit('next')"
  />
</template>
