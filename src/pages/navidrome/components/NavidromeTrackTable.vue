<script setup lang="ts">
import type { TrackOverlay } from '@/db/schemas'
import type { SubsonicSong } from '@/services/navidrome'
import { Download, Music, Pencil, Play, Tags } from '@lucide/vue'
import { saveAs } from 'file-saver'
import { ref, watch } from 'vue'
import { toast } from 'vue-sonner'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import {
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { serializeTrackIdentityCSV } from '@/lib/csv'
import { deriveOverlayKey } from '@/lib/trackOverlayKey'
import { LibraryOverlayService } from '@/services'
import NavidromeTrackOverlayDialog from './NavidromeTrackOverlayDialog.vue'

const props = defineProps<{
  songs: SubsonicSong[]
  previewedSongId?: string
}>()

defineEmits<{
  preview: [song: SubsonicSong]
  showTags: [song: SubsonicSong]
}>()

const overlaysByKey = ref<Map<string, TrackOverlay>>(new Map())
const overlaySong = ref<SubsonicSong | null>(null)
const overlayDialogOpen = ref(false)

// Guards against a slower earlier batch overwriting overlays of a list the user has since opened.
let overlaysRequest = 0

function overlayKeyFor(song: SubsonicSong): string {
  return deriveOverlayKey({
    musicBrainzId: song.musicBrainzId,
    albumId: song.albumId,
    discNumber: song.discNumber,
    track: song.track,
    title: song.title,
  })
}

async function loadOverlays(songs: SubsonicSong[]) {
  const request = ++overlaysRequest
  const overlays = await LibraryOverlayService.getOverlaysByKeys(songs.map(overlayKeyFor))
  if (request === overlaysRequest)
    overlaysByKey.value = overlays
}

watch(() => props.songs, loadOverlays, { immediate: true })

function isEnabled(song: SubsonicSong): boolean {
  return overlaysByKey.value.get(overlayKeyFor(song))?.enabled !== false
}

async function refreshOverlay(song: SubsonicSong) {
  const key = overlayKeyFor(song)
  const overlay = await LibraryOverlayService.getOverlay(key)
  if (overlay)
    overlaysByKey.value.set(key, overlay)
}

async function toggleEnabled(song: SubsonicSong, value: boolean) {
  await LibraryOverlayService.upsertOverlay(
    {
      musicBrainzId: song.musicBrainzId,
      albumId: song.albumId,
      discNumber: song.discNumber,
      track: song.track,
      title: song.title,
      artist: song.artist,
    },
    { enabled: value },
  )
  await refreshOverlay(song)
}

function openOverlayDialog(song: SubsonicSong) {
  overlaySong.value = song
  overlayDialogOpen.value = true
}

async function onOverlaySaved() {
  if (overlaySong.value)
    await refreshOverlay(overlaySong.value)
}

function exportIds() {
  const csv = serializeTrackIdentityCSV(props.songs)
  saveAs(new Blob([csv], { type: 'text/csv' }), 'navidrome-track-ids.csv')
  toast.success(`Exported ${props.songs.length} track IDs`)
}

/** Subsonic reports track length in seconds, unlike the music-server tracks kept in the library. */
function formatDuration(seconds?: number): string {
  if (seconds === undefined)
    return '—'

  const minutes = Math.floor(seconds / 60)
  return `${minutes}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`
}
</script>

<template>
  <div class="flex flex-col gap-2 p-4 pb-0">
    <div class="flex justify-end">
      <Button variant="outline" size="sm" class="gap-1.5" @click="exportIds">
        <Download class="size-4" /> Export IDs
      </Button>
    </div>

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
          <TableHead class="w-16 text-center">
            Enabled
          </TableHead>
          <TableHead class="w-28" />
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableEmpty v-if="songs.length === 0" :colspan="6">
          <div class="
            flex flex-col items-center gap-2 py-8 text-muted-foreground
          "
          >
            <Music class="size-10" />
            <p>No tracks</p>
          </div>
        </TableEmpty>
        <TableRow
          v-for="song in songs"
          :key="song.id"
          :class="{
            'bg-accent/50': song.id === previewedSongId,
            'opacity-50': !isEnabled(song),
          }"
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
          <TableCell class="text-center">
            <Switch
              :model-value="isEnabled(song)"
              @update:model-value="toggleEnabled(song, $event)"
            />
          </TableCell>
          <TableCell>
            <div class="flex justify-end gap-1">
              <Button variant="ghost" size="icon" title="Play preview" @click="$emit('preview', song)">
                <Play class="size-4" />
              </Button>
              <Button variant="ghost" size="icon" title="Track tags" @click="$emit('showTags', song)">
                <Tags class="size-4" />
              </Button>
              <Button variant="ghost" size="icon" title="Edit overlay" @click="openOverlayDialog(song)">
                <Pencil class="size-4" />
              </Button>
            </div>
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>

    <NavidromeTrackOverlayDialog
      v-model:open="overlayDialogOpen"
      :song="overlaySong"
      @saved="onOverlaySaved"
    />
  </div>
</template>
