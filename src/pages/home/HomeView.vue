<script setup lang="ts">
import type { LocalGame } from '@/db/schemas'
import { History, Library, Monitor, Play, Settings } from '@lucide/vue'
import { onMounted, ref } from 'vue'
import SettingsSheet from '@/components/SettingsSheet.vue'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useLocalGameStore } from '@/pages/local/stores'
import { useLibraryStore } from '@/stores'
import CreateRoom from './components/CreateRoom.vue'
import JoinRoom from './components/JoinRoom.vue'

const localGameStore = useLocalGameStore()
const libraryStore = useLibraryStore()

const unfinishedGame = ref<LocalGame | null>(null)
const showPlayMenu = ref(false)

onMounted(async () => {
  unfinishedGame.value = await localGameStore.findUnfinishedGame()
})
</script>

<template>
  <div class="flex h-screen flex-col items-center justify-center gap-6 p-6">
    <header>
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

    <!-- tiles row + absolutely-positioned submenu -->
    <div class="relative w-full max-w-4xl">
      <!-- 3 main tiles -->
      <div class="mx-auto grid max-w-2xl grid-cols-3 gap-4">
        <RouterLink
          to="/library"
          class="
            flex flex-col items-center gap-3 rounded-xl border bg-card p-8
            shadow-sm transition-colors
            hover:bg-accent hover:text-accent-foreground
          "
        >
          <Library class="size-10" />
          <span class="text-xl font-semibold">Library</span>
        </RouterLink>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger as-child>
              <span class="contents">
                <button
                  class="
                    flex w-full flex-col items-center gap-3 rounded-xl border
                    bg-card p-8 shadow-sm transition-colors
                    hover:bg-accent hover:text-accent-foreground
                    disabled:pointer-events-none disabled:opacity-50
                  "
                  :class="{ 'bg-accent text-accent-foreground': showPlayMenu }"
                  :disabled="libraryStore.enabledTracks.length === 0"
                  @click="showPlayMenu = !showPlayMenu"
                >
                  <Play class="size-10" />
                  <span class="text-xl font-semibold">Play</span>
                </button>
              </span>
            </TooltipTrigger>
            <TooltipContent v-if="libraryStore.enabledTracks.length === 0">
              Add tracks to the library first
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <SettingsSheet as-child>
          <button
            class="
              flex flex-col items-center gap-3 rounded-xl border bg-card p-8
              shadow-sm transition-colors
              hover:bg-accent hover:text-accent-foreground
            "
          >
            <Settings class="size-10" />
            <span class="text-xl font-semibold">Settings</span>
          </button>
        </SettingsSheet>
      </div>

      <!-- Play sub-menu: absolutely positioned below tiles -->
      <Transition name="slide">
        <div
          v-if="showPlayMenu"
          class="absolute inset-x-0 top-full mt-3 flex gap-3"
        >
          <RouterLink
            v-if="unfinishedGame"
            :to="`/local/${unfinishedGame.id}/round`"
            class="
              flex flex-1 flex-col items-center justify-center gap-2 rounded-xl
              border bg-card px-4 py-5 shadow-sm transition-colors
              hover:bg-accent hover:text-accent-foreground
            "
          >
            <span class="text-base font-semibold">Continue local</span>
            <History class="size-7" />
          </RouterLink>

          <RouterLink
            to="/local/setup"
            class="
              flex flex-1 flex-col items-center justify-center gap-2 rounded-xl
              border bg-card px-4 py-5 shadow-sm transition-colors
              hover:bg-accent hover:text-accent-foreground
            "
          >
            <span class="text-base font-semibold">New local</span>
            <Monitor class="size-7" />
          </RouterLink>

          <div
            class="
              flex flex-1 flex-col items-center justify-center gap-3 rounded-xl
              border bg-card px-4 py-5 shadow-sm
            "
          >
            <span class="text-base font-semibold">Join room</span>
            <JoinRoom />
          </div>

          <div
            class="
              flex flex-1 flex-col items-center justify-center gap-3 rounded-xl
              border bg-card px-4 py-5 shadow-sm
            "
          >
            <span class="text-base font-semibold">Create room</span>
            <CreateRoom />
          </div>
        </div>
      </Transition>
    </div>
  </div>
</template>

<style scoped>
.slide-enter-active,
.slide-leave-active {
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}

.slide-enter-from,
.slide-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}
</style>
