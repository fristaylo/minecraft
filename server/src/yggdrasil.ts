import { createPrivateKey, createPublicKey, generateKeyPair, generateKeyPairSync, sign } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { promisify } from 'node:util'
import { eq, inArray, sql } from 'drizzle-orm'
import { Hono, type Context } from 'hono'
import { getConnInfo } from 'hono/bun'
import {
  authResponse,
  clearSkin,
  fail,
  findToken,
  findUser,
  isUuid,
  login,
  requireUser,
  saveSkin,
  skinOf,
  unsigned,
  type AppEnv,
} from './accounts'
import { config } from './config'
import { db } from './db'
import { tokens, users, type User } from './db/schema'

export const yggdrasil = new Hono<AppEnv>()

const keys = loadKeys()
const sessions = new Map<string, { userId: string; ip: string | undefined; expires: number }>()
const generateKeyPairAsync = promisify(generateKeyPair)

yggdrasil.get('/', (c) =>
  c.json({
    meta: {
      serverName: 'Minecraft Launcher',
      implementationName: 'minecraft-server',
      implementationVersion: '1.0.0',
      links: { homepage: config.publicUrl, register: config.publicUrl },
      'feature.non_email_login': true,
    },
    skinDomains: [new URL(config.publicUrl).hostname],
    signaturePublickey: keys.publicPem,
  }),
)

yggdrasil.post('/authserver/authenticate', async (c) => {
  const body = await c.req
    .json<{ username?: unknown; password?: unknown; clientToken?: unknown }>()
    .catch(() => ({}) as Record<string, unknown>)
  const user = await login(body.username, body.password)
  if (!user) return fail(c, 403, 'ForbiddenOperationException', 'Invalid credentials. Invalid username or password.')
  return c.json(await authResponse(user, typeof body.clientToken === 'string' ? body.clientToken : undefined))
})

yggdrasil.post('/authserver/refresh', async (c) => {
  const body = await c.req.json<{ accessToken?: string; clientToken?: string }>().catch(() => ({}) as Record<string, string>)
  const row = await findToken(body.accessToken)
  if (!row || (body.clientToken && body.clientToken !== row.token.clientToken)) {
    return fail(c, 403, 'ForbiddenOperationException', 'Invalid token.')
  }
  await db.delete(tokens).where(eq(tokens.accessToken, row.token.accessToken))
  return c.json(await authResponse(row.user, row.token.clientToken))
})

yggdrasil.post('/authserver/validate', async (c) => {
  const body = await c.req.json<{ accessToken?: string; clientToken?: string }>().catch(() => ({}) as Record<string, string>)
  const row = await findToken(body.accessToken)
  if (!row || (body.clientToken && body.clientToken !== row.token.clientToken)) {
    return fail(c, 403, 'ForbiddenOperationException', 'Invalid token.')
  }
  return c.body(null, 204)
})

yggdrasil.post('/authserver/invalidate', async (c) => {
  const body = await c.req.json<{ accessToken?: string }>().catch(() => ({}) as Record<string, string>)
  if (body.accessToken) await db.delete(tokens).where(eq(tokens.accessToken, body.accessToken))
  return c.body(null, 204)
})

yggdrasil.post('/authserver/signout', async (c) => {
  const body = await c.req.json<{ username?: unknown; password?: unknown }>().catch(() => ({}) as Record<string, unknown>)
  const user = await login(body.username, body.password)
  if (!user) return fail(c, 403, 'ForbiddenOperationException', 'Invalid credentials. Invalid username or password.')
  await db.delete(tokens).where(eq(tokens.userId, user.id))
  return c.body(null, 204)
})

yggdrasil.post('/sessionserver/session/minecraft/join', async (c) => {
  const body = await c.req
    .json<{ accessToken?: string; selectedProfile?: string; serverId?: string }>()
    .catch(() => ({}) as Record<string, string>)
  const row = await findToken(body.accessToken)
  if (!row || !body.serverId || body.selectedProfile !== unsigned(row.user.id)) {
    return fail(c, 403, 'ForbiddenOperationException', 'Invalid token.')
  }
  if (row.user.role === 'pending') {
    return fail(c, 403, 'ForbiddenOperationException', 'Your account is awaiting administrator approval.')
  }
  const now = Date.now()
  for (const [serverId, session] of sessions) {
    if (session.expires < now) sessions.delete(serverId)
  }
  sessions.set(body.serverId, { userId: row.user.id, ip: clientIp(c), expires: now + 30_000 })
  return c.body(null, 204)
})

yggdrasil.get('/sessionserver/session/minecraft/hasJoined', async (c) => {
  const { username, serverId, ip } = c.req.query()
  const session = sessions.get(serverId ?? '')
  const user = username ? await findUser(username) : undefined
  if (!session || session.expires < Date.now() || !user || user.id !== session.userId || (ip && ip !== session.ip)) {
    return c.body(null, 204)
  }
  return c.json(profileOf(user, true))
})

yggdrasil.get('/sessionserver/session/minecraft/profile/:uuid', async (c) => {
  const id = c.req.param('uuid')
  const [user] = isUuid(id) ? await db.select().from(users).where(eq(users.id, id)) : []
  if (!user) return c.body(null, 204)
  return c.json(profileOf(user, c.req.query('unsigned') === 'false'))
})

