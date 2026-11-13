import { Hono } from 'hono'
import { fail, requireAdmin, requireUser, type AppEnv } from './accounts'
import { config } from './config'

export const curseforge = new Hono<AppEnv>()

curseforge.use(requireUser, requireAdmin)

curseforge.all('/*', async (c) => {
  if (!config.curseforgeApiKey) return fail(c, 503, 'ServiceUnavailable', 'CURSEFORGE_API_KEY is not configured.')
  const { search } = new URL(c.req.url)
  const hasBody = c.req.method !== 'GET' && c.req.method !== 'HEAD'
  const response = await fetch(`https://api.curseforge.com/v1${c.req.path.slice('/api/cf'.length)}${search}`, {
    method: c.req.method,
    headers: {
      'x-api-key': config.curseforgeApiKey,
      Accept: 'application/json',
      ...(hasBody && { 'Content-Type': c.req.header('Content-Type') ?? 'application/json' }),
    },
    body: hasBody ? await c.req.arrayBuffer() : undefined,
  })
  return new Response(response.body, {
    status: response.status,
    headers: { 'Content-Type': response.headers.get('Content-Type') ?? 'application/json' },
  })
})
