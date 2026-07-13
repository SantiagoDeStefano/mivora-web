import { Server } from 'socket.io'
import { TokenPayload } from '~/models/requests/users.requests'
import { Server as ServerHttp } from 'http'
import { verifyAccessToken } from './common'

let io: Server

export const initSocket = (httpServer: ServerHttp) => {
  io = new Server(httpServer, {
    cors: {
      origin: [
        'http://localhost:4000',
        'http://localhost:5173',
        'http://47.129.118.52:4000',
        'http://26.73.34.56:5173',
        'http://khoinguyenpham.name.vn',
        'https://khoinguyenpham.name.vn',
        'https://mivora.vercel.app'
      ],
      methods: ['GET', 'POST'],
      credentials: true
    }
  })

  io.use(async (socket, next) => {
    const { Authorization } = socket.handshake.auth
    const access_token = Authorization?.split(' ')[1]

    try {
      const decoded_authorization = await verifyAccessToken(access_token)
      // attach user info
      socket.handshake.auth.decoded_authorization = decoded_authorization
      socket.handshake.auth.access_token = access_token
      next()
    } catch (error) {
      next({
        message: 'Unauthorized',
        name: 'UnauthorizedError',
        data: error
      })
    }
  })

  io.on('connection', (socket) => {
    console.log(`user ${socket.id} connected`)

    const user_id = (socket.handshake.auth.decoded_authorization as TokenPayload).user_id

    socket.emit('me', user_id)

    // this is the ONLY thing you really need:
    socket.join(user_id)

    socket.on('whoami', () => {
      socket.emit('me', user_id)
    })

    socket.on('join_event', (event_id: string) => {
      socket.join(event_id)
    })

    socket.on('leave_event', (event_id: string) => {
      socket.leave(event_id)
    })

    socket.on('disconnect', (reason) => {
      console.log(`user ${socket.id} disconnected: ${reason}`)
    })
  })

  return io
}

export const getIO = () => {
  if (!io) {
    throw new Error('Socket.io not initialized')
  }
  return io
}

export default initSocket
