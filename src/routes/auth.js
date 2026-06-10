import { registerSchema, loginSchema } from '../schemas/auth.schema.js'
import { hashPassword, comparePassword } from '../utils/hash.js'

async function authRoutes(app) {

  // POST /api/auth/register
  app.post('/register', { schema: registerSchema }, async (request, reply) => {
    const { name, username, password } = request.body

    try {
      // چک کن username تکراری نباشه
      const existing = await app.db.query(
        'SELECT id FROM users WHERE username = $1',
        [username]
      )

      if (existing.rows.length > 0) {
        return reply.status(409).send({
          success: false,
          message: 'این نام کاربری قبلاً ثبت شده'
        })
      }

      const hashed = await hashPassword(password)

      const result = await app.db.query(
        `INSERT INTO users (name, username, password)
         VALUES ($1, $2, $3)
         RETURNING id, name, username, created_at`,
        [name, username, hashed]
      )

      const user = result.rows[0]

      const token = app.jwt.sign({
        id: user.id,
        username: user.username,
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
    const { username, password } = request.body

    try {
      const result = await app.db.query(
        'SELECT * FROM users WHERE username = $1',
        [username]
      )

      if (result.rows.length === 0) {
        return reply.status(401).send({
          success: false,
          message: 'نام کاربری یا رمز عبور اشتباه است'
        })
      }

      const user = result.rows[0]

      if (user.role === 'blocked') {
        return reply.status(403).send({
          success: false,
          message: 'حساب شما مسدود شده'
        })
      }

      const isValid = await comparePassword(password, user.password)

      if (!isValid) {
        return reply.status(401).send({
          success: false,
          message: 'نام کاربری یا رمز عبور اشتباه است'
        })
      }

      const token = app.jwt.sign({
        id: user.id,
        username: user.username,
        name: user.name
      })

      return reply.send({
        success: true,
        message: 'ورود موفق',
        token,
        user: {
          id: user.id,
          name: user.name,
          username: user.username,
          avatar: user.avatar,
          role: user.role,
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
        'SELECT id, name, username, avatar, role, created_at FROM users WHERE id = $1',
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

  // PUT /api/auth/profile — ویرایش پروفایل
  app.put('/profile', {
    preHandler: [app.authenticate]
  }, async (request, reply) => {
    const { name, username, avatar } = request.body
    const userId = request.user.id

    if (!name || name.trim() === '') {
      return reply.status(400).send({
        success: false,
        message: 'نام الزامی است'
      })
    }

    try {
      // چک کن username تکراری نباشه
      if (username) {
        const existing = await app.db.query(
          'SELECT id FROM users WHERE username = $1 AND id != $2',
          [username, userId]
        )
        if (existing.rows.length > 0) {
          return reply.status(409).send({
            success: false,
            message: 'این نام کاربری قبلاً ثبت شده'
          })
        }
      }

      const result = await app.db.query(
        `UPDATE users
         SET name = $1, username = $2, avatar = $3, updated_at = NOW()
         WHERE id = $4
         RETURNING id, name, username, avatar, role, created_at`,
        [name.trim(), username || request.user.username, avatar || null, userId]
      )

      return reply.send({
        success: true,
        message: 'پروفایل بروزرسانی شد',
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

  // PUT /api/auth/change-password — تغییر رمز عبور
  app.put('/change-password', {
    preHandler: [app.authenticate]
  }, async (request, reply) => {
    const { currentPassword, newPassword } = request.body
    const userId = request.user.id

    if (!currentPassword || !newPassword) {
      return reply.status(400).send({
        success: false,
        message: 'همه فیلدها الزامی هستن'
      })
    }

    if (newPassword.length < 6) {
      return reply.status(400).send({
        success: false,
        message: 'رمز جدید باید حداقل ۶ کاراکتر باشه'
      })
    }

    try {
      const result = await app.db.query(
        'SELECT password FROM users WHERE id = $1',
        [userId]
      )

      const isValid = await comparePassword(currentPassword, result.rows[0].password)

      if (!isValid) {
        return reply.status(401).send({
          success: false,
          message: 'رمز فعلی اشتباهه'
        })
      }

      const hashed = await hashPassword(newPassword)

      await app.db.query(
        'UPDATE users SET password = $1, updated_at = NOW() WHERE id = $2',
        [hashed, userId]
      )

      return reply.send({
        success: true,
        message: 'رمز عبور تغییر کرد'
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