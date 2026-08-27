import type { NavidromeErrorKind, NavidromeSession } from '@/services/navidrome'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { NavidromeService } from '@/services'

export type NavidromeStatus = 'disconnected' | 'connecting' | 'connected' | 'expired'

const CREDENTIAL_ERROR_KINDS: NavidromeErrorKind[] = ['badCredentials', 'sessionExpired']

function isCredentialError(error: unknown): boolean {
  return error instanceof NavidromeService.NavidromeError && CREDENTIAL_ERROR_KINDS.includes(error.kind)
}

export const useNavidromeStore = defineStore('navidrome', () => {
  // Session state itself is owned by the service (it refreshes the JWT on every native response);
  // reading it through a computed keeps this store reactive to those refreshes.
  const session = computed<NavidromeSession | null>(() => NavidromeService.getSession())
  const status = ref<NavidromeStatus>('disconnected')
  const lastError = ref<Error | null>(null)

  // Deliberately not persisted, so the dialog does not reappear on every route change.
  const connectDialogOpen = ref(false)
  const dismissedThisSession = ref(false)

  let verification: Promise<NavidromeStatus> | null = null

  const isConnected = computed(() => status.value === 'connected')
  const serverVersion = computed(() => session.value?.serverVersion ?? '')

  /** The password is used to derive the Subsonic pair and to log in, then dropped — never stored. */
  async function connect({ baseUrl, username, password }: { baseUrl: string, username: string, password: string }): Promise<NavidromeSession> {
    const previous = NavidromeService.getSession()
    status.value = 'connecting'
    lastError.value = null

    try {
      const address = NavidromeService.normalizeBaseUrl(baseUrl)
      const { salt, token } = NavidromeService.deriveSubsonicCredentials(password)
      const { jwt } = await NavidromeService.login(address, username, password)

      // The Subsonic ping authenticates with the stored session, so it has to be written first;
      // `serverVersion` is filled in by the ping that follows.
      const provisional = {
        baseUrl: address,
        username,
        subsonicSalt: salt,
        subsonicToken: token,
        jwt,
        serverVersion: '',
      }
      NavidromeService.setSession(provisional)

      const { serverVersion: version } = await NavidromeService.ping()
      const connected = { ...NavidromeService.getSession() ?? provisional, serverVersion: version }
      NavidromeService.setSession(connected)

      status.value = 'connected'
      connectDialogOpen.value = false

      return connected
    }
    catch (error) {
      // The provisional session written before the ping must go, but a previously working one is
      // restored — a mistyped password on a retry must not wipe the address and login used to prefill.
      if (previous)
        NavidromeService.setSession(previous)
      else
        NavidromeService.clearSession()

      lastError.value = error instanceof Error ? error : new Error(String(error))
      status.value = previous && isCredentialError(error) ? 'expired' : 'disconnected'
      throw error
    }
  }

  /**
   * Run at application start and from the route guard, whichever comes first — an in-flight
   * verification is shared instead of pinging twice.
   */
  function verifySession(): Promise<NavidromeStatus> {
    verification ??= runVerification().finally(() => {
      verification = null
    })

    return verification
  }

  /**
   * Never throws: the caller decides what to show, and the reason stays available in `lastError`.
   *
   * Deliberate gap: the ping goes through Subsonic, which authenticates with the salt + token pair,
   * and that pair never expires — so a dead JWT still reports `connected`. It is not verified with
   * a native call on purpose, because that would put the unstable API on every application start,
   * against the risk mitigation in §1 of the plan. The JWT is needed for tags only, so a dead one
   * surfaces on the first tag lookup and is handled there by `reportSessionError`.
   */
  async function runVerification(): Promise<NavidromeStatus> {
    const current = NavidromeService.getSession()

    if (!current) {
      status.value = 'disconnected'
      return status.value
    }

    status.value = 'connecting'
    lastError.value = null

    try {
      const { serverVersion: version } = await NavidromeService.ping()
      NavidromeService.setSession({ ...current, serverVersion: version })
      status.value = 'connected'
    }
    catch (error) {
      lastError.value = error instanceof Error ? error : new Error(String(error))
      // The session is kept either way, so the dialog can prefill the address and the login.
      status.value = isCredentialError(error) ? 'expired' : 'disconnected'
    }

    return status.value
  }

  /**
   * For credential failures raised outside `connect`/`verifySession` — a service call made straight
   * from a component. Without it the toast is a dead end: the badge stays green and the route guard
   * keeps letting the user through with a session the server no longer accepts.
   */
  function reportSessionError(error: unknown): void {
    if (!isCredentialError(error))
      return

    lastError.value = error instanceof Error ? error : new Error(String(error))
    status.value = 'expired'
    openConnectDialog()
  }

  function disconnect(): void {
    NavidromeService.clearSession()
    status.value = 'disconnected'
    lastError.value = null
  }

  function openConnectDialog(): void {
    connectDialogOpen.value = true
  }

  return {
    session,
    status,
    lastError,
    connectDialogOpen,
    dismissedThisSession,
    isConnected,
    serverVersion,
    connect,
    verifySession,
    reportSessionError,
    disconnect,
    openConnectDialog,
  }
})
