import type { FieldMinDistance } from '@/db/schemas'
import type { FieldBag } from '@/lib/categoryPredicate'
import { foldCase, isBlank } from '@/lib/categoryPredicate'

export type { FieldMinDistance } from '@/db/schemas'

/** Everything the spacing rules need from a track: its bag of fields. */
export interface DistanceTrack { fields: FieldBag }

/** One (field, value) pair of the chosen track that determined its score. */
export interface LimitingValue {
  /** Rule field name, spelled exactly as the rule spells it. */
  field: string
  /** The **folded** value — the identity the gap was measured against, not the track's spelling. */
  value: string
  /** Rounds between the last track carrying this value and the candidate's slot; always finite here. */
  gap: number
  /** The rule's `distance` this gap was measured against. */
  required: number
}

export interface MinDistanceChoice<TTrack> {
  track: TTrack
  /** `min` of `gap - distance` over the chosen track's (rule field, value) pairs; `+∞` when none apply. */
  score: number
  /** `true` ⟺ no candidate satisfied the rules, so the least-offending one was taken. */
  fallback: boolean
  /** The pairs that produced `score`, in rule order then value order; empty when `score` is `+∞`. */
  limiting: LimitingValue[]
  /**
   * How many candidates had `score >= 0` — the pool the choice was drawn from, except under
   * `fallback`, where it is `0` and the choice ranged over every candidate.
   */
  eligibleCount: number
}

/** A candidate's score together with the pairs that produced it. */
interface CandidateScore { score: number, limiting: LimitingValue[] }

/** field name → folded value → its **last** index in the history. */
type LastSeen = Map<string, Map<string, number>>

/**
 * One pass over the history, keyed only by the fields the rules name. Everything else in a bag is
 * irrelevant to the choice, and scanning per candidate would be `O(candidates × history)`.
 */
function scanHistory(history: FieldBag[], rules: FieldMinDistance[]): LastSeen {
  const lastSeen: LastSeen = new Map()
  for (const rule of rules) {
    if (!lastSeen.has(rule.name))
      lastSeen.set(rule.name, new Map())
  }

  history.forEach((bag, index) => {
    for (const [field, byValue] of lastSeen) {
      for (const value of bag[field] ?? []) {
        if (!isBlank(value))
          byValue.set(foldCase(value), index) // later rounds overwrite earlier ones: last wins
      }
    }
  })

  return lastSeen
}

/** The score of one candidate plus the pairs that produced it. */
function scoreCandidate(
  bag: FieldBag,
  rules: FieldMinDistance[],
  lastSeen: LastSeen,
  historyLength: number,
): CandidateScore {
  let score = Number.POSITIVE_INFINITY
  let limiting: LimitingValue[] = []

  for (const rule of rules) {
    const byValue = lastSeen.get(rule.name)
    const seen = new Set<string>()

    for (const raw of bag[rule.name] ?? []) {
      if (isBlank(raw))
        continue

      const value = foldCase(raw)
      if (seen.has(value))
        continue
      seen.add(value)

      const lastIndex = byValue?.get(value)
      if (lastIndex === undefined)
        continue // never played: the gap is +∞ and can never lower the score

      const gap = historyLength - lastIndex
      const pairScore = gap - rule.distance
      if (pairScore > score)
        continue

      const pair: LimitingValue = { field: rule.name, value, gap, required: rule.distance }
      if (pairScore < score) {
        score = pairScore
        limiting = [pair]
      }
      else {
        limiting.push(pair)
      }
    }
  }

  return { score, limiting }
}

