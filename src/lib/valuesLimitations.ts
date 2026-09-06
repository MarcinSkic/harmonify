import type { FieldLimitation, MultiValueMode, OtherValueLimit } from '@/db/schemas'
import type { FieldBag } from '@/lib/categoryPredicate'
import { foldCase, isBlank } from '@/lib/categoryPredicate'

export type { FieldLimitation, MultiValueMode, OtherValueLimit } from '@/db/schemas'

/** Everything the limits need from a track: an identity and its bag of fields. */
export interface LimitedTrack { id: string, fields: FieldBag }

export interface LimitationOutcome<TTrack extends LimitedTrack> {
  /** Tracks let through, in the order they arrived on input. */
  admitted: TTrack[]
  /** Input size — the first half of the "412 → 180" signal; `admitted.length` is the second. */
  totalIn: number
}

/** value → its running count, keyed by the folded (case-insensitive) value. */
type CountMap = Map<string, number>

/** field name → folded value → count, for `selfLimit`. */
type SelfCounters = Map<string, CountMap>

/** X field name → Y field name → folded X value → folded Y value → count, for `otherValuesLimit`. */
type PairCounters = Map<string, Map<string, Map<string, CountMap>>>

/** A single "does it fit, and if so, what does it charge" unit, resolved before any commit. */
interface Charge {
  currentCount: number
  limit: number
  commit: () => void
}

function bucketFor(counters: SelfCounters, fieldName: string): CountMap {
  let bucket = counters.get(fieldName)
  if (!bucket) {
    bucket = new Map()
    counters.set(fieldName, bucket)
  }
  return bucket
}

function pairBucketFor(counters: PairCounters, xField: string, yField: string, xValue: string): CountMap {
  let byYField = counters.get(xField)
  if (!byYField) {
    byYField = new Map()
    counters.set(xField, byYField)
  }
  let byXValue = byYField.get(yField)
  if (!byXValue) {
    byXValue = new Map()
    byYField.set(yField, byXValue)
  }
  let bucket = byXValue.get(xValue)
  if (!bucket) {
    bucket = new Map()
    byXValue.set(xValue, bucket)
  }
  return bucket
}

/**
 * The distinct, folded, non-blank values a track carries for one field, honoring `multiValue`.
 * `'first'` picks the first value that survives the blank filter, not raw index 0 — a leading
 * blank must not shadow a real value.
 */
function distinctValues(bag: FieldBag, name: string, multiValue: MultiValueMode = 'all'): string[] {
  const nonBlank = (bag[name] ?? []).filter(value => !isBlank(value))
  if (nonBlank.length === 0)
    return []

  const picked = multiValue === 'first' ? [nonBlank[0]] : nonBlank
  return [...new Set(picked.map(foldCase))]
}

function pairCharges(
  xField: string,
  valuesX: string[],
  pairLimit: OtherValueLimit,
  bag: FieldBag,
  pairCounters: PairCounters,
): Charge[] {
  const valuesY = distinctValues(bag, pairLimit.name, pairLimit.multiValue)
  if (valuesY.length === 0)
    return []

  const charges: Charge[] = []
  for (const x of valuesX) {
    const bucket = pairBucketFor(pairCounters, xField, pairLimit.name, x)
    for (const y of valuesY) {
      charges.push({
        currentCount: bucket.get(y) ?? 0,
        limit: pairLimit.limit,
        commit: () => bucket.set(y, (bucket.get(y) ?? 0) + 1),
      })
    }
  }
  return charges
}

/** All charges one track owes across every limitation entry, before any of them is committed. */
function chargesFor(
  bag: FieldBag,
  limitations: FieldLimitation[],
  selfCounters: SelfCounters,
  pairCounters: PairCounters,
): Charge[] {
  const charges: Charge[] = []

  for (const limitation of limitations) {
    const valuesX = distinctValues(bag, limitation.name, limitation.multiValue)
    if (valuesX.length === 0)
      continue // no value in this field on this track: the entry does not apply at all

    if (limitation.selfLimit !== undefined) {
      const bucket = bucketFor(selfCounters, limitation.name)
      for (const x of valuesX) {
        charges.push({
          currentCount: bucket.get(x) ?? 0,
          limit: limitation.selfLimit,
          commit: () => bucket.set(x, (bucket.get(x) ?? 0) + 1),
        })
      }
    }

    for (const pairLimit of limitation.otherValuesLimit ?? [])
      charges.push(...pairCharges(limitation.name, valuesX, pairLimit, bag, pairCounters))
  }

  return charges
}

