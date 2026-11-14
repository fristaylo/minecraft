import { sql } from 'drizzle-orm'
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core'

export const roleEnum = pgEnum('role', ['pending', 'user', 'admin'])
export const skinModelEnum = pgEnum('skin_model', ['classic', 'slim'])

export const users = pgTable(
  'users',
  {
    id: uuid().primaryKey(),
    name: varchar({ length: 16 }).notNull(),
    passwordHash: text('password_hash').notNull(),
    role: roleEnum().notNull().default('pending'),
    skinHash: varchar('skin_hash', { length: 64 }),
    skinModel: skinModelEnum('skin_model').notNull().default('classic'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    lastLoginAt: timestamp('last_login_at'),
  },
  (t) => [uniqueIndex('users_name_lower_idx').on(sql`lower(${t.name})`)],
)

export const tokens = pgTable(
  'tokens',
  {
    accessToken: varchar('access_token', { length: 64 }).primaryKey(),
    clientToken: varchar('client_token', { length: 128 }).notNull(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [index('tokens_user_id_idx').on(t.userId)],
)

export type User = typeof users.$inferSelect

export const themeEnum = pgEnum('theme', ['day', 'dusk', 'night', 'dawn', 'snow', 'desert', 'nether', 'end'])
export const loaderEnum = pgEnum('loader', ['vanilla', 'fabric', 'forge', 'neoforge'])
export const fileSides = ['client', 'server', 'both'] as const
export const fileKinds = ['mod', 'resourcepack', 'shader', 'config'] as const
export const filePolicies = ['managed', 'once'] as const

export const packs = pgTable('packs', {
  id: varchar({ length: 32 }).primaryKey(),
  name: varchar({ length: 64 }).notNull(),
  theme: themeEnum().notNull(),
  minecraft: varchar({ length: 16 }).notNull(),
  loaderType: loaderEnum('loader_type').notNull(),
  loaderVersion: varchar('loader_version', { length: 64 }),
  java: integer().notNull(),
  server: varchar({ length: 128 }),
  gameServer: boolean('game_server').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const packVersions = pgTable(
  'pack_versions',
  {
    packId: varchar('pack_id', { length: 32 })
      .notNull()
      .references(() => packs.id, { onDelete: 'cascade' }),
    version: varchar({ length: 32 }).notNull(),
    manifest: jsonb().$type<Manifest>().notNull(),
    publishedAt: timestamp('published_at').notNull().defaultNow(),
    publishedBy: uuid('published_by').references(() => users.id, { onDelete: 'set null' }),
  },
  (t) => [primaryKey({ columns: [t.packId, t.version] })],
)

export type Pack = typeof packs.$inferSelect

export type ManifestFile = {
  path: string
  sha1: string
  size: number
  url: string
  side: (typeof fileSides)[number]
  kind: (typeof fileKinds)[number]
  optional: boolean
  defaultEnabled: boolean
  policy: (typeof filePolicies)[number]
  meta?: {
    title: string
    author: string
    description: string
    iconUrl: string
    gallery: string[]
    pageUrl: string
    source: 'modrinth' | 'curseforge' | 'manual' | 'local' | 'custom'
    projectId: string
    versionId: string
    dependencies: string[]
  }
}

export type Manifest = Pick<Pack, 'id' | 'name' | 'minecraft' | 'java' | 'server' | 'theme'> & {
  version: string
  loader: { type: Pack['loaderType']; version: Pack['loaderVersion'] }
  files: ManifestFile[]
  changelog: { kind: 'add' | 'upd' | 'del'; text: string }[]
}
