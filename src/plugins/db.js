import fp from 'fastify-plugin'
import pg from 'pg'
import dotenv from 'dotenv'

dotenv.config()

const { Pool } = pg

async function dbPlugin(app) {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  })

  try {
    await pool.query('SELECT 1')
    console.log('✅ Database connected successfully')
  } catch (err) {
    console.error('❌ Database connection failed:', err.message)
    process.exit(1)
  }

  app.decorate('db', pool)

  app.addHook('onClose', async () => {
    await pool.end()
    console.log('🔌 Database disconnected')
  })
}

export default fp(dbPlugin)