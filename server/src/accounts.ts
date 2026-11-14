import { eq, sql } from 'drizzle-orm'
import type { Context } from 'hono'
import { createMiddleware } from 'hono/factory'
import type { ContentfulStatusCode } from 'hono/utils/http-status'
import { config } from './config'
import { db } from './db'
import { skinModelEnum, skins, tokens, users, type CatalogSkin, type User } from './db/schema'
import { rcon } from './rcon'

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

export function catalogItem(skin: Pick<CatalogSkin, 'id' | 'name' | 'hash' | 'model'>) {
  return { id: skin.id, name: skin.name, url: `${config.publicUrl}/textures/${skin.hash}`, model: skin.model }
}

export async function findCatalogSkin(id: string): Promise<CatalogSkin | undefined> {
  if (!/^\d{1,9}$/.test(id)) return undefined
  const [skin] = await db.select().from(skins).where(eq(skins.id, Number(id)))
  return skin
}

export async function storeSkin(blob: Blob): Promise<string | null> {
  const bytes = new Uint8Array(await blob.arrayBuffer())
  if (!isSkinPng(bytes)) return null
  const hash = new Bun.CryptoHasher('sha256').update(bytes).digest('hex')
  await Bun.write(`${config.dataDir}/textures/${hash}.png`, bytes)
  return hash
}

export async function downloadTexture(textureHash: string): Promise<string | null> {
  if (!isTextureHash(textureHash)) return null
  const response = await fetch(`https://textures.minecraft.net/texture/${textureHash}`, { signal: AbortSignal.timeout(10000) })
  return response.ok ? storeSkin(await response.blob()) : null
}

export function parseSkinModel(value: unknown): User['skinModel'] | undefined {
  return skinModelEnum.enumValues.find((model) => model === value)
}

export function isTextureHash(value: string): boolean {
  return /^[0-9a-f]{32,64}$/.test(value)
}

export async function saveSkin(user: Pick<User, 'id' | 'name'>, file: File, model: User['skinModel']): Promise<boolean> {
  const hash = await storeSkin(file)
  if (!hash) return false
  await setSkin(user, hash, model)
  return true
}

export async function setSkin(user: Pick<User, 'id' | 'name'>, hash: string, model: User['skinModel']): Promise<void> {
  await db.update(users).set({ skinHash: hash, skinModel: model }).where(eq(users.id, user.id))
  refreshSkin(user.name)
}

export async function clearSkin(user: Pick<User, 'id' | 'name'>): Promise<void> {
  await db.update(users).set({ skinHash: null }).where(eq(users.id, user.id))
  refreshSkin(user.name)
}

function refreshSkin(name: string): void {
  if (!/^[A-Za-z0-9_]{1,16}$/.test(name)) return
  rcon(`refreshskin ${name}`).then(
    (reply) => console.log(`RCON refreshskin ${name}: ${reply}`),
    (error) => console.error(`RCON refreshskin ${name} failed`, error),
  )
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
