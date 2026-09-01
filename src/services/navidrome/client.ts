import type { z } from 'zod'
import type { NavidromeSession } from './credentials'
import type { NavidromeErrorKind } from './errors'
import { useStorage } from '@vueuse/core'
import { LOCAL_STORAGE } from '@/consts'
import { navidromeSessionSchema } from './credentials'
import { assertNotMixedContent, errorFromHttpStatus, errorFromSubsonicCode, NavidromeError } from './errors'
import { subsonicEnvelopeSchema } from './schemas'

const SUBSONIC_API_VERSION = '1.16.1'
const CLIENT_NAME = 'harmonify'
const JWT_HEADER = 'x-nd-authorization'

export type SubsonicParams = Record<string, string | number | boolean | undefined>

/**
 * The session lives here rather than in the store: `client.ts` refreshes the JWT on every native
 * response, and two `useStorage()` refs on one key would silently diverge within a tab. The store
 * reads it through `getSession()`, which stays reactive because it dereferences this ref.
 */
const session = useStorage<NavidromeSession | null>(LOCAL_STORAGE.NAVIDROME_SESSION, null, undefined, {
  serializer: {
    read: (raw) => {
      try {
        const parsed = navidromeSessionSchema.safeParse(JSON.parse(raw))
        // A stale or hand-edited entry is treated as no session rather than fed into request building.
        return parsed.success ? parsed.data : null
      }
      catch {
        return null
      }
    },
    write: value => JSON.stringify(value),
  },
  // Without this the module would write `null` into storage for every visitor on import.
  writeDefaults: false,
})

export function getSession(): NavidromeSession | null {
  return session.value
}

export function setSession(next: NavidromeSession): void {
  session.value = next
}

export function clearSession(): void {
  session.value = null
}

function requireSession(): NavidromeSession {
  if (!session.value)
    throw new NavidromeError('sessionExpired')

  return session.value
}

/** Trailing slashes and stray whitespace are stripped once, so the stored address stays canonical. */
export function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.trim().replace(/\/+$/, '')
}

function buildUrl(baseUrl: string, path: string, params: SubsonicParams = {}): string {
  const normalized = normalizeBaseUrl(baseUrl)
  let parsed: URL

  try {
    parsed = new URL(normalized)
  }
  catch {
    // No dedicated kind for a malformed address — from the user's side it is the same fix as a wrong one.
    throw new NavidromeError('unreachable')
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:')
    throw new NavidromeError('unreachable')

  const url = new URL(`${normalized}${path}`)

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined)
      url.searchParams.set(key, String(value))
  }

  return url.toString()
}

function subsonicAuthParams(current: NavidromeSession): SubsonicParams {
  return {
    u: current.username,
    t: current.subsonicToken,
    s: current.subsonicSalt,
    v: SUBSONIC_API_VERSION,
    c: CLIENT_NAME,
    f: 'json',
  }
}

/**
 * The only way to tell "wrong address" from "CORS": `fetch` fails identically in both cases, while
 * a `no-cors` request still resolves (opaque) when the server is actually there.
 */
export async function probeReachability(baseUrl: string): Promise<boolean> {
  try {
    await fetch(buildUrl(baseUrl, '/rest/ping.view'), { mode: 'no-cors' })
    return true
  }
  catch {
    return false
  }
}

async function classifyNetworkFailure(baseUrl: string): Promise<NavidromeError> {
  return new NavidromeError(await probeReachability(baseUrl) ? 'cors' : 'unreachable')
}

async function request(url: string, baseUrl: string, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(url, init)
  }
  catch {
    throw await classifyNetworkFailure(baseUrl)
  }
}

/**
 * A 2xx response that is not JSON at all (a reverse proxy answering with HTML, for instance) must
 * not reach the user as a raw `SyntaxError` — each API maps it to its own diagnosis.
 */
async function readJson(response: Response, kindOnFailure: NavidromeErrorKind): Promise<unknown> {
  try {
    return await response.json()
  }
  catch {
    throw new NavidromeError(kindOnFailure, 'response is not JSON')
  }
}

export function buildSubsonicUrl(path: string, params: SubsonicParams = {}): string {
  const current = requireSession()
  return buildUrl(current.baseUrl, path, { ...subsonicAuthParams(current), ...params })
}

/**
 * Subsonic responses are validated with `parse` — the API is stable and its contract is versioned.
 * The payload handed to `schema` is the whole `subsonic-response` object.
 */
export async function subsonicFetch<Schema extends z.ZodType>(
  path: string,
  schema: Schema,
  params: SubsonicParams = {},
): Promise<z.infer<Schema>> {
  const current = requireSession()
  assertNotMixedContent(current.baseUrl)

  const url = buildSubsonicUrl(path, params)
  const response = await request(url, current.baseUrl)

  const statusError = errorFromHttpStatus(response.status)
  if (statusError)
    throw statusError

  const body = await readJson(response, 'notNavidrome')
  let payload: z.infer<typeof subsonicEnvelopeSchema>['subsonic-response']

  try {
    payload = subsonicEnvelopeSchema.parse(body)['subsonic-response']
  }
  catch {
    // Anything that is not a Subsonic envelope means the address points at something else entirely.
    throw new NavidromeError('notNavidrome')
  }

  if (payload.status === 'failed')
    throw errorFromSubsonicCode(payload.error?.code ?? 0, payload.error?.message)

  return schema.parse(payload)
}

interface NativeRequestOptions {
  /** Defaults to the stored session — passed explicitly by `login`, which runs before there is one. */
  baseUrl?: string
  jwt?: string
  method?: string
  body?: unknown
}

function resolveNativeTarget(options: NativeRequestOptions): { baseUrl: string, jwt?: string, authenticated: boolean } {
  if (options.baseUrl !== undefined)
    return { baseUrl: options.baseUrl, jwt: options.jwt, authenticated: false }

  const current = requireSession()
  return { baseUrl: current.baseUrl, jwt: options.jwt ?? current.jwt, authenticated: true }
}

/**
 * Native responses are validated with `safeParse` — this API is unstable, so a shape mismatch is a
 * version-incompatibility signal (`unsupportedShape`), not a network error.
 */
export async function nativeFetch<Schema extends z.ZodType>(
  path: string,
  schema: Schema,
  options: NativeRequestOptions = {},
): Promise<z.infer<Schema>> {
  const { method = 'GET', body } = options
  const { baseUrl, jwt, authenticated } = resolveNativeTarget(options)

  assertNotMixedContent(baseUrl)

  const headers: Record<string, string> = {}
  if (jwt)
    headers[JWT_HEADER] = `Bearer ${jwt}`
  if (body !== undefined)
    headers['Content-Type'] = 'application/json'

  const response = await request(buildUrl(baseUrl, path), baseUrl, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  })

  storeRefreshedJwt(response)

  const statusError = errorFromHttpStatus(response.status, { authenticated })
  if (statusError)
    throw statusError

  const parsed = schema.safeParse(await readJson(response, 'unsupportedShape'))
  if (!parsed.success)
    throw new NavidromeError('unsupportedShape', `${path}: ${parsed.error.issues[0]?.message ?? 'unknown validation error'}`)

  return parsed.data
}

/** Navidrome hands back a refreshed JWT on every native response, so an active session never expires. */
function storeRefreshedJwt(response: Response): void {
  const header = response.headers.get(JWT_HEADER)
  if (!header || !session.value)
    return

  const jwt = header.replace(/^Bearer\s+/i, '')
  if (jwt && jwt !== session.value.jwt)
    session.value = { ...session.value, jwt }
}
