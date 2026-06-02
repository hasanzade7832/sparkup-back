import Fastify from 'fastify'
import dotenv from 'dotenv'

import corsPlugin from './plugins/cors.js'
import authPlugin from './plugins/auth.js'
import dbPlugin from './plugins/db.js'

import authRoutes from './routes/auth.js'
import postsRoutes from './routes/posts.js'
import mediaRoutes from './routes/media.js'

dotenv.config()

const app = Fastify({
  logger: {
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'HH:MM:ss',
        ignore: 'pid,hostname'
      }
    }
  }
})

// plugins
await app.register(corsPlugin)
await app.register(dbPlugin)
await app.register(authPlugin)

// routes
await app.register(authRoutes, { prefix: '/api/auth' })
await app.register(postsRoutes, { prefix: '/api/posts' })
await app.register(mediaRoutes, { prefix: '/api/media' })

// health check
app.get('/health', async () => {
  return { status: 'ok', app: 'SparkUp', time: new Date().toISOString() }
})

export default app