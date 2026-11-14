import { eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { catalogItem, downloadTexture, fail, isTextureHash, isUuid, parseSkinModel, storeSkin, type AppEnv } from './accounts'
import { config } from './config'
import { db } from './db'
import { skins, type CatalogSkin, type User } from './db/schema'

type SkinImport = Pick<CatalogSkin, 'name' | 'hash' | 'model' | 'source'>

type SkinSource = { name: string; texture: string; model: User['skinModel'] }

export const skinPreview = new Hono()
export const adminSkinRoutes = new Hono<AppEnv>()

const previews = new Map<string, ArrayBuffer>()

skinPreview.get('/:hash', async (c) => {
  const hash = c.req.param('hash')
  if (!isTextureHash(hash)) return c.body(null, 404)
  let image = previews.get(hash)
  if (!image) {
    const response = await fetch(`https://textures.minecraft.net/texture/${hash}`, { signal: AbortSignal.timeout(10000) }).catch(() => null)
    if (!response?.ok) return c.body(null, 404)
    image = await response.arrayBuffer()
    if (previews.size >= 500) previews.clear()
    previews.set(hash, image)
  }
  return c.body(image, 200, {
    'Content-Type': 'image/png',
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'public, max-age=31536000, immutable',
  })
})

adminSkinRoutes.get('/mineskin', async (c) => {
  const params = new URLSearchParams({ size: '24' })
  const query = c.req.query('query')
  const after = c.req.query('after')
  if (query) params.set('filter', query)
  if (after) params.set('after', after)
  const data = await getJson<{
    skins: { uuid: string; name?: string | null; texture: string }[]
    pagination?: { next?: { after?: string } }
  }>(`https://api.mineskin.org/v2/skins?${params}`)
  if (!data) return fail(c, 502, 'BadGateway', 'MineSkin request failed.')
  return c.json({
    items: data.skins
      .filter((skin) => skin.name && !/_(HEAD|BODY|ARM|LEG)(_(LEFT|RIGHT))?(_\d+)?_?$/i.test(skin.name))
      .map((skin) => ({ id: skin.uuid, name: skin.name, texture: skin.texture, previewUrl: previewUrl(skin.texture) })),
    next: data.pagination?.next?.after ?? null,
  })
})

adminSkinRoutes.get('/player/:name', async (c) => {
  const skin = await mojangSkin(c.req.param('name'))
  if (!skin) return fail(c, 404, 'NotFoundException', 'Player skin not found.')
  return c.json({ ...skin, previewUrl: previewUrl(skin.texture) })
})

adminSkinRoutes.post('/import', async (c) => {
  const skin = await importSkin(await c.req.json<Record<string, unknown>>().catch(() => ({}) as Record<string, unknown>))
  if (!skin) return fail(c, 404, 'NotFoundException', 'Skin not found.')
  return c.json(await addToCatalog({ ...skin, createdBy: c.var.user.id }))
})

adminSkinRoutes.post('/upload', async (c) => {
  const { file, model, name } = await c.req.parseBody()
  const skinModel = parseSkinModel(model)
  const hash = file instanceof File && skinModel ? await storeSkin(file) : null
  if (!hash || !skinModel || typeof name !== 'string' || !name.trim()) {
    return fail(c, 400, 'IllegalArgumentException', 'Invalid skin: expected PNG 64x64 or 64x32, model classic or slim and name.')
  }
  return c.json(await addToCatalog({ name: name.trim().slice(0, 64), hash, model: skinModel, source: 'upload', createdBy: c.var.user.id }))
})

adminSkinRoutes.delete('/:id', async (c) => {
  const id = c.req.param('id')
  const [removed] = /^\d{1,9}$/.test(id) ? await db.delete(skins).where(eq(skins.id, Number(id))).returning({ id: skins.id }) : []
  if (!removed) return fail(c, 404, 'NotFoundException', 'Skin not found.')
  return c.body(null, 204)
})

export async function importSkin(body: Record<string, unknown>): Promise<SkinImport | null> {
  const { source, id, name } = body
  const resolved = source === 'mojang' ? await mojangSkin(name) : source === 'mineskin' ? await mineskinSkin(id, name) : null
  const hash = resolved && (await downloadTexture(resolved.texture))
  return resolved && hash ? { name: resolved.name, hash, model: resolved.model, source: source === 'mojang' ? 'mojang' : 'mineskin' } : null
}

async function mineskinSkin(id: unknown, name: unknown): Promise<SkinSource | null> {
  if (typeof id !== 'string' || !isUuid(id)) return null
  const data = await getJson<{ skin: { name?: string | null; variant?: string; texture: { hash: { skin: string } } } }>(
    `https://api.mineskin.org/v2/skins/${id}`,
  )
  if (!data) return null
  const given = typeof name === 'string' ? name.trim() : ''
  return {
    name: (given || data.skin.name || 'Skin').slice(0, 64),
    texture: data.skin.texture.hash.skin,
    model: data.skin.variant === 'slim' ? 'slim' : 'classic',
  }
}

async function mojangSkin(name: unknown): Promise<SkinSource | null> {
  if (typeof name !== 'string' || !/^[A-Za-z0-9_]{1,16}$/.test(name)) return null
  const profile = await getJson<{ id: string; name: string }>(`https://api.mojang.com/users/profiles/minecraft/${name}`)
  if (!profile) return null
  const session = await getJson<{ properties: { name: string; value: string }[] }>(
    `https://sessionserver.mojang.com/session/minecraft/profile/${profile.id}`,
  )
  const value = session?.properties.find((property) => property.name === 'textures')?.value
  if (!value) return null
  const skin = (JSON.parse(atob(value)) as { textures?: { SKIN?: { url: string; metadata?: { model?: string } } } }).textures?.SKIN
  const texture = skin?.url.split('/').pop()
  if (!skin || !texture) return null
  return { name: profile.name, texture, model: skin.metadata?.model === 'slim' ? 'slim' : 'classic' }
}

async function addToCatalog(values: Pick<CatalogSkin, 'name' | 'hash' | 'model' | 'source' | 'createdBy'>) {
  const [row] = await db
    .insert(skins)
    .values(values)
    .onConflictDoUpdate({ target: [skins.hash, skins.model], set: { name: values.name } })
    .returning()
  return catalogItem(row)
}

async function getJson<T>(url: string): Promise<T | null> {
  const response = await fetch(url, {
    headers: { 'User-Agent': 'MinecraftLauncherSkinCatalog/1.0', Accept: 'application/json' },
    signal: AbortSignal.timeout(10000),
  }).catch(() => null)
  return response?.ok ? ((await response.json().catch(() => null)) as T | null) : null
}

function previewUrl(texture: string): string {
  return `${config.publicUrl}/api/skins/preview/${texture}`
}
