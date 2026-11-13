import { Hono } from 'hono'
import { mkdir, rename, rm, stat } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fail, type AppEnv } from './accounts'
import { config } from './config'

const objectsDir = join(config.dataDir, 'files', 'objects')
const cdnHosts = ['cdn.modrinth.com', 'edge.forgecdn.net', 'mediafilecdn.forgecdn.net']

export const adminFiles = new Hono<AppEnv>()

adminFiles.post('/missing', async (c) => {
  const body = await c.req.json<{ sha1s?: unknown }>().catch(() => ({}) as Record<string, unknown>)
  if (!Array.isArray(body.sha1s) || !body.sha1s.every(isSha1)) return fail(c, 400, 'IllegalArgumentException', 'Invalid sha1s.')
  const sha1s = body.sha1s
  const sizes = await Promise.all(sha1s.map((sha1) => objectSize(sha1)))
  return c.json(sha1s.filter((_, index) => sizes[index] === undefined))
})

adminFiles.put('/:sha1', async (c) => {
  const sha1 = c.req.param('sha1').toLowerCase()
  if (!isSha1(sha1) || !c.req.raw.body) return fail(c, 400, 'IllegalArgumentException', 'Invalid sha1 or empty body.')
  if (!(await saveObject(c.req.raw.body, sha1))) return fail(c, 400, 'IllegalArgumentException', 'SHA-1 mismatch.')
  return c.body(null, 204)
})

adminFiles.post('/fetch', async (c) => {
  const body = await c.req.json<{ url?: unknown; sha1?: unknown }>().catch(() => ({}) as Record<string, unknown>)
  const url = cdnUrl(body.url)
  if (!url || !isSha1(body.sha1)) return fail(c, 400, 'IllegalArgumentException', 'Invalid url or sha1.')
  if ((await objectSize(body.sha1)) === undefined) {
    const response = await fetch(url)
    if (!response.ok || !response.body) return fail(c, 502, 'BadGateway', `Download failed with status ${response.status}.`)
    if (!(await saveObject(response.body, body.sha1))) return fail(c, 400, 'IllegalArgumentException', 'SHA-1 mismatch.')
  }
  return c.body(null, 204)
})

export function isSha1(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{40}$/.test(value)
}

export function objectPath(sha1: string): string {
  return join(objectsDir, sha1.slice(0, 2), sha1)
}

export async function objectSize(sha1: string): Promise<number | undefined> {
  return (await stat(objectPath(sha1)).catch(() => undefined))?.size
}

async function saveObject(body: ReadableStream<Uint8Array>, sha1: string): Promise<boolean> {
  await mkdir(objectsDir, { recursive: true })
  const temp = join(objectsDir, `.${crypto.randomUUID()}.part`)
  try {
    await Bun.write(temp, new Response(body))
    const hasher = new Bun.CryptoHasher('sha1')
    for await (const chunk of Bun.file(temp).stream()) hasher.update(chunk)
    if (hasher.digest('hex') !== sha1) return false
    await mkdir(dirname(objectPath(sha1)), { recursive: true })
    await rename(temp, objectPath(sha1))
    return true
  } finally {
    await rm(temp, { force: true })
  }
}

function cdnUrl(value: unknown): URL | undefined {
  try {
    const url = new URL(String(value))
    return url.protocol === 'https:' && cdnHosts.includes(url.hostname) ? url : undefined
  } catch {
    return undefined
  }
}
