import { describe, expect, it } from 'vitest'
import { computeTargetRotation, truncateLabel } from '../wheel'

describe('computeTargetRotation', () => {
  function landedAngle(target: number, winnerIndex: number, n: number) {
    const sector = 360 / n
    const midAngle = (winnerIndex + 0.5) * sector
    return ((midAngle + target) % 360 + 360) % 360
  }

  it('lands the winner sector under the top pointer', () => {
    for (const n of [2, 3, 5, 8]) {
      for (let i = 0; i < n; i++) {
        const target = computeTargetRotation(0, i, n)
        const landed = landedAngle(target, i, n)
        // Landed angle should be ~0 (or ~360) — winner center at the top.
        const dist = Math.min(landed, 360 - landed)
        expect(dist).toBeLessThan(1e-6)
      }
    }
  })

  it('always spins forward past the current rotation with full turns', () => {
    const current = 137.5
    const target = computeTargetRotation(current, 2, 5)
    expect(target).toBeGreaterThan(current)
    expect(target - current).toBeGreaterThanOrEqual(5 * 360)
  })

  it('keeps landing correct from a non-zero current rotation', () => {
    const target = computeTargetRotation(1023.4, 3, 5)
    const landed = landedAngle(target, 3, 5)
    const dist = Math.min(landed, 360 - landed)
    expect(dist).toBeLessThan(1e-6)
  })
})

describe('truncateLabel', () => {
  it('leaves short names untouched', () => {
    expect(truncateLabel('Team A', 12)).toBe('Team A')
  })

  it('truncates long names with an ellipsis', () => {
    expect(truncateLabel('A very long team name', 12)).toBe('A very long …')
  })
})
