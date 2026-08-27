<script setup lang="ts">
import { Loader2 } from '@lucide/vue'
import { ref, watch } from 'vue'
import { toast } from 'vue-sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { warnAboutUntestedVersion } from '@/lib/navidrome'
import { useNavidromeStore } from '@/stores'

const navidromeStore = useNavidromeStore()

// Prefilled at setup, not only from the watcher below: the route guard can call
// `openConnectDialog()` before this component is even mounted (a reload on /navidrome), and a
// watcher only reacts to a *change* — it would never fire for a flag that was already `true`.
// A stored session always fills the form, whatever the reason the verification failed; only a
// missing or unparseable session leaves it empty.
const baseUrl = ref(navidromeStore.session?.baseUrl ?? '')
const username = ref(navidromeStore.session?.username ?? '')
const password = ref('')
const isConnecting = ref(false)
const errorMessage = ref('')

watch(() => navidromeStore.connectDialogOpen, (open) => {
  if (open) {
    baseUrl.value = navidromeStore.session?.baseUrl ?? baseUrl.value
    username.value = navidromeStore.session?.username ?? username.value
    password.value = ''
    // A failed session check already has a reason — show it instead of an empty form.
    errorMessage.value = navidromeStore.status === 'connecting' ? '' : navidromeStore.lastError?.message ?? ''
    return
  }

  if (!navidromeStore.isConnected)
    navidromeStore.dismissedThisSession = true
})

async function handleConnect() {
  if (!baseUrl.value.trim() || !username.value.trim())
    return

  isConnecting.value = true
  errorMessage.value = ''

  try {
    const session = await navidromeStore.connect({
      baseUrl: baseUrl.value,
      username: username.value,
      password: password.value,
    })

    password.value = ''
    toast.success(`Connected to Navidrome ${session.serverVersion}`)
    warnAboutUntestedVersion(session.serverVersion)
  }
  catch (error) {
    // Shown next to the form rather than as a toast — it says what to correct in this very form.
    console.error(error)
    errorMessage.value = navidromeStore.lastError?.message ?? 'Could not connect to Navidrome'
  }
  finally {
    isConnecting.value = false
  }
}
</script>

<template>
  <Dialog v-model:open="navidromeStore.connectDialogOpen">
    <DialogContent class="max-w-md">
      <DialogHeader>
        <DialogTitle>Connect Navidrome</DialogTitle>
        <DialogDescription>
          {{ navidromeStore.status === 'expired'
            ? 'The session has expired — enter your password again.'
            : 'Enter the address of your Navidrome server and your credentials.' }}
        </DialogDescription>
      </DialogHeader>

      <form class="flex flex-col gap-4" @submit.prevent="handleConnect">
        <div class="flex flex-col gap-2">
          <Label for="navidrome-url">Server address</Label>
          <Input
            id="navidrome-url"
            v-model="baseUrl"
            placeholder="http://192.168.1.10:4533"
            autocomplete="url"
            required
          />
        </div>

        <div class="flex flex-col gap-2">
          <Label for="navidrome-user">Username</Label>
          <Input
            id="navidrome-user"
            v-model="username"
            autocomplete="username"
            required
          />
        </div>

        <div class="flex flex-col gap-2">
          <Label for="navidrome-password">Password</Label>
          <Input
            id="navidrome-password"
            v-model="password"
            type="password"
            autocomplete="current-password"
            required
          />
          <p class="text-xs text-muted-foreground">
            The password is never stored — it only goes to your server when signing in.
          </p>
        </div>

        <p v-if="errorMessage" class="text-sm text-destructive">
          {{ errorMessage }}
        </p>

        <div class="flex justify-end">
          <Button type="submit" :disabled="isConnecting">
            <Loader2 v-if="isConnecting" class="size-4 animate-spin" />
            {{ isConnecting ? 'Connecting...' : 'Connect' }}
          </Button>
        </div>
      </form>

      <p class="text-xs text-muted-foreground">
        How to configure custom tags and what to do about a CORS error — see
        <a
          href="https://github.com/MarcinSkic/harmonify/blob/main/docs/navidrome-setup.md"
          target="_blank"
          rel="noopener"
          class="underline"
        >docs/navidrome-setup.md</a>.
      </p>
    </DialogContent>
  </Dialog>
</template>
