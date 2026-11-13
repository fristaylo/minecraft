import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { admin } from './admin'
import { curseforge } from './curseforge'
import { migrate } from './db'
import { launcher } from './launcher'
import { packRoutes } from './packs'
import { serverStatus } from './status'
import { yggdrasil } from './yggdrasil'

await migrate()

const api = new Hono()

api.use(async (c, next) => {
  await next()
  c.header('X-Authlib-Injector-API-Location', '/api/yggdrasil/')
})
api.route('/yggdrasil', yggdrasil)
api.route('/admin', admin)
api.route('/cf', curseforge)
api.route('/packs', packRoutes)
api.route('/server', serverStatus)
api.route('/', launcher)

const app = new Hono({ strict: false })

app.onError((error, c) => {
  if (error instanceof HTTPException) return error.getResponse()
  console.error('Unhandled error', error)
  return c.json({ error: 'InternalServerError', errorMessage: 'Internal server error.' }, 500)
})
app.route('/api', api)

console.log('Server listening on :3000')

export default { port: 3000, maxRequestBodySize: 1024 * 1024 * 1024, fetch: app.fetch }
