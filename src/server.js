import app from './app.js'
import dotenv from 'dotenv'

dotenv.config()

const PORT = process.env.PORT || 3001
const HOST = process.env.HOST || '0.0.0.0'

const start = async () => {
  try {
    await app.listen({ port: PORT, host: HOST })
    console.log(`🚀 SparkUp server running on http://localhost:${PORT}`)
  } catch (err) {
    app.log.error(err)
    process.exit(1)
  }
}

start()