import { asc, desc, eq, and } from 'drizzle-orm'
import { Hono } from 'hono'
import { rm } from 'node:fs/promises'
import { join } from 'node:path'
import { fail, requireUser, type AppEnv } from './accounts'
import { config } from './config'
import { db } from './db'
import {
  fileKinds,
  filePolicies,
  fileSides,
  loaderEnum,
  packs,
  packVersions,
  themeEnum,
  type Manifest,
  type ManifestFile,
  type Pack,
} from './db/schema'
import { isSha1, objectPath, objectSize } from './files'
import { rcon } from './rcon'

export const packRoutes = new Hono<AppEnv>()
export const adminPackRoutes = new Hono<AppEnv>()

packRoutes.use(requireUser)

packRoutes.get('/', async (c) =>
  c.json(
    (await latestVersions()).map(({ manifest }) => ({
      id: manifest.id,
      name: manifest.name,
      theme: manifest.theme,
      minecraft: manifest.minecraft,
      loader: manifest.loader,
      version: manifest.version,
      size: manifest.files.reduce((total, file) => total + file.size, 0),
      server: manifest.server,
    })),
  ),
)

packRoutes.get('/:id/manifest', async (c) => {
  const latest = await latestVersion(c.req.param('id'))
  if (!latest) return fail(c, 404, 'NotFoundException', 'Pack has no published version.')
  return c.json(latest.manifest)
})

adminPackRoutes.get('/', async (c) => {
  const versions = new Map((await latestVersions()).map((row) => [row.packId, row.version]))
  const rows = await db.select().from(packs).orderBy(asc(packs.createdAt))
  return c.json(rows.map((pack) => ({ ...pack, version: versions.get(pack.id) ?? null })))
})

adminPackRoutes.post('/', async (c) => {
  const body = await c.req.json<Record<string, unknown>>().catch(() => ({}) as Record<string, unknown>)
  const values = parsePack(body)
  if (typeof body.id !== 'string' || !/^[a-z0-9][a-z0-9-]{0,31}$/.test(body.id) || !values) {
    return fail(c, 400, 'IllegalArgumentException', 'Invalid pack.')
  }
  const [existing] = await db.select({ id: packs.id }).from(packs).where(eq(packs.id, body.id))
  if (existing) return fail(c, 409, 'IllegalArgumentException', 'Pack already exists.')
  const [created] = await db.insert(packs).values({ ...values, id: body.id }).returning()
  return c.json(created, 201)
})

adminPackRoutes.put('/:id', async (c) => {
  const values = parsePack(await c.req.json<Record<string, unknown>>().catch(() => ({}) as Record<string, unknown>))
  if (!values) return fail(c, 400, 'IllegalArgumentException', 'Invalid pack.')
  const [updated] = await db.update(packs).set(values).where(eq(packs.id, c.req.param('id'))).returning()
  if (!updated) return fail(c, 404, 'NotFoundException', 'Pack not found.')
  return c.json(updated)
})

adminPackRoutes.delete('/:id', async (c) => {
  const [removed] = await db.delete(packs).where(eq(packs.id, c.req.param('id'))).returning({ id: packs.id })
  if (!removed) return fail(c, 404, 'NotFoundException', 'Pack not found.')
  return c.body(null, 204)
})

adminPackRoutes.get('/:id/draft', async (c) => {
  const [pack] = await db.select().from(packs).where(eq(packs.id, c.req.param('id')))
  if (!pack) return fail(c, 404, 'NotFoundException', 'Pack not found.')
  const latest = await latestVersion(pack.id)
  return c.json(buildManifest(pack, latest?.version ?? '', latest?.manifest.files ?? [], []))
})

adminPackRoutes.post('/:id/publish', async (c) => {
  const [pack] = await db.select().from(packs).where(eq(packs.id, c.req.param('id')))
  if (!pack) return fail(c, 404, 'NotFoundException', 'Pack not found.')
  const body = await c.req.json<Record<string, unknown>>().catch(() => ({}) as Record<string, unknown>)
  const parsed = Array.isArray(body.files) ? body.files.map(parseFile) : []
  const files = parsed.filter((file) => file !== undefined)
  if (
    typeof body.version !== 'string' ||
    typeof body.base !== 'string' ||
    !/^[\w.+-]{1,32}$/.test(body.version) ||
    files.length !== parsed.length ||
    new Set(files.map((file) => file.path)).size !== files.length ||
    (body.notes !== undefined && typeof body.notes !== 'string')
  ) {
    return fail(c, 400, 'IllegalArgumentException', 'Invalid version, base, files or notes.')
  }
  const latest = await latestVersion(pack.id)
  if ((latest?.version ?? '') !== body.base) {
    return c.json(
      {
        error: 'OutdatedDraft',
        errorMessage: `Pack was updated to ${latest?.version ?? ''} since this draft (based on ${body.base}) was loaded.`,
        latest: latest?.version ?? '',
      },
      409,
    )
  }
  const version = body.version
  const [duplicate] = await db
    .select({ version: packVersions.version })
    .from(packVersions)
    .where(and(eq(packVersions.packId, pack.id), eq(packVersions.version, version)))
  if (duplicate) return fail(c, 409, 'IllegalArgumentException', 'Version already exists.')
  const sizes = await Promise.all(files.map((file) => objectSize(file.sha1)))
  const missing = files.filter((_, index) => sizes[index] === undefined).map((file) => file.sha1)
  if (missing.length) return c.json({ error: 'MissingFiles', errorMessage: 'Some files are not uploaded.', missing }, 409)
  const manifestFiles = files.map((file, index): ManifestFile => ({
    ...file,
    size: sizes[index] ?? 0,
    url: `${config.publicUrl}/files/objects/${file.sha1.slice(0, 2)}/${file.sha1}`,
  }))
  const changelog = [
    ...diff(latest?.manifest.files ?? [], manifestFiles),
    ...(body.notes ?? '')
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((text) => ({ kind: 'upd' as const, text })),
  ]
  const manifest = buildManifest(pack, version, manifestFiles, changelog)
  await db.insert(packVersions).values({ packId: pack.id, version, manifest, publishedBy: c.var.user.id })
  return c.json({ version, warnings: pack.gameServer ? await updateGameServer(pack, manifest) : [] })
})

