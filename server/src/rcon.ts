import { config } from './config'

export function rcon(command: string): Promise<string> {
  return new Promise((resolve, reject) => {
    let buffer = Buffer.alloc(0)
    let authenticated = false
    const timer = setTimeout(() => reject(new Error('RCON timeout')), 5000)
    Bun.connect({
      hostname: config.rconHost,
      port: config.rconPort,
      socket: {
        open(socket) {
          socket.write(packet(1, 3, config.rconPassword))
        },
        data(socket, chunk) {
          buffer = Buffer.concat([buffer, chunk])
          while (buffer.length >= 4 && buffer.length >= 4 + buffer.readInt32LE(0)) {
            const size = buffer.readInt32LE(0)
            const id = buffer.readInt32LE(4)
            const type = buffer.readInt32LE(8)
            const body = buffer.toString('utf8', 12, 4 + size - 2)
            buffer = buffer.subarray(4 + size)
            if (!authenticated) {
              if (type !== 2) continue
              if (id === -1) {
                reject(new Error('RCON authentication failed'))
                socket.end()
                return
              }
              authenticated = true
              socket.write(packet(2, 2, command))
              continue
            }
            clearTimeout(timer)
            resolve(body)
            socket.end()
            return
          }
        },
        error(_, error) {
          reject(error)
        },
        close() {
          reject(new Error('RCON connection closed'))
        },
      },
    }).catch(reject)
  })
}

function packet(id: number, type: number, body: string): Buffer {
  const payload = Buffer.from(body, 'utf8')
  const result = Buffer.alloc(14 + payload.length)
  result.writeInt32LE(10 + payload.length, 0)
  result.writeInt32LE(id, 4)
  result.writeInt32LE(type, 8)
  payload.copy(result, 12)
  return result
}
