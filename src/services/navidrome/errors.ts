export type NavidromeErrorKind
  = | 'mixedContent'
    | 'unreachable'
    | 'cors'
    | 'badCredentials'
    | 'sessionExpired'
    | 'rateLimited'
    | 'notNavidrome'
    | 'unsupportedShape'
    | 'serverError'

const MESSAGES: Record<NavidromeErrorKind, string> = {
  mixedContent: 'Harmonify is served over HTTPS while the Navidrome address uses HTTP — the browser blocks such a request before it leaves the page. Either run the standalone Harmonify build (over HTTP), put HTTPS in front of Navidrome, or allow insecure content for this site in your browser.',
  unreachable: 'Could not reach the server — check that the address is correct (including http:// or https:// and the port) and that Navidrome is running.',
  cors: 'The server answers, but blocks requests coming from the browser (CORS). Add the Harmonify address to the allowed origins in Navidrome (AllowedOrigins) or in your reverse proxy.',
  badCredentials: 'Wrong username or password.',
  sessionExpired: 'The session has expired — sign in to Navidrome again.',
  rateLimited: 'Too many attempts in a short time — wait a moment and try again.',
  notNavidrome: 'The server answering at this address is not Navidrome.',
  unsupportedShape: 'This Navidrome version returns data in an unknown format — the native API changed its response shape. Check whether the server version is inside the tested range.',
  serverError: 'Navidrome returned an error.',
}

export class NavidromeError extends Error {
  readonly kind: NavidromeErrorKind
  /** Set when the error came from an HTTP status, so a caller can narrow it to its own meaning. */
  readonly status?: number

  constructor(kind: NavidromeErrorKind, details?: string, status?: number) {
    super(details ? `${MESSAGES[kind]} (${details})` : MESSAGES[kind])
    this.name = 'NavidromeError'
    this.kind = kind
    this.status = status
  }
}

function currentPageProtocol(): string {
  return globalThis.location?.protocol ?? 'http:'
}

/**
 * Must be evaluated before any request goes out: the browser blocks an HTTP request from an HTTPS
 * page before it leaves the page, so the `no-cors` reachability probe is blocked as well and a
 * perfectly good `http://192.168.x.x:4533` would otherwise be reported as a wrong address.
 */
export function isMixedContent(baseUrl: string, pageProtocol: string = currentPageProtocol()): boolean {
  if (pageProtocol !== 'https:')
    return false

  try {
    return new URL(baseUrl).protocol === 'http:'
  }
  catch {
    // Unparseable address is not a mixed-content problem — it is reported as `unreachable`.
    return false
  }
}

export function assertNotMixedContent(baseUrl: string, pageProtocol: string = currentPageProtocol()): void {
  if (isMixedContent(baseUrl, pageProtocol))
    throw new NavidromeError('mixedContent')
}

/**
 * Maps an HTTP status to an error. Returns `null` for statuses that are not failures.
 * `authenticated` distinguishes a rejected stored session (401 → expired) from a rejected
 * login attempt (401 → wrong credentials).
 */
export function errorFromHttpStatus(status: number, { authenticated = false } = {}): NavidromeError | null {
  if (status === 401 || status === 403)
    return new NavidromeError(authenticated ? 'sessionExpired' : 'badCredentials', undefined, status)

  if (status === 429)
    return new NavidromeError('rateLimited', undefined, status)

  if (status >= 400)
    return new NavidromeError('serverError', `HTTP ${status}`, status)

  return null
}

/**
 * Subsonic reports failures with HTTP 200 and `status: 'failed'`, so the code carries the meaning.
 * Only the credential codes have a dedicated kind; anything else keeps the server's own message.
 */
export function errorFromSubsonicCode(code: number, message?: string): NavidromeError {
  const details = message ? `${message} [${code}]` : `code ${code}`

  if (code === 40 || code === 41)
    return new NavidromeError('badCredentials', details)

  return new NavidromeError('serverError', details)
}
