import { serve } from 'srvx/node'
import { serveStatic } from 'srvx/static'
import handler from './dist/server/server.js'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const staticFiles = serveStatic({ dir: resolve(__dirname, 'dist/client') })

serve({
  fetch: async (req) => {
    const res = await staticFiles(req, () => null)
    if (res !== null) return res
    return handler.fetch(req)
  },
  port: parseInt(process.env.PORT ?? '3000'),
  hostname: process.env.HOST ?? '0.0.0.0',
})
