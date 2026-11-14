import { asc, eq } from 'drizzle-orm'
import { Hono } from 'hono'
import {
  clearSkin,
  fail,
  findCatalogSkin,
  isUuid,
  parseSkinModel,
  requireAdmin,
  requireUser,
  setSkin,
  skinOf,
  storeSkin,
  unsigned,
  type AppEnv,
} from './accounts'
import { db } from './db'
import { roleEnum, users, type User } from './db/schema'
import { adminFiles } from './files'
import { adminPackRoutes } from './packs'
import { rcon } from './rcon'
import { adminSkinRoutes, importSkin } from './skins'

export const admin = new Hono<AppEnv>()

admin.use(requireUser, requireAdmin)
admin.route('/packs', adminPackRoutes)
admin.route('/files', adminFiles)
admin.route('/skins', adminSkinRoutes)

admin.get('/users', async (c) => {
  const rows = await db.select().from(users).orderBy(asc(users.createdAt))
  return c.json(
    rows.map((user) => ({
      id: unsigned(user.id),
      name: user.name,
      role: user.role,
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt,
      skin: skinOf(user),
      whitelisted: user.role !== 'pending',
    })),
  )
})

admin.patch('/users/:id', async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json<{ role?: unknown }>().catch(() => ({}) as Record<string, unknown>)
  const role = roleEnum.enumValues.find((value) => value === body.role)
  if (!role) return fail(c, 400, 'IllegalArgumentException', 'Invalid role.')
  const [before] = isUuid(id) ? await db.select().from(users).where(eq(users.id, id)) : []
  if (!before) return fail(c, 404, 'NotFoundException', 'User not found.')
  await db.update(users).set({ role }).where(eq(users.id, before.id))
  const wasPending = before.role === 'pending'
  const warning = wasPending !== (role === 'pending') ? await whitelist(wasPending ? 'add' : 'remove', before.name) : undefined
  return c.json({ id: unsigned(before.id), name: before.name, role, warning })
})

admin.delete('/users/:id', async (c) => {
  const id = c.req.param('id')
  const [removed] = isUuid(id) ? await db.delete(users).where(eq(users.id, id)).returning() : []
  if (!removed) return fail(c, 404, 'NotFoundException', 'User not found.')
  return c.json({ warning: await whitelist('remove', removed.name) })
})

admin.put('/users/:id/skin', async (c) => {
  const user = await userById(c.req.param('id'))
  if (!user) return fail(c, 404, 'NotFoundException', 'User not found.')
  const { file, model } = await c.req.parseBody()
  const skinModel = parseSkinModel(model)
  const hash = file instanceof File && skinModel ? await storeSkin(file) : null
  if (!hash || !skinModel) {
    return fail(c, 400, 'IllegalArgumentException', 'Invalid skin: expected PNG 64x64 or 64x32 and model classic or slim.')
  }
  return c.json(await applySkin(user, hash, skinModel))
})

admin.put('/users/:id/skin/catalog/:skinId', async (c) => {
  const user = await userById(c.req.param('id'))
  const skin = await findCatalogSkin(c.req.param('skinId'))
  if (!user || !skin) return fail(c, 404, 'NotFoundException', 'User or skin not found.')
  return c.json(await applySkin(user, skin.hash, skin.model))
})

admin.put('/users/:id/skin/import', async (c) => {
  const user = await userById(c.req.param('id'))
  if (!user) return fail(c, 404, 'NotFoundException', 'User not found.')
  const skin = await importSkin(await c.req.json<Record<string, unknown>>().catch(() => ({}) as Record<string, unknown>))
  if (!skin) return fail(c, 404, 'NotFoundException', 'Skin not found.')
  return c.json(await applySkin(user, skin.hash, skin.model))
})

admin.delete('/users/:id/skin', async (c) => {
  const user = await userById(c.req.param('id'))
  if (!user) return fail(c, 404, 'NotFoundException', 'User not found.')
  await clearSkin(user)
  return c.json(null)
})

export async function whitelist(action: 'add' | 'remove', name: string): Promise<string | undefined> {
  try {
    console.log(`RCON whitelist ${action} ${name}: ${await rcon(`whitelist ${action} ${name}`)}`)
  } catch (error) {
    console.error(`RCON whitelist ${action} ${name} failed`, error)
    return `Failed to run whitelist ${action} ${name}: ${error instanceof Error ? error.message : String(error)}`
  }
}

async function userById(id: string): Promise<User | undefined> {
  const [user] = isUuid(id) ? await db.select().from(users).where(eq(users.id, id)) : []
  return user
}

async function applySkin(user: User, hash: string, model: User['skinModel']) {
  await setSkin(user, hash, model)
  return skinOf({ skinHash: hash, skinModel: model })
}
