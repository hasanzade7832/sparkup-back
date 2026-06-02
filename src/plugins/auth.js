import fp from 'fastify-plugin'
import dotenv from 'dotenv'

dotenv.config()

async function authPlugin(app) {
  await app.register(import('@fastify/jwt'), {
    secret: process.env.JWT_SECRET,
    sign: {
      expiresIn: process.env.JWT_EXPIRES_IN
    }
  })

  // decorator برای محافظت از روت‌ها
  app.decorate('authenticate', async (request, reply) => {
    try {
      await request.jwtVerify()
    } catch (err) {
      reply.status(401).send({
        success: false,
        message: 'توکن نامعتبر یا منقضی شده'
      })
    }
  })
}

export default fp(authPlugin)