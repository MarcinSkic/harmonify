<script setup lang="ts">
import type { NavidromeCoverTile } from '../types'
import type { SubsonicAlbum } from '@/services/navidrome'
import { computed } from 'vue'
import NavidromeCoverGrid from './NavidromeCoverGrid.vue'

const props = defineProps<{
  albums: SubsonicAlbum[]
  isLoading: boolean
  page: number
  hasNextPage: boolean
}>()

const emit = defineEmits<{
  select: [album: SubsonicAlbum]
  previous: []
  next: []
}>()

const tiles = computed<NavidromeCoverTile[]>(() => props.albums.map(album => ({
  id: album.id,
  title: album.name,
  subtitle: album.artist ?? 'Unknown artist',
  coverArt: album.coverArt ?? album.id,
})))

function select(id: string) {
  const album = props.albums.find(a => a.id === id)

  if (album)
    emit('select', album)
}
</script>

<template>
  <NavidromeCoverGrid
    :tiles="tiles"
    :is-loading="isLoading"
    :page="page"
    :has-next-page="hasNextPage"
    empty-message="No albums in this library."
    @select="select"
    @previous="$emit('previous')"
    @next="$emit('next')"
  />
</template>
