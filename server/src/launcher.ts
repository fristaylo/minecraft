import { createHash } from 'node:crypto'
import { asc } from 'drizzle-orm'
import { Hono } from 'hono'
import {
  authResponse,
  catalogItem,
  clearSkin,
  fail,
  findCatalogSkin,
  parseSkinModel,
  requireUser,
  saveSkin,
  setSkin,
  skinOf,
  unsigned,
  type AppEnv,
} from './accounts'
import { whitelist } from './admin'
import { config } from './config'
import { db } from './db'
import { skins, users } from './db/schema'

export const launcher = new Hono<AppEnv>()

launcher.post('/auth/register', async (c) => {
  const body = await c.req.json<{ username?: unknown; password?: unknown }>().catch(() => ({}) as Record<string, unknown>)
  const { username, password } = body
  if (typeof username !== 'string' || !/^[A-Za-z0-9_]{3,16}$/.test(username)) {
    return fail(c, 400, 'IllegalArgumentException', 'Invalid username.')
  }
  if (typeof password !== 'string' || password.length < 6) {
    return fail(c, 400, 'IllegalArgumentException', 'Password must be at least 6 characters.')
  }
  const [user] = await db
    .insert(users)
    .values({
      id: offlineUuid(username),
      name: username,
      passwordHash: await Bun.password.hash(password, 'argon2id'),
      role: config.adminUsernames.includes(username.toLowerCase()) ? 'admin' : 'pending',
      lastLoginAt: new Date(),
    })
    .onConflictDoNothing()
    .returning()
  if (!user) return fail(c, 409, 'ForbiddenOperationException', 'Username is already taken.')
  console.log(`Registered ${user.name} as ${user.role}`)
  if (user.role !== 'pending') await whitelist('add', user.name)
  return c.json({ ...(await authResponse(user)), role: user.role })
})

launcher.get('/me', requireUser, (c) => {
  const user = c.var.user
  return c.json({ id: unsigned(user.id), name: user.name, role: user.role, skin: skinOf(user) })
})

launcher.put('/me/skin', requireUser, async (c) => {
  const { file, model } = await c.req.parseBody()
  const skinModel = parseSkinModel(model)
  if (!(file instanceof File) || !skinModel || !(await saveSkin(c.var.user, file, skinModel))) {
    return fail(c, 400, 'IllegalArgumentException', 'Invalid skin: expected PNG 64x64 or 64x32 and model classic or slim.')
  }
  return c.body(null, 204)
})

launcher.delete('/me/skin', requireUser, async (c) => {
  await clearSkin(c.var.user)
  return c.body(null, 204)
})

launcher.get('/skins', requireUser, async (c) => c.json((await db.select().from(skins).orderBy(asc(skins.createdAt))).map(catalogItem)))

launcher.put('/me/skin/catalog/:id', requireUser, async (c) => {
  const skin = await findCatalogSkin(c.req.param('id'))
  if (!skin) return fail(c, 404, 'NotFoundException', 'Skin not found.')
  await setSkin(c.var.user, skin.hash, skin.model)
  return c.body(null, 204)
})

function offlineUuid(name: string): string {
  const bytes = createHash('md5').update(`OfflinePlayer:${name}`).digest()
  bytes[6] = (bytes[6] & 0x0f) | 0x30
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = bytes.toString('hex')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}
