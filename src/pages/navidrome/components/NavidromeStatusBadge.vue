<script setup lang="ts">
import { LogOut } from '@lucide/vue'
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { Button } from '@/components/ui/button'
import { useNavidromeStore } from '@/stores'

const navidromeStore = useNavidromeStore()
const router = useRouter()

const host = computed(() => {
  const baseUrl = navidromeStore.session?.baseUrl
  if (!baseUrl)
    return ''

  try {
    return new URL(baseUrl).host
  }
  catch {
    return baseUrl
  }
})

const label = computed(() => {
  if (navidromeStore.status === 'connected')
    return navidromeStore.serverVersion ? `${host.value} · ${navidromeStore.serverVersion}` : host.value

  if (navidromeStore.status === 'connecting')
    return 'Connecting...'

  if (navidromeStore.status === 'expired')
    return 'Session expired'

  return 'Not connected'
})

const dotClass = computed(() => {
  if (navidromeStore.status === 'connected')
    return 'bg-green-500'

  if (navidromeStore.status === 'expired')
    return 'bg-amber-500'

  return 'bg-muted-foreground'
})

function handleClick() {
  if (navidromeStore.isConnected)
    router.push({ name: 'navidrome' })
  else
    navidromeStore.openConnectDialog()
}
</script>

<template>
  <div
    class="
      flex items-center gap-1 rounded-full border bg-card py-1 pr-1 pl-3 text-sm
      shadow-sm
    "
  >
    <button
      type="button"
      class="flex items-center gap-2"
      :title="navidromeStore.session?.baseUrl"
      @click="handleClick"
    >
      <span class="size-2 shrink-0 rounded-full" :class="dotClass" />
      <span>{{ label }}</span>
    </button>
    <Button
      v-if="navidromeStore.isConnected"
      variant="ghost"
      size="icon"
      class="size-7"
      title="Disconnect"
      @click="navidromeStore.disconnect()"
    >
      <LogOut class="size-4" />
    </Button>
  </div>
</template>
