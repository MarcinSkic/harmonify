<script setup lang="ts">
import { X } from '@lucide/vue'
import { ref } from 'vue'
import { onBeforeRouteLeave, useRouter } from 'vue-router'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import PreviewPlayer from '@/pages/game/layout/components/PreviewPlayer.vue'
import Settings from '@/pages/game/layout/components/Settings.vue'
import { useLocalGameStore } from '@/pages/local/stores'

const router = useRouter()
const localGameStore = useLocalGameStore()
const isDialogOpen = ref(false)

onBeforeRouteLeave(() => {
  localGameStore.clearGame()
})

function handleQuit() {
  if (router.currentRoute.value.name === 'localSetup' || router.currentRoute.value.name === 'localResult')
    router.push({ name: 'home' })
  else
    isDialogOpen.value = true
}

async function handleFinishEarly() {
  const id = router.currentRoute.value.params.id as string
  await localGameStore.finishGame()
  isDialogOpen.value = false
  router.push({ name: 'localResult', params: { id } })
}

function handleSuspend() {
  isDialogOpen.value = false
  router.push({ name: 'home' })
}

async function handleQuitAndFinish() {
  await localGameStore.finishGame()
  isDialogOpen.value = false
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

  <Dialog v-model:open="isDialogOpen">
    <DialogContent class="max-w-96">
      <DialogHeader>
        <DialogTitle>Wyjdź z gry</DialogTitle>
        <DialogDescription>Co chcesz zrobić z tą grą?</DialogDescription>
      </DialogHeader>
      <DialogFooter
        class="
          flex-col gap-2
          sm:flex-col
        "
      >
        <Button class="w-full" @click="handleFinishEarly">
          Zakończ wcześniej
        </Button>
        <Button class="w-full" variant="outline" @click="handleSuspend">
          Wstrzymaj grę
        </Button>
        <div class="flex gap-2">
          <Button class="flex-1" variant="destructive" @click="handleQuitAndFinish">
            Wyjdź
          </Button>
          <DialogClose as-child>
            <Button class="flex-1" variant="outline">
              Anuluj
            </Button>
          </DialogClose>
        </div>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
