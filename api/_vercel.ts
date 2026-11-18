import type { IncomingMessage, ServerResponse } from 'node:http'

// Request/response helpers the Vercel Node.js runtime attaches to every function.
// Hand-written so the API does not depend on @vercel/node just for these types.
// The leading underscore keeps Vercel from deploying this file as a function.

export type VercelRequest = IncomingMessage & {
  query: Partial<Record<string, string | string[]>>
  cookies: Partial<Record<string, string>>
  body: unknown
}

export type VercelResponse = ServerResponse & {
  status: (statusCode: number) => VercelResponse
  json: (body: unknown) => VercelResponse
  send: (body: unknown) => VercelResponse
  redirect: ((url: string) => VercelResponse) & ((statusCode: number, url: string) => VercelResponse)
}
