import { eq, sql } from 'drizzle-orm'
import type { Context } from 'hono'
import { createMiddleware } from 'hono/factory'
import type { ContentfulStatusCode } from 'hono/utils/http-status'
import { config } from './config'
import { db } from './db'
import { tokens, users, type User } from './db/schema'

export type AppEnv = { Variables: { user: User } }

export const requireUser = createMiddleware<AppEnv>(async (c, next) => {
  const row = await findToken(c.req.header('Authorization')?.match(/^Bearer (.+)$/)?.[1])
  if (!row) return fail(c, 401, 'ForbiddenOperationException', 'Invalid token.')
  c.set('user', row.user)
  await next()
})

export const requireAdmin = createMiddleware<AppEnv>(async (c, next) => {
  if (c.var.user.role !== 'admin') return fail(c, 403, 'ForbiddenOperationException', 'Administrator access required.')
  await next()
})

export function fail(c: Context, status: ContentfulStatusCode, error: string, message: string) {
  return c.json({ error, errorMessage: message }, status)
}

export function unsigned(id: string): string {
  return id.replaceAll('-', '')
}

export function isUuid(value: string): boolean {
  return /^[0-9a-f]{32}$/i.test(value)
}

export async function findUser(name: string): Promise<User | undefined> {
  const [user] = await db.select().from(users).where(eq(sql`lower(${users.name})`, name.toLowerCase()))
  return user
}

export async function findToken(accessToken: string | undefined) {
  if (!accessToken) return undefined
  const [row] = await db
    .select({ token: tokens, user: users })
    .from(tokens)
    .innerJoin(users, eq(tokens.userId, users.id))
    .where(eq(tokens.accessToken, accessToken))
  return row
}

export async function login(username: unknown, password: unknown): Promise<User | null> {
  if (typeof username !== 'string' || typeof password !== 'string') return null
  const user = await findUser(username)
  if (!user || !(await Bun.password.verify(password, user.passwordHash))) return null
  await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id))
  return user
}

export async function authResponse(user: User, clientToken?: string) {
  const accessToken = randomToken()
  const profile = { id: unsigned(user.id), name: user.name }
  const issued = clientToken ?? randomToken()
  await db.insert(tokens).values({ accessToken, clientToken: issued, userId: user.id })
  return {
    accessToken,
    clientToken: issued,
    availableProfiles: [profile],
    selectedProfile: profile,
    user: { id: profile.id, properties: [] },
  }
}

export function skinOf(user: Pick<User, 'skinHash' | 'skinModel'>) {
  return user.skinHash ? { url: `${config.publicUrl}/textures/${user.skinHash}`, model: user.skinModel } : null
}

export async function saveSkin(userId: string, file: File, model: User['skinModel']): Promise<boolean> {
  const bytes = new Uint8Array(await file.arrayBuffer())
  if (!isSkinPng(bytes)) return false
  const hash = new Bun.CryptoHasher('sha256').update(bytes).digest('hex')
  await Bun.write(`${config.dataDir}/textures/${hash}.png`, bytes)
  await db.update(users).set({ skinHash: hash, skinModel: model }).where(eq(users.id, userId))
  return true
}

export async function clearSkin(userId: string): Promise<void> {
  await db.update(users).set({ skinHash: null }).where(eq(users.id, userId))
}

function randomToken(): string {
  return crypto.randomUUID().replaceAll('-', '')
}

function isSkinPng(bytes: Uint8Array): boolean {
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
  if (bytes.length < 24 || bytes.length > 1024 * 1024 || !signature.every((byte, i) => bytes[i] === byte)) return false
  const view = new DataView(bytes.buffer, bytes.byteOffset)
  return view.getUint32(16) === 64 && (view.getUint32(20) === 64 || view.getUint32(20) === 32)
}
