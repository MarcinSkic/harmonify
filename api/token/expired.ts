import type { VercelRequest, VercelResponse } from '../_vercel.js'
import { attachCookiesToResponse } from './_common.js'

export default async function handler(request: VercelRequest, response: VercelResponse) {
  const protocol = request.headers['x-forwarded-proto'] || 'http'
  const baseURL = `${protocol}://${request.headers.host}`

  return attachCookiesToResponse(
    response,
    'deleted',
    'deleted',
    new Date().getUTCDate(),
  ).redirect(new URL('/api/token/request', baseURL).toString())
}
