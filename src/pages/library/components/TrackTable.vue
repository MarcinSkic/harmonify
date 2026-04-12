<script setup lang="ts">
import { Music } from '@lucide/vue'
import {
  Table,
  TableBody,
  TableEmpty,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useLibraryStore } from '@/stores'
import TrackRow from './TrackRow.vue'

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
        <TableHead class="w-20" />
      </TableRow>
    </TableHeader>
    <TableBody>
      <TableEmpty v-if="libraryStore.tracks.length === 0" :colspan="4">
        <div class="flex flex-col items-center gap-2 py-8 text-muted-foreground">
          <Music class="size-10" />
          <p>No tracks yet</p>
        </div>
      </TableEmpty>
      <TrackRow v-for="track in libraryStore.tracks" :key="track.id" :track="track" />
    </TableBody>
  </Table>
</template>
