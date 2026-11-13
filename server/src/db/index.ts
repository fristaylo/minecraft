import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate as runMigrations } from 'drizzle-orm/postgres-js/migrator'
import { join } from 'node:path'
import postgres from 'postgres'
import { config } from '../config'
import * as schema from './schema'

export const db = drizzle(postgres(config.databaseUrl), { schema })

export async function migrate(): Promise<void> {
  await runMigrations(db, { migrationsFolder: join(import.meta.dirname, '../../drizzle') })
}
