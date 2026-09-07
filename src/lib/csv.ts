import type { PlaybackRange, TrackAnnotation, TrackOverlay } from '@/db/schemas'
import type { SubsonicSong } from '@/services/navidrome'
import Papa from 'papaparse'
import z from 'zod'
import { deriveOverlayKey } from '@/lib/trackOverlayKey'

const PLAYBACK_RANGE_RE = /^(\d+):(\d+)\s*-\s*(\d+):(\d+)$/

export function parsePlaybackRange(str: string): PlaybackRange | null {
  const match = str.trim().match(PLAYBACK_RANGE_RE)
  if (!match)
    return null
  const startMs = (Number(match[1]) * 60 + Number(match[2])) * 1000
  const endMs = (Number(match[3]) * 60 + Number(match[4])) * 1000
  return { startMs, endMs }
}

export function parseCSV(text: string): TrackAnnotation[] {
  const { data, errors } = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: h => h.trim().toLowerCase(),
  })

  if (errors.length > 0 && data.length === 0)
    throw new Error(`CSV parse error: ${errors[0].message}`)

  if (!data[0] || !('sourceid' in data[0]))
    throw new Error('CSV missing required "sourceId" column')

  return data
    .filter(row => !!row.sourceid?.trim())
    .map(row => ({
      sourceId: row.sourceid.trim(),
      tags: row.tags ? row.tags.split(',').map((t: string) => t.trim()).filter(Boolean) : [],
      playbackRange: row.playbackrange ? parsePlaybackRange(row.playbackrange) : null,
      enabled: row.enabled != null && row.enabled.trim() !== ''
        ? z.stringbool().parse(row.enabled.trim().toLowerCase())
        : undefined,
      previewImageUrl: row.previewimageurl?.trim() || undefined,
    }))
}

// Track overlay CSV

export function formatPlaybackRange(range: PlaybackRange): string {
  const format = (ms: number) => {
    const totalSeconds = Math.round(ms / 1000)
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    return `${minutes}:${String(seconds).padStart(2, '0')}`
  }
  return `${format(range.startMs)}-${format(range.endMs)}`
}

// Columns parseOverlayCSV reads into a row — the same set serializeOverlayCSV writes, in that order.
// `albumId/discNumber/track` are matching input, not decoration: a row without `musicBrainzId` is
// matched by the composite key built from them plus `title`, exactly like a track loaded from
// Navidrome (see `deriveOverlayKey`). Anything outside this set becomes a custom field.
const OVERLAY_INPUT_COLUMNS = ['musicbrainzid', 'albumid', 'discnumber', 'track', 'title', 'artist', 'playbackrange', 'previewimageurl', 'enabled']

export interface OverlayCsvRow {
  /** `deriveOverlayKey(identity)` — the one place an imported row's overlay key is computed. */
  key: string
  /**
   * Identity the row carries, written straight into the overlay so an import does not have to guess
   * it. `title` is optional: a row keyed by `musicBrainzId` needs no `title` column at all.
   */
  identity: {
    musicBrainzId?: string
    albumId?: string
    discNumber?: number
    track?: number
    title?: string
  }
  artist?: string
  /**
   * Three-state like `previewImageUrl`/`enabled`: `undefined` when the `playbackRange` column is
   * absent from the header (import must not touch the existing value), `null` when the column is
   * present but the cell is empty/unparsable (import explicitly clears it).
   */
  playbackRange?: PlaybackRange | null
  previewImageUrl?: string
  enabled?: boolean
  customFields: Record<string, string>
}

/**
 * Key-bearing cells are kept exactly as written, `trim()` only decides whether a cell counts as
 * empty: `deriveOverlayKey` does not trim either, and an overlay created in the app takes
 * `song.title` straight from Navidrome, so trimming here would derive a different key for a
 * sloppily tagged title and silently orphan the overlay instead of round-tripping it.
 */
function parseIdentityText(raw: string | undefined): string | undefined {
  return raw?.trim() ? raw : undefined
}

/**
 * `serializeOverlayCSV` writes an empty cell for a missing `discNumber`/`track`, and `Number('')` is
 * `0` — so an empty cell must become `undefined`, or the composite key would silently drift from
 * `album|||title` to `album|0|0|title` on a round trip. Kept as numbers, not strings: the value
 * flows on into the overlay record, where it is typed as one.
 */
function parseIdentityNumber(raw: string | undefined): number | undefined {
  const trimmed = raw?.trim()
  if (!trimmed)
    return undefined
  const value = Number(trimmed)
  return Number.isFinite(value) ? value : undefined
}

/**
 * Headers are NOT lower-cased globally here (unlike `parseCSV` above): any
 * column outside the known set becomes a `customFields` key and must keep the exact casing the user
 * gave it (so `Popularity` does not come back from export as `popularity`). Known columns are still
 * matched case-insensitively.
 */
