import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { clearSession, setSession } from '../client'
import { assertNotMixedContent, errorFromHttpStatus, errorFromSubsonicCode, isMixedContent, NavidromeError } from '../errors'
import { login } from '../native'
import { getAlbum, ping } from '../subsonic'

function jsonResponse(body: unknown, status = 200): Response {
  return {
    status,
    headers: { get: () => null },
    json: async () => body,
  } as unknown as Response
}

function captureError(action: () => unknown): unknown {
  try {
    action()
    return null
  }
  catch (error) {
    return error
  }
}

/** A 2xx response carrying HTML — what a misconfigured reverse proxy answers with. */
function htmlResponse(): Response {
  return {
    status: 200,
    headers: { get: () => null },
    json: async () => {
      throw new SyntaxError('Unexpected token "<", "<!DOCTYPE "... is not valid JSON')
    },
  } as unknown as Response
}

function subsonicFailure(code: number, message?: string): Response {
  return jsonResponse({
    'subsonic-response': { status: 'failed', version: '1.16.1', error: { code, message } },
  })
}

describe('isMixedContent', () => {
  it('should flag an http server requested from an https page', () => {
    expect(isMixedContent('http://192.168.1.10:4533', 'https:')).toBe(true)
  })

  it('should not flag an https server requested from an https page', () => {
    expect(isMixedContent('https://music.example.com', 'https:')).toBe(false)
  })

  it('should not flag an http server requested from an http page', () => {
    expect(isMixedContent('http://192.168.1.10:4533', 'http:')).toBe(false)
  })

  it('should not flag an unparseable address', () => {
    expect(isMixedContent('192.168.1.10:4533', 'https:')).toBe(false)
  })
})

describe('assertNotMixedContent', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('should detect mixed content without performing any request', () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)

    const error = captureError(() => assertNotMixedContent('http://192.168.1.10:4533', 'https:'))

    expect(error).toBeInstanceOf(NavidromeError)
    expect((error as NavidromeError).kind).toBe('mixedContent')
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('should pass a same-protocol address through', () => {
    expect(() => assertNotMixedContent('http://192.168.1.10:4533', 'http:')).not.toThrow()
  })
})

describe('error messages', () => {
  // Phase 0 is accepted on "a bad configuration says what to fix", so the actionable parts of the
  // two messages a first run is most likely to hit are pinned here.
  it('should offer the three ways out of a mixed-content block', () => {
    const message = new NavidromeError('mixedContent').message

    expect(message).toContain('standalone')
    expect(message).toContain('HTTPS in front of Navidrome')
    expect(message).toContain('insecure content')
  })

  it('should point at the origin allow-list when the browser is blocked by CORS', () => {
    const message = new NavidromeError('cors').message

    expect(message).toContain('AllowedOrigins')
    expect(message).toContain('reverse proxy')
  })

  it('should name the address and the port as what to check when unreachable', () => {
    expect(new NavidromeError('unreachable').message).toContain('port')
  })
})

describe('errorFromSubsonicCode', () => {
  it.each([40, 41])('should map code %i to badCredentials', (code) => {
    expect(errorFromSubsonicCode(code).kind).toBe('badCredentials')
  })

  it.each([0, 10, 30, 50, 70])('should map unmapped code %i to serverError', (code) => {
    expect(errorFromSubsonicCode(code).kind).toBe('serverError')
  })

  it('should carry the message reported by the server', () => {
    expect(errorFromSubsonicCode(70, 'Song not found').message).toContain('Song not found')
  })
})

describe('errorFromHttpStatus', () => {
  it('should map 401 on an authenticated request to sessionExpired', () => {
    expect(errorFromHttpStatus(401, { authenticated: true })?.kind).toBe('sessionExpired')
  })

  it('should map 401 on a login attempt to badCredentials', () => {
    expect(errorFromHttpStatus(401)?.kind).toBe('badCredentials')
  })

  it('should map 429 to rateLimited', () => {
    expect(errorFromHttpStatus(429)?.kind).toBe('rateLimited')
  })

  it.each([500, 502, 404])('should map %i to serverError', (status) => {
    expect(errorFromHttpStatus(status)?.kind).toBe('serverError')
  })

  it.each([200, 204, 302])('should not treat %i as a failure', (status) => {
    expect(errorFromHttpStatus(status)).toBeNull()
  })
})

