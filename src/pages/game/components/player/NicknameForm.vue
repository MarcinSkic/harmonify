<script setup lang="ts">
import { TriangleAlert } from '@lucide/vue'
import { watchDebounced } from '@vueuse/core'
import { ref, watch } from 'vue'
import { toast } from 'vue-sonner'
import Input from '@/components/ui/input/Input.vue'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { LOCAL_STORAGE } from '@/consts'
import { useConnectionStore, useGameDataStore } from '@/stores'
import { nicknameSchema } from '@/types'

const props = defineProps<{
  nickname: string
}>()

const connectionStore = useConnectionStore()
const gameDataStore = useGameDataStore()

const localNickname = ref(props.nickname)
const error = ref('')
let lastToastId: string | number | null = null

function isCorrect() {
  const result = nicknameSchema.safeParse(localNickname.value)

  if (!result.success) {
    error.value = result.error.issues[0].message
    return false
  }

  if (gameDataStore.players.some(p => p.nickname === localNickname.value && p.guid !== gameDataStore.selfPlayer.guid)) {
    error.value = 'Nicknames must be unique'
    return false
  }

  error.value = ''
  return true
}

function tryUpdateNickname() {
  if (localNickname.value === props.nickname)
    return

  if (!isCorrect())
    return

  connectionStore.sendMessage({
    $type: 'message/string',
    type: 'changeName',
    data: localNickname.value,
  })
}

/** Nickname update triggered by server */
watch(() => props.nickname, (newNickname) => {
  localNickname.value = newNickname
  localStorage.setItem(LOCAL_STORAGE.NICKNAME, newNickname)
})

/** Other player nickname change could resolve conflict */
watch(() => gameDataStore.players, () => {
  if (!isCorrect())
    tryUpdateNickname()
})

/** Update nick on user typing */
watchDebounced(localNickname, () => {
  tryUpdateNickname()
}, { immediate: true, debounce: 500 })

/** Reset error on typing */
watch(localNickname, () => {
  if (error.value)
    isCorrect()
})

/** Hide toast soon after fixing error */
watchDebounced(error, () => {
  if (error.value)
    return

  if (lastToastId != null)
    toast.dismiss(lastToastId)
  lastToastId = null
}, { debounce: 500 })

/** Display toast if user doesn't fix error for a while */
watchDebounced(error, () => {
  if (!error.value)
    return

  lastToastId = toast.error('Couldn\'t save nickname', { description: error.value })
}, { debounce: 2000 })
</script>

<template>
  <div
    class="grid w-full grid-cols-[minmax(0,1fr)_2rem] place-items-center gap-2"
  >
    <Input v-model:model-value="localNickname" />
    <TooltipProvider v-if="error">
      <Tooltip>
        <TooltipTrigger>
          <TriangleAlert class="cursor-default text-red-500" />
        </TooltipTrigger>
        <TooltipContent>
          <p>Can't save: {{ error }}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  </div>
</template>
