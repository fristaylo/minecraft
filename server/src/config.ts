export const config = {
  databaseUrl: required('DATABASE_URL'),
  publicUrl: required('PUBLIC_URL').replace(/\/+$/, ''),
  dataDir: process.env.DATA_DIR ?? '/data',
  rconHost: process.env.RCON_HOST ?? 'localhost',
  rconPort: Number(process.env.RCON_PORT ?? 25575),
  rconPassword: process.env.RCON_PASSWORD ?? '',
  mcHost: process.env.MC_HOST ?? 'localhost',
  mcPort: Number(process.env.MC_PORT ?? 25565),
  mcVersion: process.env.MC_VERSION ?? '',
  mcLoader: (process.env.MC_LOADER ?? '').toLowerCase(),
  curseforgeApiKey: process.env.CURSEFORGE_API_KEY ?? '',
  adminUsernames: (process.env.ADMIN_USERNAMES ?? '')
    .split(',')
    .map((name) => name.trim().toLowerCase())
    .filter(Boolean),
}

function required(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing env ${name}`)
  return value
}
