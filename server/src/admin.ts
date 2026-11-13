import { asc, eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { fail, isUuid, requireAdmin, requireUser, unsigned, type AppEnv } from './accounts'
import { db } from './db'
import { roleEnum, users } from './db/schema'
import { adminFiles } from './files'
import { adminPackRoutes } from './packs'
import { rcon } from './rcon'

export const admin = new Hono<AppEnv>()

admin.use(requireUser, requireAdmin)
admin.route('/packs', adminPackRoutes)
admin.route('/files', adminFiles)

admin.get('/users', async (c) => {
  const rows = await db.select().from(users).orderBy(asc(users.createdAt))
  return c.json(
    rows.map((user) => ({
      id: unsigned(user.id),
      name: user.name,
      role: user.role,
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt,
      hasSkin: user.skinHash !== null,
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

export async function whitelist(action: 'add' | 'remove', name: string): Promise<string | undefined> {
  try {
    console.log(`RCON whitelist ${action} ${name}: ${await rcon(`whitelist ${action} ${name}`)}`)
  } catch (error) {
    console.error(`RCON whitelist ${action} ${name} failed`, error)
    return `Failed to run whitelist ${action} ${name}: ${error instanceof Error ? error.message : String(error)}`
  }
}
