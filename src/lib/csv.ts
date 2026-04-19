import type { Category, PlaybackRange, TrackAnnotation } from '@/db/schemas'
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

const csvCategoryRowSchema = z.object({
  displayname: z.string().min(1),
  description: z.string().optional(),
  tagfilter: z.string().min(1).transform(s => s.split(',').map(t => t.trim()).filter(Boolean)),
  points: z.string().transform(s => s === '' ? undefined : Number(s)).pipe(z.number().positive().optional()),
  enabled: z.stringbool(),
  order: z.string().transform(s => Number(s)).pipe(z.number().int()),
})

export interface CsvCategoryRow {
  displayName: string
  description?: string
  tagFilter: string[]
  points?: number
  enabled: boolean
  order: number
}

export function serializeCategoriesCSV(categories: Category[]): string {
  const sorted = [...categories].sort((a, b) => a.order - b.order)
  return Papa.unparse(
    sorted.map(c => ({
      displayName: c.displayName,
      description: c.description ?? '',
      tagFilter: c.tagFilter.join(', '),
      points: c.points != null ? String(c.points) : '',
      enabled: String(c.enabled),
      order: String(c.order),
    })),
    { columns: ['displayName', 'description', 'tagFilter', 'points', 'enabled', 'order'] },
  )
}

export function parseCategoriesCSV(text: string): { rows: CsvCategoryRow[], errors: { rowIndex: number, message: string }[] } {
  const { data, errors: parseErrors } = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: h => h.trim().toLowerCase(),
  })

  if (parseErrors.length > 0 && data.length === 0)
    throw new Error(`CSV parse error: ${parseErrors[0].message}`)

  if (!data[0] || !('displayname' in data[0]))
    throw new Error('CSV missing required "displayName" column')

  if (!('tagfilter' in data[0]))
    throw new Error('CSV missing required "tagFilter" column')

  const rows: CsvCategoryRow[] = []
  const errors: { rowIndex: number, message: string }[] = []

  data.forEach((raw, i) => {
    const result = csvCategoryRowSchema.safeParse(raw)
    if (!result.success) {
      errors.push({ rowIndex: i + 1, message: result.error.issues[0]?.message ?? 'Invalid row' })
      return
    }
    const d = result.data
    rows.push({
      displayName: d.displayname,
      description: d.description,
      tagFilter: d.tagfilter,
      points: d.points,
      enabled: d.enabled,
      order: d.order,
    })
  })

  return { rows, errors }
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