yggdrasil.post('/api/profiles/minecraft', async (c) => {
  const names = await c.req.json<unknown>().catch(() => null)
  if (!Array.isArray(names) || !names.every((name) => typeof name === 'string')) {
    return fail(c, 400, 'IllegalArgumentException', 'Expected an array of names.')
  }
  const found = names.length
    ? await db
        .select()
        .from(users)
        .where(
          inArray(
            sql`lower(${users.name})`,
            names.slice(0, 100).map((name) => name.toLowerCase()),
          ),
        )
    : []
  return c.json(found.map((user) => ({ id: unsigned(user.id), name: user.name })))
})

yggdrasil.put('/api/user/profile/:uuid/skin', requireUser, async (c) => {
  if (c.req.param('uuid') !== unsigned(c.var.user.id)) return fail(c, 403, 'ForbiddenOperationException', 'Forbidden.')
  const { file, model } = await c.req.parseBody()
  if (!(file instanceof File) || !(await saveSkin(c.var.user.id, file, model === 'slim' ? 'slim' : 'classic'))) {
    return fail(c, 400, 'IllegalArgumentException', 'Invalid skin.')
  }
  return c.body(null, 204)
})

yggdrasil.delete('/api/user/profile/:uuid/skin', requireUser, async (c) => {
  if (c.req.param('uuid') !== unsigned(c.var.user.id)) return fail(c, 403, 'ForbiddenOperationException', 'Forbidden.')
  await clearSkin(c.var.user.id)
  return c.body(null, 204)
})

yggdrasil.get('/minecraftservices/player/attributes', (c) =>
  c.json({
    privileges: {
      onlineChat: { enabled: true },
      multiplayerServer: { enabled: true },
      multiplayerRealms: { enabled: false },
      telemetry: { enabled: false },
    },
    profanityFilterPreferences: { profanityFilterOn: false },
    banStatus: { bannedScopes: {} },
  }),
)

yggdrasil.get('/minecraftservices/privacy/blocklist', (c) => c.json({ blockedProfiles: [] }))

yggdrasil.get('/minecraftservices/publickeys', (c) =>
  c.json({
    profilePropertyKeys: [{ publicKey: keys.publicBase64 }],
    playerCertificateKeys: [{ publicKey: keys.publicBase64 }],
  }),
)

yggdrasil.post('/minecraftservices/player/certificates', requireUser, async (c) => {
  const { publicKey, privateKey } = await generateKeyPairAsync('rsa', { modulusLength: 2048 })
  const publicDer = publicKey.export({ type: 'spki', format: 'der' })
  const expiresAt = Date.now() + 48 * 3600_000
  const expiry = Buffer.alloc(8)
  expiry.writeBigInt64BE(BigInt(expiresAt))
  const signature = sign(
    'sha256',
    Buffer.concat([Buffer.from(unsigned(c.var.user.id), 'hex'), expiry, publicDer]),
    keys.privateKey,
  ).toString('base64')
  return c.json({
    keyPair: {
      privateKey: pem('RSA PRIVATE KEY', privateKey.export({ type: 'pkcs8', format: 'der' })),
      publicKey: pem('RSA PUBLIC KEY', publicDer),
    },
    publicKeySignature: signature,
    publicKeySignatureV2: signature,
    expiresAt: new Date(expiresAt).toISOString(),
    refreshedAfter: new Date(expiresAt - 8 * 3600_000).toISOString(),
  })
})

function profileOf(user: User, signed: boolean) {
  const skin = skinOf(user)
  const value = Buffer.from(
    JSON.stringify({
      timestamp: Date.now(),
      profileId: unsigned(user.id),
      profileName: user.name,
      textures: skin ? { SKIN: { url: skin.url, ...(skin.model === 'slim' && { metadata: { model: 'slim' } }) } } : {},
    }),
  ).toString('base64')
  return {
    id: unsigned(user.id),
    name: user.name,
    properties: [
      {
        name: 'textures',
        value,
        ...(signed && { signature: sign('sha1', Buffer.from(value), keys.privateKey).toString('base64') }),
      },
    ],
  }
}

function clientIp(c: Context): string | undefined {
  return c.req.header('X-Forwarded-For')?.split(',')[0].trim() ?? getConnInfo(c).remote.address
}

function pem(label: string, der: Buffer): string {
  return `-----BEGIN ${label}-----\n${der.toString('base64').replace(/.{1,76}/g, '$&\n')}-----END ${label}-----\n`
}

function loadKeys() {
  const directory = `${config.dataDir}/keys`
  const path = `${directory}/private.pem`
  if (!existsSync(path)) {
    mkdirSync(directory, { recursive: true })
    const pair = generateKeyPairSync('rsa', { modulusLength: 4096 })
    writeFileSync(path, pair.privateKey.export({ type: 'pkcs8', format: 'pem' }), { mode: 0o600 })
    console.log('Generated Yggdrasil signing key')
  }
  const privateKey = createPrivateKey(readFileSync(path))
  const publicKey = createPublicKey(privateKey)
  return {
    privateKey,
    publicPem: publicKey.export({ type: 'spki', format: 'pem' }).toString(),
    publicBase64: publicKey.export({ type: 'spki', format: 'der' }).toString('base64'),
  }
}
