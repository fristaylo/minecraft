import { Hono } from 'hono'
import { config } from './config'

type ServerStatus = {
  online: boolean
  players: { online: number; max: number; sample: string[] }
  ping: number | null
}

type StatusJson = { players?: { online?: number; max?: number; sample?: { name: string }[] } }

const offline: ServerStatus = { online: false, players: { online: 0, max: 0, sample: [] }, ping: null }
let cached: { at: number; value: Promise<ServerStatus> } | undefined

export const serverStatus = new Hono()

serverStatus.get('/status', async (c) => {
  if (!cached || Date.now() - cached.at > 15000) cached = { at: Date.now(), value: queryStatus() }
  return c.json(await cached.value)
})

function queryStatus(): Promise<ServerStatus> {
  return new Promise((resolve) => {
    let buffer = Buffer.alloc(0)
    let sentAt = 0
    const timer = setTimeout(() => resolve(offline), 3000)
    const finish = (value: ServerStatus) => {
      clearTimeout(timer)
      resolve(value)
    }
    Bun.connect({
      hostname: config.mcHost,
      port: config.mcPort,
      socket: {
        open(socket) {
          const port = Buffer.alloc(2)
          port.writeUInt16BE(config.mcPort)
          const handshake = Buffer.concat([varInt(0), varInt(0), string(config.mcHost), port, varInt(1)])
          sentAt = Date.now()
          socket.write(Buffer.concat([varInt(handshake.length), handshake, varInt(1), varInt(0)]))
        },
        data(socket, chunk) {
          buffer = Buffer.concat([buffer, chunk])
          const length = readVarInt(buffer, 0)
          if (!length || buffer.length < length.size + length.value) return
          const packet = buffer.subarray(length.size, length.size + length.value)
          const id = readVarInt(packet, 0)
          const size = id && readVarInt(packet, id.size)
          if (!id || !size) {
            finish(offline)
            socket.end()
            return
          }
          const start = id.size + size.size
          try {
            const json: StatusJson = JSON.parse(packet.toString('utf8', start, start + size.value))
            finish({
              online: true,
              players: {
                online: json.players?.online ?? 0,
                max: json.players?.max ?? 0,
                sample: (json.players?.sample ?? []).map((player) => player.name),
              },
              ping: Date.now() - sentAt,
            })
          } catch {
            finish(offline)
          }
          socket.end()
        },
        error() {
          finish(offline)
        },
        close() {
          finish(offline)
        },
      },
    }).catch(() => finish(offline))
  })
}

function varInt(value: number): Buffer {
  const bytes: number[] = []
  let rest = value
  while (rest > 0x7f) {
    bytes.push((rest & 0x7f) | 0x80)
    rest >>>= 7
  }
  bytes.push(rest)
  return Buffer.from(bytes)
}

function string(value: string): Buffer {
  const payload = Buffer.from(value, 'utf8')
  return Buffer.concat([varInt(payload.length), payload])
}

function readVarInt(buffer: Buffer, offset: number): { value: number; size: number } | undefined {
  let value = 0
  for (let size = 1; size <= 5 && offset + size <= buffer.length; size++) {
    const byte = buffer[offset + size - 1]
    value |= (byte & 0x7f) << (7 * (size - 1))
    if (!(byte & 0x80)) return { value, size }
  }
  return undefined
}
