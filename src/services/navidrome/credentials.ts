import { md5 } from 'js-md5'
import { z } from 'zod'

const SALT_BYTES = 8

/**
 * Subsonic authenticates with a client-chosen salt and `md5(password + salt)`, so the pair is
 * derived once at login and the password is dropped — it is never persisted anywhere.
 */
export function computeSubsonicToken(password: string, salt: string): string {
  return md5(password + salt)
}

export function generateSalt(): string {
  const bytes = new Uint8Array(SALT_BYTES)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('')
}

export function deriveSubsonicCredentials(password: string): { salt: string, token: string } {
  const salt = generateSalt()
  return { salt, token: computeSubsonicToken(password, salt) }
}

export const navidromeSessionSchema = z.object({
  baseUrl: z.string(),
  username: z.string(),
  subsonicSalt: z.string(),
  subsonicToken: z.string(),
  jwt: z.string(),
  serverVersion: z.string(),
})
export type NavidromeSession = z.infer<typeof navidromeSessionSchema>
