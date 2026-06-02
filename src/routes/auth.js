import { registerSchema, loginSchema } from '../schemas/auth.schema.js'
import { hashPassword, comparePassword } from '../utils/hash.js'

async function authRoutes(app) {

  // POST /api/auth/register
  app.post('/register', { schema: registerSchema }, async (request, reply) => {
    const { name, email, password } = request.body

    try {
      // چک کن ایمیل تکراری نباشه
      const existing = await app.db.query(
        'SELECT id FROM users WHERE email = $1',
        [email]
      )

      if (existing.rows.length > 0) {
        return reply.status(409).send({
          success: false,
          message: 'این ایمیل قبلاً ثبت شده'
        })
      }

      // هش کردن پسورد
      const hashed = await hashPassword(password)

      // ذخیره کاربر
      const result = await app.db.query(
        `INSERT INTO users (name, email, password)
         VALUES ($1, $2, $3)
         RETURNING id, name, email, created_at`,
        [name, email, hashed]
      )

      const user = result.rows[0]

      // ساخت توکن
      const token = app.jwt.sign({
        id: user.id,
        email: user.email,
        name: user.name
      })

      return reply.status(201).send({
        success: true,
        message: 'ثبت‌نام موفق',
        token,
        user
      })

    } catch (err) {
      app.log.error(err)
      return reply.status(500).send({
        success: false,
        message: 'خطای سرور'
      })
    }
  })

  // POST /api/auth/login
  app.post('/login', { schema: loginSchema }, async (request, reply) => {
    const { email, password } = request.body

    try {
      const result = await app.db.query(
        'SELECT * FROM users WHERE email = $1',
        [email]
      )

      if (result.rows.length === 0) {
        return reply.status(401).send({
          success: false,
          message: 'ایمیل یا پسورد اشتباه است'
        })
      }

      const user = result.rows[0]

      const isValid = await comparePassword(password, user.password)

      if (!isValid) {
        return reply.status(401).send({
          success: false,
          message: 'ایمیل یا پسورد اشتباه است'
        })
      }

      const token = app.jwt.sign({
        id: user.id,
        email: user.email,
        name: user.name
      })

      return reply.send({
        success: true,
        message: 'ورود موفق',
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          created_at: user.created_at
        }
      })

    } catch (err) {
      app.log.error(err)
      return reply.status(500).send({
        success: false,
        message: 'خطای سرور'
      })
    }
  })

  // GET /api/auth/me
  app.get('/me', {
    preHandler: [app.authenticate]
  }, async (request, reply) => {
    try {
      const result = await app.db.query(
        'SELECT id, name, email, created_at FROM users WHERE id = $1',
        [request.user.id]
      )

      if (result.rows.length === 0) {
        return reply.status(404).send({
          success: false,
          message: 'کاربر یافت نشد'
        })
      }

      return reply.send({
        success: true,
        user: result.rows[0]
      })

    } catch (err) {
      app.log.error(err)
      return reply.status(500).send({
        success: false,
        message: 'خطای سرور'
      })
    }
  })

}

export default authRoutes