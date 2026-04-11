<script setup lang="ts">
import { Music, Trash2 } from '@lucide/vue'
import { Badge } from '@/components/ui/badge'
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
import { useLibraryStore } from '@/stores'

const libraryStore = useLibraryStore()
</script>

<template>
  <Table>
    <TableHeader>
      <TableRow>
        <TableHead class="w-[40%]">
          Track
        </TableHead>
        <TableHead
          class="
            hidden
            md:table-cell
          "
        >
          Album
        </TableHead>
        <TableHead
          class="
            hidden
            lg:table-cell
          "
        >
          Tags
        </TableHead>
        <TableHead class="w-10" />
      </TableRow>
    </TableHeader>
    <TableBody>
      <TableEmpty v-if="libraryStore.tracks.length === 0" :colspan="4">
        <div class="flex flex-col items-center gap-2 py-8 text-muted-foreground">
          <Music class="size-10" />
          <p>No tracks yet</p>
        </div>
      </TableEmpty>
      <TableRow v-for="track in libraryStore.tracks" :key="track.id">
        <TableCell>
          <div class="flex items-center gap-3">
            <img
              v-if="track.albumImageUrl"
              :src="track.albumImageUrl"
              :alt="track.albumName"
              class="size-10 rounded-sm object-cover"
            >
            <div
              v-else
              class="
                flex size-10 items-center justify-center rounded-sm bg-muted
              "
            >
              <Music class="size-5 text-muted-foreground" />
            </div>
            <div class="min-w-0">
              <p class="truncate font-medium">
                {{ track.name }}
              </p>
              <p class="truncate text-sm text-muted-foreground">
                {{ track.artists.join(', ') }}
              </p>
            </div>
          </div>
        </TableCell>
        <TableCell
          class="
            hidden
            md:table-cell
          "
        >
          {{ track.albumName }}
        </TableCell>
        <TableCell
          class="
            hidden
            lg:table-cell
          "
        >
          <div class="flex flex-wrap gap-1">
            <Badge
              v-for="tag in track.tags" :key="tag" variant="secondary" class="
                text-xs
              "
            >
              {{ tag }}
            </Badge>
          </div>
        </TableCell>
        <TableCell>
          <Button
            variant="ghost"
            size="icon"
            class="size-8"
            @click="libraryStore.removeTrack(track.id)"
          >
            <Trash2
              class="
                size-4 text-muted-foreground
                hover:text-destructive
              "
            />
          </Button>
        </TableCell>
      </TableRow>
    </TableBody>
  </Table>
</template>