export function parseOverlayCSV(text: string): { rows: OverlayCsvRow[], unmapped: Array<{ rowIndex: number, title?: string }> } {
  const { data, errors } = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
  })

  if (errors.length > 0 && data.length === 0)
    throw new Error(`CSV parse error: ${errors[0].message}`)

  const headers = data[0] ? Object.keys(data[0]) : []
  const knownHeaderByColumn = new Map<string, string>()
  for (const header of headers) {
    const normalized = header.trim().toLowerCase()
    if (OVERLAY_INPUT_COLUMNS.includes(normalized))
      knownHeaderByColumn.set(normalized, header)
  }

  const rows: OverlayCsvRow[] = []
  const unmapped: Array<{ rowIndex: number, title?: string }> = []

  data.forEach((raw, i) => {
    const get = (column: string) => {
      const header = knownHeaderByColumn.get(column)
      return header ? raw[header] : undefined
    }

    const musicBrainzId = parseIdentityText(get('musicbrainzid'))
    const albumId = parseIdentityText(get('albumid'))
    const title = parseIdentityText(get('title'))

    // Only rows no key can be derived from stay unmapped: without an MBID the composite key needs
    // both `albumId` and `title`, so a hand-written list of titles is still reported, not guessed at.
    if (!musicBrainzId && (!albumId || !title)) {
      // Reported to the user rather than matched on, so here the surrounding whitespace goes.
      unmapped.push({ rowIndex: i + 1, title: title?.trim() })
      return
    }

    const customFields: Record<string, string> = {}
    for (const [header, value] of Object.entries(raw)) {
      const normalized = header.trim().toLowerCase()
      if (OVERLAY_INPUT_COLUMNS.includes(normalized))
        continue
      const fieldName = header.trim()
      const fieldValue = value?.trim()
      if (!fieldName || !fieldValue)
        continue
      customFields[fieldName] = fieldValue
    }

    const playbackRangeRaw = get('playbackrange')
    const enabledRaw = get('enabled')

    const identity = {
      musicBrainzId,
      albumId,
      discNumber: parseIdentityNumber(get('discnumber')),
      track: parseIdentityNumber(get('track')),
      title,
    }

    rows.push({
      // A row keyed by MBID may carry no title; the empty string never reaches the composite branch.
      key: deriveOverlayKey({ ...identity, title: title ?? '' }),
      identity,
      artist: get('artist')?.trim() || undefined,
      playbackRange: knownHeaderByColumn.has('playbackrange')
        ? (playbackRangeRaw?.trim() ? parsePlaybackRange(playbackRangeRaw) : null)
        : undefined,
      previewImageUrl: get('previewimageurl')?.trim() || undefined,
      enabled: enabledRaw != null && enabledRaw.trim() !== ''
        ? z.stringbool().parse(enabledRaw.trim().toLowerCase())
        : undefined,
      customFields,
    })
  })

  return { rows, unmapped }
}

const OVERLAY_CSV_COLUMNS = ['musicBrainzId', 'albumId', 'discNumber', 'track', 'title', 'artist', 'playbackRange', 'previewImageUrl', 'enabled']

export function serializeOverlayCSV(rows: TrackOverlay[]): string {
  const customFieldColumns = [...new Set(rows.flatMap(r => Object.keys(r.customFields)))].sort()
  const columns = [...OVERLAY_CSV_COLUMNS, ...customFieldColumns]

  return Papa.unparse(
    rows.map((r) => {
      const record: Record<string, string> = {
        musicBrainzId: r.musicBrainzId ?? '',
        albumId: r.albumId ?? '',
        discNumber: r.discNumber != null ? String(r.discNumber) : '',
        track: r.track != null ? String(r.track) : '',
        title: r.title,
        artist: r.artist ?? '',
        playbackRange: r.playbackRange ? formatPlaybackRange(r.playbackRange) : '',
        previewImageUrl: r.previewImageUrl ?? '',
        enabled: String(r.enabled),
      }
      for (const column of customFieldColumns)
        record[column] = r.customFields[column] ?? ''
      return record
    }),
    { columns },
  )
}

/**
 * Bridges the old `sourceId`-keyed CSV annotations to the new overlay key: export-only helper, no
 * matching import counterpart. Not part of the overlay itself — just a snapshot of identifiers for
 * the currently loaded album/playlist to match by hand against an old sheet.
 */
export function serializeTrackIdentityCSV(songs: SubsonicSong[]): string {
  return Papa.unparse(
    songs.map((song, i) => ({
      index: String(i + 1),
      musicBrainzId: song.musicBrainzId ?? '',
      albumId: song.albumId ?? '',
      discNumber: song.discNumber != null ? String(song.discNumber) : '',
      track: song.track != null ? String(song.track) : '',
      title: song.title,
    })),
    { columns: ['index', 'musicBrainzId', 'albumId', 'discNumber', 'track', 'title'] },
  )
}
