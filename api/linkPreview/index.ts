import type { VercelRequest, VercelResponse } from '@vercel/node'
import { Buffer } from 'node:buffer'

const ALLOWED_HOSTS = ['img.anili.st']

export default async function handler(
  request: VercelRequest,
  response: VercelResponse,
) {
  const imageUrl = request.query.url
  if (typeof imageUrl !== 'string') {
    return response.status(400).json({ error: 'Missing url parameter' })
  }

  let parsed: URL
  try {
    parsed = new URL(imageUrl)
  }
  catch {
    return response.status(400).json({ error: 'Invalid URL' })
  }

  if (!ALLOWED_HOSTS.includes(parsed.hostname)) {
    return response.status(403).json({ error: 'Host not allowed' })
  }

  try {
    const upstream = await fetch(imageUrl)
    if (!upstream.ok) {
      return response.status(upstream.status).json({ error: `Upstream returned ${upstream.status}` })
    }

    const contentType = upstream.headers.get('content-type') || 'application/octet-stream'
    const buffer = Buffer.from(await upstream.arrayBuffer())

    response.setHeader('Content-Type', contentType)
    response.setHeader('Cache-Control', 'public, max-age=604800, immutable')
    return response.status(200).send(buffer)
  }
  catch (err) {
    return response.status(502).json({ error: err instanceof Error ? err.message : 'Upstream fetch failed' })
  }
}
