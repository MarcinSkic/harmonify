import type { CoverageCategory, CoverageTrack } from '../categoryCoverage'
import { describe, expect, it } from 'vitest'
import { buildCoverageReport } from '../categoryCoverage'

const openings: CoverageCategory = {
  id: 'cat-op',
  displayName: 'Popularne Anime OP',
  match: { all: [{ is: { grouping: 'op' } }, { gt: { popularity: 2 } }] },
  points: 10,
}

const anime: CoverageCategory = {
  id: 'cat-anime',
  displayName: 'Anime',
  match: { all: [{ is: { genre: 'anime' } }] },
}

const tracks: CoverageTrack[] = [
  { id: 't1', fields: { grouping: ['op'], genre: ['Anime'], popularity: ['5'] } }, // both
  { id: 't2', fields: { grouping: ['op'], genre: ['Anime'], popularity: ['1'] } }, // anime only
  { id: 't3', fields: { genre: ['Rock'] } }, // none
]

describe('buildCoverageReport', () => {
  it('counts tracks per category', () => {
    const report = buildCoverageReport(tracks, [openings, anime], null)

    expect(report.total).toBe(3)
    expect(report.perCategory).toEqual([
      { categoryId: 'cat-op', displayName: 'Popularne Anime OP', points: 10, count: 1, tooFewForRounds: false },
      { categoryId: 'cat-anime', displayName: 'Anime', points: undefined, count: 2, tooFewForRounds: false },
    ])
  })

  it('counts tracks matched by no category and by more than one', () => {
    const report = buildCoverageReport(tracks, [openings, anime], null)

    expect(report.matchedByNone).toBe(1)
    expect(report.matchedByMultiple).toBe(1)
  })

  it('counts every track as unmatched when there are no categories', () => {
    const report = buildCoverageReport(tracks, [], null)

    expect(report).toEqual({
      total: 3,
      perCategory: [],
      matchedByNone: 3,
      matchedByMultiple: 0,
    })
  })

  it('reports an empty pool', () => {
    const report = buildCoverageReport([], [openings], 5)

    expect(report.total).toBe(0)
    expect(report.matchedByNone).toBe(0)
    expect(report.matchedByMultiple).toBe(0)
    expect(report.perCategory[0]).toEqual({
      categoryId: 'cat-op',
      displayName: 'Popularne Anime OP',
      points: 10,
      count: 0,
      tooFewForRounds: true,
    })
  })

  it('warns when a category holds fewer tracks than the planned rounds', () => {
    const report = buildCoverageReport(tracks, [openings, anime], 2)

    expect(report.perCategory.map(c => c.tooFewForRounds)).toEqual([true, false])
  })

  it('never warns when rounds are unlimited', () => {
    const report = buildCoverageReport(tracks, [openings, anime], null)

    expect(report.perCategory.every(c => !c.tooFewForRounds)).toBe(true)
  })
})
