const MAGNIFIC_API_BASE = process.env.MAGNIFIC_API_BASE || 'https://api.magnific.com/v1'

export function json(res, status, body) {
  res.statusCode = status
  res.setHeader('content-type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(body))
}

export function requireEnv(name) {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing ${name}`)
  }
  return value
}

export async function readJson(req) {
  const chunks = []
  for await (const chunk of req) chunks.push(Buffer.from(chunk))
  const raw = Buffer.concat(chunks).toString('utf8')
  return raw ? JSON.parse(raw) : {}
}

export async function magnificFetch(path, options = {}) {
  const apiKey = requireEnv('MAGNIFIC_API_KEY')
  const headers = new Headers(options.headers || {})
  headers.set('x-magnific-api-key', apiKey)
  if (options.body && !headers.has('content-type')) {
    headers.set('content-type', 'application/json')
  }

  const response = await fetch(`${MAGNIFIC_API_BASE}${path}`, {
    ...options,
    headers,
  })

  const text = await response.text()
  let data = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = text
  }

  if (!response.ok) {
    const message = data && typeof data === 'object' ? JSON.stringify(data) : String(data)
    throw new Error(`${response.status} ${response.statusText}: ${message}`)
  }

  return data
}

export { MAGNIFIC_API_BASE }
