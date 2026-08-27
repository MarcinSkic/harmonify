import { describe, expect, it } from 'vitest'
import { computeSubsonicToken, deriveSubsonicCredentials, generateSalt } from '../credentials'

describe('computeSubsonicToken', () => {
  it('should match the vector from the Subsonic specification', () => {
    expect(computeSubsonicToken('sesame', 'c19b2d')).toBe('26719a1196d2a940705a59634eb18eab')
  })

  it('should not match when the concatenation order is reversed', () => {
    expect(computeSubsonicToken('c19b2d', 'sesame')).not.toBe('26719a1196d2a940705a59634eb18eab')
  })

  it('should encode a non-ascii password as utf-8', () => {
    expect(computeSubsonicToken('zażółć', 'c19b2d')).toBe('7b34400273da36812a8733193a3fa4de')
  })
})

describe('deriveSubsonicCredentials', () => {
  it('should generate a 16 character hex salt', () => {
    const { salt } = deriveSubsonicCredentials('sesame')

    expect(salt).toMatch(/^[0-9a-f]{16}$/)
  })

  it('should generate a different salt on every call', () => {
    const salts = new Set(Array.from({ length: 20 }, () => generateSalt()))

    expect(salts.size).toBe(20)
  })

  it('should return a token derived from the generated salt', () => {
    const { salt, token } = deriveSubsonicCredentials('sesame')

    expect(token).toBe(computeSubsonicToken('sesame', salt))
  })
})
