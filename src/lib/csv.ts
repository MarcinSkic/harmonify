import type { PlaybackRange, TrackAnnotation, TrackOverlay } from '@/db/schemas'
import type { SubsonicSong } from '@/services/navidrome'
import Papa from 'papaparse'
import z from 'zod'

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

// Columns parseOverlayCSV actually reads into a row.
const OVERLAY_INPUT_COLUMNS = ['musicbrainzid', 'title', 'artist', 'playbackrange', 'previewimageurl', 'enabled']
// Identity columns serializeOverlayCSV writes for readability but that import never matches by them
// (see the fallback-key decision in the plan) — recognized so a round-trip of our own export does not
// dump them into customFields, but otherwise ignored.
const OVERLAY_IDENTITY_COLUMNS = ['albumid', 'discnumber', 'track']
const OVERLAY_RECOGNIZED_COLUMNS = [...OVERLAY_INPUT_COLUMNS, ...OVERLAY_IDENTITY_COLUMNS]

export interface OverlayCsvRow {
  musicBrainzId: string
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

    const musicBrainzId = get('musicbrainzid')?.trim()
    const title = get('title')?.trim() || undefined

    // musicBrainzId is the only matching key on import — no silent fallback to title/album/track.
    if (!musicBrainzId) {
      unmapped.push({ rowIndex: i + 1, title })
      return
    }

    const customFields: Record<string, string> = {}
    for (const [header, value] of Object.entries(raw)) {
      const normalized = header.trim().toLowerCase()
      if (OVERLAY_RECOGNIZED_COLUMNS.includes(normalized))
        continue
      const fieldName = header.trim()
      const fieldValue = value?.trim()
      if (!fieldName || !fieldValue)
        continue
      customFields[fieldName] = fieldValue
    }

    const playbackRangeRaw = get('playbackrange')
    const enabledRaw = get('enabled')

    rows.push({
      musicBrainzId,
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
      title: song.title,
    })),
    { columns: ['index', 'musicBrainzId', 'title'] },
  )
}
