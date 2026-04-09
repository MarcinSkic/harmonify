<script setup lang="ts">
import type { LocalGame } from '@/db/schemas'
import { Library, Monitor } from 'lucide-vue-next'
import { onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { Button } from '@/components/ui/button'
import { useLocalGameStore } from '@/pages/local/stores'
import CreateRoom from './components/CreateRoom.vue'
import JoinRoom from './components/JoinRoom.vue'

const localGameStore = useLocalGameStore()
const unfinishedGame = ref<LocalGame | null>(null)

onMounted(async () => {
  unfinishedGame.value = await localGameStore.findUnfinishedGame()
})
</script>

<template>
  <div class="grid h-screen place-content-center place-items-center">
    <header class="grid justify-items-center gap-5">
      <h1
        class="
          flex h-min items-center gap-5 text-[13vw] font-bold text-primary
          italic
          md:text-8xl
        "
      >
        <img src="@/assets/logo.png" alt="Logo" class="h-[1.2em]">
        <span>Harmonify!</span>
      </h1>
    </header>
    <nav class="mt-6 flex gap-3">
      <RouterLink to="/library">
        <Button variant="outline" class="gap-2">
          <Library class="size-4" />
          Library
        </Button>
      </RouterLink>
      <RouterLink to="/local/setup">
        <Button variant="outline" class="gap-2">
          <Monitor class="size-4" />
          Local game
        </Button>
      </RouterLink>
      <RouterLink v-if="unfinishedGame" :to="`/local/${unfinishedGame.id}/round`">
        <Button class="gap-2">
          Continue game
        </Button>
      </RouterLink>
    </nav>
    <main class="mt-10 text-2xl font-bold">
      <div
        class="
          flex flex-col-reverse items-center gap-10
          md:flex-row md:items-end
        "
      >
        <JoinRoom />
        <CreateRoom />
      </div>
    </main>
  </div>
</template>
