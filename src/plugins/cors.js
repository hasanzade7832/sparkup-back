import fp from 'fastify-plugin'

async function corsPlugin(app) {
  await app.register(import('@fastify/cors'), {
    origin: [
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      'http://localhost:3001',
      'http://127.0.0.1:3001',
    ],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
  })
}

export default fp(corsPlugin)
