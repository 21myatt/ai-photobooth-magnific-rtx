import { createServer as createHttpServer } from 'node:http'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer as createViteServer } from 'vite'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const port = Number(process.env.PORT || 5173)

loadEnv(resolve(root, '.env'))

const handlers = {
  '/api/health': (await import('../api/health.js')).default,
  '/api/submit': (await import('../api/submit.js')).default,
  '/api/status': (await import('../api/status.js')).default,
}

const vite = await createViteServer({
  root,
  server: {
    hmr: false,
    middlewareMode: true,
  },
  appType: 'spa',
})

const server = createHttpServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`)
    const handler = handlers[url.pathname]

    if (handler) {
      req.query = Object.fromEntries(url.searchParams)
      await handler(req, res)
      return
    }

    vite.middlewares(req, res)
  } catch (error) {
    vite.ssrFixStacktrace(error)
    res.statusCode = 500
    res.setHeader('content-type', 'application/json; charset=utf-8')
    res.end(JSON.stringify({ error: error.message || String(error) }))
  }
})

server.listen(port, '127.0.0.1', () => {
  console.log(`Local app running at http://localhost:${port}`)
})

function loadEnv(path) {
  if (!existsSync(path)) return

  const lines = readFileSync(path, 'utf8').split(/\r?\n/)
  for (const line of lines) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)?\s*$/)
    if (!match) continue

    const [, key, rawValue = ''] = match
    if (process.env[key]) continue

    process.env[key] = rawValue
      .replace(/^(['"])(.*)\1$/, '$2')
      .replace(/\\n/g, '\n')
  }
}
