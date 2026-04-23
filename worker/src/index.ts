const ALLOWED_ORIGINS = [
  'https://bkaanp.github.io',
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175',
  'http://localhost:4173',
  'http://localhost:3000',
]

const RATE_LIMIT = 30
const WINDOW_MS = 3_600_000

const requestCounts = new Map<string, { count: number; resetAt: number }>()

function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const entry = requestCounts.get(ip)
  if (!entry || now > entry.resetAt) {
    requestCounts.set(ip, { count: 1, resetAt: now + WINDOW_MS })
    return true
  }
  if (entry.count >= RATE_LIMIT) return false
  entry.count++
  return true
}

function corsHeaders(origin: string | null, requestedHeaders?: string | null) {
  const allowed = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': requestedHeaders ?? 'Content-Type, anthropic-version, x-api-key',
  }
}

interface Env {
  ANTHROPIC_API_KEY: string
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get('Origin')
    const headers = corsHeaders(origin)

    if (request.method === 'OPTIONS') {
      const requestedHeaders = request.headers.get('Access-Control-Request-Headers')
      return new Response(null, { status: 204, headers: corsHeaders(origin, requestedHeaders) })
    }

    const url = new URL(request.url)
    if (url.pathname !== '/v1/messages') {
      return new Response('Not Found', { status: 404, headers })
    }

    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405, headers })
    }

    const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown'
    if (!checkRateLimit(ip)) {
      return new Response(
        JSON.stringify({ error: { message: 'Rate limit exceeded. Please try again later.' } }),
        { status: 429, headers: { ...headers, 'Content-Type': 'application/json' } },
      )
    }

    const body = await request.text()
    const upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body,
    })

    return new Response(upstream.body, {
      status: upstream.status,
      headers: {
        ...headers,
        'content-type': upstream.headers.get('content-type') ?? 'application/json',
      },
    })
  },
}
