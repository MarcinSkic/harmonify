<script setup lang="ts">
import { computed, ref } from 'vue'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useMusicPlayerStore } from '@/pages/game/stores'
import { LibraryImportService } from '@/services'
import { useConnectionStore, useGameDataStore, useLibraryStore } from '@/stores'
import GameDataForm from './GameDataForm.vue'
import LibraryTrackPicker from './LibraryTrackPicker.vue'

defineProps<{
  isDesktop: boolean
}>()

const isLoading = ref(false)
const musicPlayerStore = useMusicPlayerStore()
const libraryStore = useLibraryStore()
const connectionStore = useConnectionStore()
const gameData = useGameDataStore()

async function handleGameStart() {
  if (!musicPlayerStore.ready)
    return

  isLoading.value = true

  await musicPlayerStore.turnOn()

  const spotifyTracks = libraryStore.tracks.map(t => LibraryImportService.trackToSpotifyTrack(t))

  connectionStore.sendMessage({
    $type: 'message/startGameDto',
    type: 'startGame',
    data: {
      tracks: spotifyTracks,
      gameSettings: gameData.gameSettings,
    },
  })
}

function disableLoading() {
  isLoading.value = false
}

const hasTracksSelected = computed(() => libraryStore.tracks.length > 0)

const startButtonText = computed(() => {
  if (!musicPlayerStore.ready)
    return 'Connecting...'
  else if (!hasTracksSelected.value)
    return 'Select a playlist'
  else if (isLoading.value)
    return 'Loading...'
  else return 'Play!'
})

defineExpose({ disableLoading })
</script>

<template>
  <form
    class="
      grid h-[80vh] max-h-[80vh] w-[80vw]
      lg:w-auto lg:grid-cols-[minmax(auto,600px)_270px] lg:grid-rows-[1fr_50px]
      lg:items-start lg:gap-5
    " @submit.prevent="handleGameStart"
  >
    <Tabs v-if="!isDesktop" default-value="tracks">
      <TabsList class="w-full">
        <TabsTrigger value="tracks" class="flex-1">
          Library
        </TabsTrigger>
        <TabsTrigger value="settings" class="flex-1">
          Game settings
        </TabsTrigger>
      </TabsList>
      <TabsContent value="tracks" class="h-[60vh]">
        <LibraryTrackPicker />
      </TabsContent>
      <TabsContent value="settings" class="h-[60vh]">
        <GameDataForm />
      </TabsContent>
    </Tabs>
    <template v-else>
      <LibraryTrackPicker />
      <GameDataForm />
    </template>
    <Button
      class="min-w-32 place-self-center"
      :disabled="!musicPlayerStore.player || !hasTracksSelected || isLoading"
      type="submit"
    >
      {{ startButtonText }}
    </Button>
  </form>
</template>
