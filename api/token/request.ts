import type { VercelRequest, VercelResponse } from '../_vercel.js'
import process from 'node:process'
import queryString from 'query-string'
import { createSpotifyRedirectUri } from './_common.js'

export default async function handler(
  request: VercelRequest,
  response: VercelResponse,
) {
  const protocol = request.headers['x-forwarded-proto'] || 'http'

  return response.redirect(
    queryString.stringifyUrl({
      url: 'https://accounts.spotify.com/authorize?',
      query: {
        response_type: 'code',
        client_id: process.env.CLIENT_ID,
        scope: process.env.SCOPE,
        redirect_uri: createSpotifyRedirectUri(protocol, request.headers.host!),
        state: process.env.STATE,
      },
    }),
  )
}
