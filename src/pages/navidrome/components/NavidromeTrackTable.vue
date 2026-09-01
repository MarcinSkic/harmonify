<script setup lang="ts">
import type { SubsonicSong } from '@/services/navidrome'
import { Music, Play, Tags } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

defineProps<{
  songs: SubsonicSong[]
  previewedSongId?: string
}>()

defineEmits<{
  preview: [song: SubsonicSong]
  showTags: [song: SubsonicSong]
}>()

/** Subsonic reports track length in seconds, unlike the music-server tracks kept in the library. */
function formatDuration(seconds?: number): string {
  if (seconds === undefined)
    return '—'

  const minutes = Math.floor(seconds / 60)
  return `${minutes}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`
}
</script>

<template>
  <Table>
    <TableHeader>
      <TableRow>
        <TableHead class="w-12 text-right">
          #
        </TableHead>
        <TableHead class="w-[40%]">
          Track
        </TableHead>
        <TableHead
          class="
            hidden
            md:table-cell
          "
        >
          Artist
        </TableHead>
        <TableHead class="w-16 text-right">
          Length
        </TableHead>
        <TableHead class="w-24" />
      </TableRow>
    </TableHeader>
    <TableBody>
      <TableEmpty v-if="songs.length === 0" :colspan="5">
        <div class="flex flex-col items-center gap-2 py-8 text-muted-foreground">
          <Music class="size-10" />
          <p>No tracks</p>
        </div>
      </TableEmpty>
      <TableRow
        v-for="song in songs"
        :key="song.id"
        :class="{ 'bg-accent/50': song.id === previewedSongId }"
      >
        <TableCell class="text-right text-muted-foreground">
          {{ song.track ?? '—' }}
        </TableCell>
        <TableCell class="font-medium">
          {{ song.title }}
        </TableCell>
        <TableCell
          class="
            hidden text-muted-foreground
            md:table-cell
          "
        >
          {{ song.artist ?? '—' }}
        </TableCell>
        <TableCell class="text-right text-muted-foreground">
          {{ formatDuration(song.duration) }}
        </TableCell>
        <TableCell>
          <div class="flex justify-end gap-1">
            <Button variant="ghost" size="icon" title="Play preview" @click="$emit('preview', song)">
              <Play class="size-4" />
            </Button>
            <Button variant="ghost" size="icon" title="Track tags" @click="$emit('showTags', song)">
              <Tags class="size-4" />
            </Button>
          </div>
        </TableCell>
      </TableRow>
    </TableBody>
  </Table>
</template>