/**
 * Picks the track to play next so that tracks sharing a field value do not cluster. This function is
 * the executable specification of the minimum-distance model (main plan §4.4): Harmonify v6
 * re-implements it, probably in another language, so every rule below is normative.
 *
 * - **The history** is the field bags of the tracks already played, oldest first. The candidate
 *   would land at position `history.length`.
 * - **The gap** for value `v` of field `F` is `history.length - i`, where `i` is the **last** index
 *   in the history whose bag carries `v` in field `F` (compared case-folded). No hit → `+∞`.
 *   The track played immediately before the candidate has a gap of `1`. `distance: 5` lets round 3
 *   and round 8 through and blocks round 3 and round 7. `distance: 1` is the identity, because the
 *   smallest gap that can exist is `1`, so `gap - 1` is never negative — which is why the persisted
 *   configuration requires `distance >= 2` (`fieldMinDistanceSchema`), 2 being the tightest rule
 *   that does anything ("not back to back"). This function still computes for any number: validating
 *   the configuration belongs at the boundary, not in the arithmetic, exactly as in
 *   `applyValuesLimitations`.
 * - **The score** of a candidate is the `min` of `gap - distance` over every (rule field, candidate
 *   value in that field) pair. A track with no value in any rule field scores `+∞`.
 * - **Eligibility:** a candidate is eligible ⟺ `score >= 0`.
 * - **The choice is the first eligible candidate in input order** — not the highest-scoring one.
 *   The caller shuffles the pool once (decision F4.4), so scanning that order and stopping at
 *   the first candidate the rules allow keeps the pick uniform among everything the rules allow;
 *   taking `argmax` would systematically favour the least recently used value instead.
 * - **When no candidate is eligible**, the choice is `argmax score` — the track that breaks the
 *   rules by the smallest margin — and `fallback` is `true`. `gap - distance` (rather than the bare
 *   gap) is what makes that ranking meaningful across fields: 4 rounds ago under `distance: 5` beats
 *   2 rounds ago under `distance: 10`, because the second is further from being satisfied.
 * - **Ties are broken by input order** (the first candidate wins) and **this function never calls
 *   `Math.random()`**. Randomness belongs to the caller, exactly as in `applyValuesLimitations` —
 *   that is what makes the choice deterministic and testable.
 * - **An empty list of candidates** yields `undefined`: there is nothing to play, and that is the
 *   caller's decision to interpret (exhausted category vs. exhausted pool).
 * - **An empty list of rules** is the identity: the first candidate in input order, `score` `+∞`,
 *   `fallback` `false`, `eligibleCount` equal to the number of candidates.
 * - **Field lookup is exact** (`Grouping` ≠ `grouping`), while values are compared folded
 *   (`foldCase`) and blank values are skipped (`isBlank`) — the same reading as `categoryPredicate`
 *   and `valuesLimitations`.
 * - **A field absent from a candidate's bag** (or holding only blanks) is not constrained by its
 *   rule at all, mirroring "tracks without a value in the field are outside the limit" (main plan
 *   §4.3). Such a track is always eligible.
 * - **Multi-valued fields:** *every* value constrains (there is no `multiValue` switch here,
 *   decision F4.5); the tightest one decides, since the score is a `min`. Values that fold to the
 *   same key are considered once.
 * - **`limiting`** reports the pairs that produced `score` — including for an eligible track, where
 *   they say how much room was left, not what blocked it. It is empty exactly when `score` is `+∞`,
 *   and ordered by rule, then by the candidate's value order within that rule. The value is stored
 *   folded, because that is the identity the gap was measured against.
 * - **A duplicate `name` in `rules` is rejected before this function runs** (the service and the
 *   JSON importer enforce it, as in v5 §4.3): two entries for `work` are two different answers to
 *   one question, not a sum. This function does not deduplicate them; if two slipped through, the
 *   tighter `distance` would simply win through the `min`.
 */
export function selectByMinDistance<TTrack extends DistanceTrack>(
  candidates: TTrack[],
  history: FieldBag[],
  rules: FieldMinDistance[],
): MinDistanceChoice<TTrack> | undefined {
  if (candidates.length === 0)
    return undefined

  const lastSeen = scanHistory(history, rules)
  const scored = candidates.map(track => ({
    track,
    ...scoreCandidate(track.fields, rules, lastSeen, history.length),
  }))

  // Every eligible candidate ranks equally at 0, so the first of them wins; below 0 the least
  // negative score wins. One comparison expresses both halves of the rule.
  const rank = (score: number): number => Math.min(score, 0)
  const chosen = scored.reduce((best, current) => rank(current.score) > rank(best.score) ? current : best)
  const eligibleCount = scored.filter(candidate => candidate.score >= 0).length

  return { ...chosen, fallback: eligibleCount === 0, eligibleCount }
}
