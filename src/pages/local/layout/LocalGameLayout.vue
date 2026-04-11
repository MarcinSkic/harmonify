<script setup lang="ts">
import { X } from '@lucide/vue'
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import PreviewPlayer from '@/pages/game/layout/components/PreviewPlayer.vue'
import Settings from '@/pages/game/layout/components/Settings.vue'
import { useLocalGameStore } from '@/pages/local/stores'

const router = useRouter()
const localGameStore = useLocalGameStore()
const isAlertOpen = ref(false)

function handleQuit() {
  if (router.currentRoute.value.name === 'localSetup' || router.currentRoute.value.name === 'localResult')
    router.push({ name: 'home' })
  else
    isAlertOpen.value = true
}

function confirmQuit() {
  router.push({ name: 'home' })
}
</script>

<template>
  <div
    class="
      grid h-screen min-h-screen grid-rows-[minmax(0,auto)_minmax(0,1fr)]
      place-content-stretch
    "
  >
    <div
      class="z-20 grid grid-cols-[minmax(auto,1200px)] justify-center border-b"
    >
      <div class="flex items-center justify-start p-1">
        <span
          v-if="localGameStore.game?.status === 'playing'" class="
            mr-auto px-2 text-sm font-medium
          "
        >
          Round {{ localGameStore.game.currentRound }}
        </span>
        <span v-else class="mr-auto px-2 text-sm font-medium">
          Local Game
        </span>
        <Settings />
        <Button variant="ghost" size="icon" @click="handleQuit">
          <X />
        </Button>
      </div>
    </div>
    <RouterView class="relative" />
    <PreviewPlayer />
  </div>

  <AlertDialog v-model:open="isAlertOpen">
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>Are you sure you want to quit game early?</AlertDialogTitle>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>Cancel</AlertDialogCancel>
        <AlertDialogAction variant="destructive" @click="confirmQuit">
          Quit
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>