describe('subsonic request error mapping', () => {
  beforeEach(() => {
    setSession({
      baseUrl: 'http://localhost:4533',
      username: 'admin',
      subsonicSalt: 'c19b2d',
      subsonicToken: '26719a1196d2a940705a59634eb18eab',
      jwt: 'jwt',
      serverVersion: '0.54.0',
    })
  })

  afterEach(() => {
    clearSession()
    vi.unstubAllGlobals()
  })

  it('should map a failed subsonic response with code 40 to badCredentials', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(subsonicFailure(40, 'Wrong username or password')))

    await expect(ping()).rejects.toMatchObject({ kind: 'badCredentials' })
  })

  it('should report cors when the request fails but the no-cors probe succeeds', async () => {
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(jsonResponse({}, 0))
    vi.stubGlobal('fetch', fetchMock)

    await expect(ping()).rejects.toMatchObject({ kind: 'cors' })
  })

  it('should report unreachable when the no-cors probe fails too', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))

    await expect(ping()).rejects.toMatchObject({ kind: 'unreachable' })
  })

  it('should report notNavidrome when the answer is not a subsonic envelope', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ hello: 'world' })))

    await expect(ping()).rejects.toMatchObject({ kind: 'notNavidrome' })
  })

  it('should report notNavidrome when another server answers the ping', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({
      'subsonic-response': { status: 'ok', version: '1.16.1', type: 'gonic', serverVersion: '0.16.4' },
    })))

    await expect(ping()).rejects.toMatchObject({ kind: 'notNavidrome' })
  })

  it('should report notNavidrome when a 200 response is not JSON', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(htmlResponse()))

    await expect(ping()).rejects.toMatchObject({ kind: 'notNavidrome' })
  })

  it('should report unsupportedShape when the native API answers with non-JSON', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(htmlResponse()))

    await expect(login('http://localhost:4533', 'admin', 'sesame'))
      .rejects
      .toMatchObject({ kind: 'unsupportedShape' })
  })

  it('should report notNavidrome when the ping endpoint answers 404', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({}, 404)))

    await expect(ping()).rejects.toMatchObject({ kind: 'notNavidrome' })
  })

  it('should keep a 404 on any other endpoint as a server error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({}, 404)))

    await expect(getAlbum('missing-id')).rejects.toMatchObject({ kind: 'serverError' })
  })

  it('should map a 429 to rateLimited', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({}, 429)))

    await expect(ping()).rejects.toMatchObject({ kind: 'rateLimited' })
  })
})

describe('mixed content guard ordering', () => {
  afterEach(() => {
    vi.doUnmock('../errors')
    vi.resetModules()
    vi.unstubAllGlobals()
    localStorage.clear()
  })

  it('should reject before the request leaves the page', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)

    // jsdom's `location` is unforgeable, so the page protocol is faked at the guard instead.
    vi.resetModules()
    vi.doMock('../errors', async (importOriginal) => {
      const actual = await importOriginal<typeof import('../errors')>()

      return {
        ...actual,
        assertNotMixedContent: () => {
          throw new actual.NavidromeError('mixedContent')
        },
      }
    })

    const { setSession } = await import('../client')
    const { ping } = await import('../subsonic')

    setSession({
      baseUrl: 'http://192.168.1.10:4533',
      username: 'admin',
      subsonicSalt: 'c19b2d',
      subsonicToken: '26719a1196d2a940705a59634eb18eab',
      jwt: 'jwt',
      serverVersion: '0.54.0',
    })

    await expect(ping()).rejects.toMatchObject({ kind: 'mixedContent' })
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})
