<script setup lang="ts">
import { onMounted } from 'vue'
import { RouterView, useRoute, useRouter } from 'vue-router'
import { Toaster } from '@/components/ui/sonner'
import { warnAboutUntestedVersion } from '@/lib/navidrome'
import NavidromeConnectDialog from '@/pages/navidrome/components/NavidromeConnectDialog.vue'
import { useNavidromeStore } from '@/stores'
import 'vue-sonner/style.css'

const navidromeStore = useNavidromeStore()
const router = useRouter()
const route = useRoute()

/** Only the routes that actually need Navidrome; `/cover`, `/library` and `/results` do not. */
function isNavidromeEntryRoute(path: string): boolean {
  return path === '/' || path.startsWith('/navidrome')
}

onMounted(async () => {
  // Runs on every route: the badge and the route guard both need to know the connection status.
  const status = await navidromeStore.verifySession()

  if (status === 'connected') {
    warnAboutUntestedVersion(navidromeStore.serverVersion)
    return
  }

  await router.isReady()

  // No session, or one that no longer works — the dialog explains why and asks for what is missing.
  if (!navidromeStore.dismissedThisSession && isNavidromeEntryRoute(route.path))
    navidromeStore.openConnectDialog()
})
</script>

<template>
  <RouterView />
  <NavidromeConnectDialog />
  <Toaster theme="dark" />
</template>
