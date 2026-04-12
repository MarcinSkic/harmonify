import type { PlaybackRange, TrackAnnotation } from '@/db/schemas'
import Papa from 'papaparse'
import z from 'zod'

const PLAYBACK_RANGE_RE = /^(\d+):(\d+)\s*-\s*(\d+):(\d+)$/

function parsePlaybackRange(str: string): PlaybackRange | null {
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
    }))
}
