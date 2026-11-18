import type { VercelRequest, VercelResponse } from '../_vercel.js'
import process from 'node:process'
import { z } from 'zod'
import { attachCookiesToResponse, createSpotifyRedirectUri, fetchSpotifyAuth } from './_common.js'

export default async function handler(
  request: VercelRequest,
  response: VercelResponse,
) {
  const protocol = request.headers['x-forwarded-proto'] || 'http'
  const baseURL = `${protocol}://${request.headers.host}`

  const params = request.query
  const state = params.state

  if (state === undefined) {
    return response.redirect(new URL('/', baseURL).toString())
  }
  else if (state !== process.env.STATE) {
    return response
      .status(401)
      .send('Authorization failed, there is possibility you\'ve been hacked!')
  }

  const code = params.code

  if (code) {
    try {
      const spotifyResponseType = z.object({
        access_token: z.string(),
        refresh_token: z.string(),
        expires_in: z.number(),
      })

      const result = await fetchSpotifyAuth({
        grant_type: 'authorization_code',
        code: code.toString(),
        redirect_uri: createSpotifyRedirectUri(protocol, request.headers.host!),
      })
      const { access_token, refresh_token, expires_in } = spotifyResponseType.parse(result)

      return attachCookiesToResponse(
        response,
        access_token,
        refresh_token,
        expires_in,
      ).redirect(new URL('/', baseURL).toString())
    }
    catch {
      return response.status(401).send('something went wrong')
    }
  }
  else {
    return response.status(401).send(params.error?.toString() ?? 'Authorization failed')
  }
}