/**
 * Trims a track pool so that no field value (and no pair of field values) repeats past the caller's
 * configured limits. This function is the executable specification of the deduplication model
 * (main plan §4.3): Harmonify v6 re-implements it, probably in another language, so every rule
 * below is normative.
 *
 * - **Order is an input, not a decision of this function.** Tracks are considered one after another
 *   in the order given; the function never shuffles and never calls `Math.random()`. Randomness is
 *   the caller's responsibility.
 * - **An empty list of limitations** (or entries with neither `selfLimit` nor `otherValuesLimit`)
 *   is the identity: the same tracks, in the same order.
 * - **Field values** are read as `bag[name] ?? []`, filtered of blanks (`isBlank` from
 *   `categoryPredicate`), and folded (`foldCase`) **only for the counter key** — field lookup
 *   itself stays exact, mirroring `categoryPredicate`. Values that fold to the same key count once,
 *   even when they repeat within a single track's own value list.
 * - **`multiValue`** (`'all' | 'first'`, default `'all'`) applies per entry, separately for the
 *   entry's own field and for each `otherValuesLimit` pair field. `'first'` takes the first
 *   **non-blank** value, not raw index 0.
 * - **No value in field X → the entry does not apply to this track at all**: neither `selfLimit`
 *   nor any of its `otherValuesLimit` pairs (main plan §4.3: "tracks without a value in the field
 *   are outside the limit").
 * - **No value in field Y while X is present** → `selfLimit` is still charged as usual; no pair
 *   counter is created and nothing about Y blocks the track.
 * - **`selfLimit`:** one counter per folded X value. The track passes when, for **every** one of
 *   its X values, that counter is `< selfLimit`.
 * - **`otherValuesLimit[{ name: Y, limit }]`:** one counter per (folded X, folded Y) pair, for
 *   **every combination** of the track's X values and Y values. The track passes when every one
 *   of those pair counters is `< limit`.
 * - **A duplicate `name` inside one entry's `otherValuesLimit` is rejected before this function
 *   ever runs** (`findDuplicatePairLimitationName` in `categoryJson.ts`, enforced by the service and
 *   the edit dialog). This function does not deduplicate pair names itself and assumes they are
 *   already unique per entry — two pair limits naming the same Y field would resolve to the same
 *   counter but be charged once per limit, i.e. more than once per admitted track, breaking the
 *   "one counter per pair" promise above.
 * - **Admission is atomic:** a track is admitted only when **all** counters that apply to it have
 *   room, and admission then charges **all** of them at once. Never partially — this is the
 *   "promise of the limit" that rules out an "OR" semantics (main plan §4.3).
 * - **Multi-valued fields charge every value** (`multiValue: 'all'`): `work: [Madoka, Nanoha]`
 *   charges both buckets and the track is rejected when **either** is already full.
 * - **Several entries in the array** (e.g. `work` and `album`) act independently — all of them
 *   must let the track through.
 * - **`selfLimit`/`limit` of `0`** blocks everything that has a value in that field (the schema's
 *   `.int().min(0)` rejects negative numbers outright).
 * - **`exceptions` are ignored by this engine.** They are validated and stored so a round-trip
 *   through the JSON format does not lose data, but this function never reads them — activating
 *   them is an extension point left to v5.x (main plan §4.3).
 */
export function applyValuesLimitations<TTrack extends LimitedTrack>(
  tracks: TTrack[],
  limitations: FieldLimitation[],
): LimitationOutcome<TTrack> {
  const selfCounters: SelfCounters = new Map()
  const pairCounters: PairCounters = new Map()
  const admitted: TTrack[] = []

  for (const track of tracks) {
    const charges = chargesFor(track.fields, limitations, selfCounters, pairCounters)
    if (charges.every(charge => charge.currentCount < charge.limit)) {
      for (const charge of charges) charge.commit()
      admitted.push(track)
    }
  }

  return { admitted, totalIn: tracks.length }
}
