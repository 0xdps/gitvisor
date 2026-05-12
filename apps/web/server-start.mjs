import { serve } from 'srvx/node'
import { serveStatic } from 'srvx/static'
import handler from './dist/server/server.js'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const staticFiles = serveStatic({ dir: resolve(__dirname, 'dist/client') })

// Proxy /api/* → internal API service.
// This lets the web app be exposed via an HTTPS tunnel without mixed-content
// or CORS issues — the browser calls same-origin /api/... and the server
// forwards to the API over the internal Docker network (or localhost in dev).
const API_INTERNAL_URL = process.env.API_INTERNAL_URL ?? 'http://localhost:3002'

serve({
  fetch: async (req) => {
    const url = new URL(req.url)

    if (url.pathname.startsWith('/api')) {
      const apiPath = url.pathname.slice('/api'.length) || '/'
      const target = `${API_INTERNAL_URL}${apiPath}${url.search}`
      const hasBody = req.method !== 'GET' && req.method !== 'HEAD'
      const apiRes = await fetch(target, {
        method: req.method,
        headers: req.headers,
        ...(hasBody ? { body: req.body, duplex: 'half' } : {}),
      })

      // Node.js fetch (undici) hides Set-Cookie from normal header enumeration.
      // We must use getSetCookie() and rebuild the response so cookies reach the browser.
      const setCookies = apiRes.headers.getSetCookie?.() ?? []
      if (setCookies.length === 0) return apiRes

      const resHeaders = new Headers(apiRes.headers)
      for (const cookie of setCookies) {
        resHeaders.append('set-cookie', cookie)
      }
      return new Response(apiRes.body, { status: apiRes.status, statusText: apiRes.statusText, headers: resHeaders })
    }

    const res = await staticFiles(req, () => null)
    if (res !== null) return res
    return handler.fetch(req)
  },
  port: parseInt(process.env.PORT ?? '3000'),
  hostname: process.env.HOST ?? '0.0.0.0',
})