function latestVersions() {
  return db
    .selectDistinctOn([packVersions.packId], {
      packId: packVersions.packId,
      version: packVersions.version,
      manifest: packVersions.manifest,
    })
    .from(packVersions)
    .orderBy(packVersions.packId, desc(packVersions.publishedAt))
}

async function latestVersion(packId: string) {
  const [latest] = await db
    .select({ version: packVersions.version, manifest: packVersions.manifest })
    .from(packVersions)
    .where(eq(packVersions.packId, packId))
    .orderBy(desc(packVersions.publishedAt))
    .limit(1)
  return latest
}

function buildManifest(pack: Pack, version: string, files: ManifestFile[], changelog: Manifest['changelog']): Manifest {
  return {
    id: pack.id,
    name: pack.name,
    version,
    minecraft: pack.minecraft,
    loader: { type: pack.loaderType, version: pack.loaderVersion },
    java: pack.java,
    server: pack.server,
    theme: pack.theme,
    files,
    changelog,
  }
}

function parsePack(body: Record<string, unknown>): Omit<Pack, 'id' | 'createdAt'> | undefined {
  const theme = themeEnum.enumValues.find((value) => value === body.theme)
  const loaderType = loaderEnum.enumValues.find((value) => value === body.loaderType)
  const { name, minecraft, java, loaderVersion, server } = body
  if (
    typeof name !== 'string' ||
    !name.trim() ||
    typeof minecraft !== 'string' ||
    !minecraft.trim() ||
    typeof java !== 'number' ||
    !Number.isInteger(java) ||
    java < 1 ||
    !theme ||
    !loaderType ||
    (loaderType !== 'vanilla' && (typeof loaderVersion !== 'string' || !loaderVersion.trim()))
  ) {
    return undefined
  }
  return {
    name: name.trim(),
    theme,
    minecraft: minecraft.trim(),
    loaderType,
    loaderVersion: loaderType === 'vanilla' ? null : String(loaderVersion).trim(),
    java,
    server: typeof server === 'string' && server.trim() ? server.trim() : null,
    gameServer: body.gameServer === true,
  }
}

function parseFile(value: unknown): Omit<ManifestFile, 'size' | 'url'> | undefined {
  if (typeof value !== 'object' || value === null) return undefined
  const file = value as Record<string, unknown>
  const side = fileSides.find((item) => item === file.side)
  const kind = fileKinds.find((item) => item === file.kind)
  const { path, sha1 } = file
  if (typeof path !== 'string' || !validPath(path) || !isSha1(sha1) || !side || !kind) return undefined
  return {
    path,
    sha1,
    side,
    kind,
    optional: file.optional === true,
    defaultEnabled: file.defaultEnabled !== false,
    policy: filePolicies.find((item) => item === file.policy) ?? 'managed',
    meta: typeof file.meta === 'object' && file.meta !== null ? (file.meta as ManifestFile['meta']) : undefined,
  }
}

function validPath(path: string): boolean {
  return !/[\\:]/.test(path) && path.split('/').every((part) => part && part !== '.' && part !== '..')
}

function diff(previous: ManifestFile[], next: ManifestFile[]): Manifest['changelog'] {
  const before = new Map(previous.map((file) => [file.meta?.title ?? file.path, file]))
  const after = new Map(next.map((file) => [file.meta?.title ?? file.path, file]))
  return [
    ...[...after].filter(([key]) => !before.has(key)).map(([text]) => ({ kind: 'add' as const, text })),
    ...[...after]
      .filter(([key, file]) => before.has(key) && before.get(key)?.sha1 !== file.sha1)
      .map(([text]) => ({ kind: 'upd' as const, text })),
    ...[...before].filter(([key]) => !after.has(key)).map(([text]) => ({ kind: 'del' as const, text })),
  ]
}

async function updateGameServer(pack: Pack, manifest: Manifest): Promise<string[]> {
  const warnings: string[] = []
  if (pack.minecraft !== config.mcVersion || pack.loaderType !== config.mcLoader) {
    warnings.push(
      `Pack uses ${pack.minecraft} ${pack.loaderType} but compose env has MC_VERSION=${config.mcVersion} MC_LOADER=${config.mcLoader}; update compose env.`,
    )
  }
  const root = join(config.dataDir, 'mc')
  const managedPath = join(root, '.managed.json')
  const files = manifest.files.filter((file) => file.side !== 'client')
  try {
    const previous: string[] = await Bun.file(managedPath).json().catch(() => [])
    await Promise.all(previous.map((path) => rm(join(root, path), { force: true })))
    await Promise.all(files.map((file) => Bun.write(join(root, file.path), Bun.file(objectPath(file.sha1)))))
    await Bun.write(managedPath, JSON.stringify(files.map((file) => file.path)))
  } catch (error) {
    console.error('Game server file sync failed', error)
    return [...warnings, `Failed to sync game server files: ${error instanceof Error ? error.message : String(error)}`]
  }
  try {
    await rcon(`say Server is restarting to update pack ${pack.name} to ${manifest.version}`)
    await rcon('stop')
  } catch (error) {
    console.error('RCON restart failed', error)
    warnings.push(`Failed to restart game server: ${error instanceof Error ? error.message : String(error)}`)
  }
  return warnings
}
