import { describe, expect, it } from 'vitest'
import { isVersionTested, NAVIDROME_TESTED_RANGE } from '../subsonic'

describe('isVersionTested', () => {
  it('should accept the lower bound of the tested range', () => {
    expect(isVersionTested(NAVIDROME_TESTED_RANGE.min)).toBe(true)
  })

  it('should reject the upper bound, which is exclusive', () => {
    expect(isVersionTested(NAVIDROME_TESTED_RANGE.maxExclusive)).toBe(false)
  })

  it.each(['0.54.1', '0.55.0', '0.60.1', '0.63.2'])('should accept %s from inside the range', (version) => {
    expect(isVersionTested(version)).toBe(true)
  })

  it.each(['0.53.9', '0.64.1', '1.0.0', '0.9.0'])('should reject %s from outside the range', (version) => {
    expect(isVersionTested(version)).toBe(false)
  })

  it('should accept the exact string reported by the server used for manual acceptance', () => {
    expect(isVersionTested('0.63.2 (be10f89c)')).toBe(true)
  })

  it('should ignore a build suffix', () => {
    expect(isVersionTested('0.54.3 (a1b2c3d)')).toBe(true)
    expect(isVersionTested('0.55.0-SNAPSHOT')).toBe(true)
  })

  it('should treat a version without a patch segment as its .0 release', () => {
    expect(isVersionTested('0.54')).toBe(true)
  })

  it.each(['', 'unknown', 'v.next', '54'])('should treat %s as untested', (version) => {
    expect(isVersionTested(version)).toBe(false)
  })
})
