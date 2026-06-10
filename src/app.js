import Fastify from 'fastify'
import dotenv from 'dotenv'
import { join } from 'path'
import { fileURLToPath } from 'url'

import corsPlugin from './plugins/cors.js'
import authPlugin from './plugins/auth.js'
import dbPlugin from './plugins/db.js'

import authRoutes from './routes/auth.js'
import postsRoutes from './routes/posts.js'
import mediaRoutes from './routes/media.js'
import reactionsRoutes from './routes/reactions.js'
import commentsRoutes from './routes/comments.js'
import viewsRoutes from './routes/views.js'
import savedRoutes from './routes/saved.js'
import actionsRoutes from './routes/actions.js'
import scoresRoutes from './routes/scores.js'
import adminRoutes from './routes/admin.js'

dotenv.config()

const __dirname = fileURLToPath(new URL('.', import.meta.url))

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
await app.register(import('@fastify/multipart'), {
  limits: {
    fileSize: Number(process.env.MAX_FILE_SIZE) || 10485760
  }
})
await app.register(import('@fastify/static'), {
  root: join(__dirname, '..', 'uploads'),
  prefix: '/uploads/',
})

// routes
await app.register(authRoutes, { prefix: '/api/auth' })
await app.register(postsRoutes, { prefix: '/api/posts' })
await app.register(mediaRoutes, { prefix: '/api/media' })
await app.register(reactionsRoutes, { prefix: '/api/reactions' })
await app.register(commentsRoutes, { prefix: '/api/comments' })
await app.register(viewsRoutes, { prefix: '/api/views' })
await app.register(savedRoutes, { prefix: '/api/saved' })
await app.register(actionsRoutes, { prefix: '/api/actions' })
await app.register(scoresRoutes, { prefix: '/api/scores' })
await app.register(adminRoutes, { prefix: '/api/admin' })

// health check
app.get('/health', async () => {
  return { status: 'ok', app: 'SparkUp', time: new Date().toISOString() }
})

export default app