async function adminRoutes(app) {

  // middleware ادمین
  async function isAdmin(request, reply) {
    await app.authenticate(request, reply)
    const result = await app.db.query(
      'SELECT role FROM users WHERE id = $1',
      [request.user.id]
    )
    const role = result.rows[0]?.role
    if (role !== 'admin' && role !== 'superadmin') {
      return reply.status(403).send({
        success: false,
        message: 'دسترسی فقط برای ادمین'
      })
    }
    request.userRole = role
  }

  // middleware سوپر ادمین
  async function isSuperAdmin(request, reply) {
    await app.authenticate(request, reply)
    const result = await app.db.query(
      'SELECT role FROM users WHERE id = $1',
      [request.user.id]
    )
    if (result.rows[0]?.role !== 'superadmin') {
      return reply.status(403).send({
        success: false,
        message: 'دسترسی فقط برای سوپر ادمین'
      })
    }
  }

  // GET /api/admin/actions — لیست همه اقدامات
  app.get('/actions', {
    preHandler: [isAdmin]
  }, async (request, reply) => {
    const { status, page = 1, limit = 20 } = request.query
    const offset = (page - 1) * limit

    try {
      let query = `
        SELECT da.*, u.name as user_name, u.username as user_username,
        COUNT(*) OVER() as total_count
        FROM daily_actions da
        JOIN users u ON da.user_id = u.id
      `
      const params = []

      if (status) {
        params.push(status)
        query += ` WHERE da.status = $${params.length}`
      }

      params.push(limit)
      params.push(offset)
      query += ` ORDER BY da.created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`

      const result = await app.db.query(query, params)

      return reply.send({
        success: true,
        data: result.rows,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total: Number(result.rows[0]?.total_count || 0)
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

  // PUT /api/admin/actions/:id/approve
  app.put('/actions/:id/approve', {
    preHandler: [isAdmin]
  }, async (request, reply) => {
    const { id } = request.params

    try {
      await app.db.query(
        'UPDATE daily_actions SET status = $1 WHERE id = $2',
        ['approved', id]
      )

      return reply.send({
        success: true,
        message: 'اقدام تأیید شد'
      })

    } catch (err) {
      app.log.error(err)
      return reply.status(500).send({
        success: false,
        message: 'خطای سرور'
      })
    }
  })

  // PUT /api/admin/actions/:id/reject
  app.put('/actions/:id/reject', {
    preHandler: [isAdmin]
  }, async (request, reply) => {
    const { id } = request.params

    try {
      const action = await app.db.query(
        'SELECT user_id, status FROM daily_actions WHERE id = $1',
        [id]
      )

      if (action.rows.length === 0) {
        return reply.status(404).send({
          success: false,
          message: 'اقدام یافت نشد'
        })
      }

      if (action.rows[0].status === 'rejected') {
        return reply.status(400).send({
          success: false,
          message: 'این اقدام قبلاً رد شده'
        })
      }

      const userId = action.rows[0].user_id

      await app.db.query(
        'UPDATE daily_actions SET status = $1 WHERE id = $2',
        ['rejected', id]
      )

      await app.db.query(`
        UPDATE user_scores
        SET total_score = GREATEST(0, total_score - 1), updated_at = NOW()
        WHERE user_id = $1
      `, [userId])

      return reply.send({
        success: true,
        message: 'اقدام رد شد و ۱ امتیاز کم شد'
      })

    } catch (err) {
      app.log.error(err)
      return reply.status(500).send({
        success: false,
        message: 'خطای سرور'
      })
    }
  })

  // GET /api/admin/users
  app.get('/users', {
    preHandler: [isAdmin]
  }, async (request, reply) => {
    const { page = 1, limit = 20 } = request.query
    const offset = (page - 1) * limit

    try {
      const result = await app.db.query(`
        SELECT 
          u.id, u.name, u.username, u.role, u.avatar, u.created_at,
          COALESCE(us.total_score, 0) as total_score,
          COALESCE(us.streak_count, 0) as streak_count,
          COUNT(*) OVER() as total_count
        FROM users u
        LEFT JOIN user_scores us ON u.id = us.user_id
        ORDER BY u.created_at DESC
        LIMIT $1 OFFSET $2
      `, [limit, offset])

      return reply.send({
        success: true,
        data: result.rows,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total: Number(result.rows[0]?.total_count || 0)
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

  // PUT /api/admin/users/:id/block
  app.put('/users/:id/block', {
    preHandler: [isAdmin]
  }, async (request, reply) => {
    const { id } = request.params

    try {
      // superadmin رو نمیشه بلاک کرد
      const check = await app.db.query(
        'SELECT role FROM users WHERE id = $1',
        [id]
      )
      if (check.rows[0]?.role === 'superadmin') {
        return reply.status(403).send({
          success: false,
          message: 'سوپر ادمین رو نمیشه مسدود کرد'
        })
      }

      await app.db.query(
        "UPDATE users SET role = 'blocked' WHERE id = $1",
        [id]
      )

      return reply.send({
        success: true,
        message: 'کاربر مسدود شد'
      })

    } catch (err) {
      app.log.error(err)
      return reply.status(500).send({
        success: false,
        message: 'خطای سرور'
      })
    }
  })

  // PUT /api/admin/users/:id/unblock
  app.put('/users/:id/unblock', {
    preHandler: [isAdmin]
  }, async (request, reply) => {
    const { id } = request.params

    try {
      await app.db.query(
        "UPDATE users SET role = 'user' WHERE id = $1",
        [id]
      )

      return reply.send({
        success: true,
        message: 'مسدودی رفع شد'
      })

    } catch (err) {
      app.log.error(err)
      return reply.status(500).send({
        success: false,
        message: 'خطای سرور'
      })
    }
  })

  // PUT /api/admin/users/:id/make-admin — ارتقاء به ادمین (فقط superadmin)
  app.put('/users/:id/make-admin', {
    preHandler: [isSuperAdmin]
  }, async (request, reply) => {
    const { id } = request.params

    try {
      const check = await app.db.query(
        'SELECT role FROM users WHERE id = $1',
        [id]
      )

      if (check.rows[0]?.role === 'superadmin') {
        return reply.status(400).send({
          success: false,
          message: 'این کاربر سوپر ادمین است'
        })
      }

      await app.db.query(
        "UPDATE users SET role = 'admin' WHERE id = $1",
        [id]
      )

      return reply.send({
        success: true,
        message: 'کاربر به ادمین ارتقاء یافت'
      })

    } catch (err) {
      app.log.error(err)
      return reply.status(500).send({
        success: false,
        message: 'خطای سرور'
      })
    }
  })

  // PUT /api/admin/users/:id/remove-admin — حذف از ادمین (فقط superadmin)
  app.put('/users/:id/remove-admin', {
    preHandler: [isSuperAdmin]
  }, async (request, reply) => {
    const { id } = request.params

    try {
      const check = await app.db.query(
        'SELECT role FROM users WHERE id = $1',
        [id]
      )

      if (check.rows[0]?.role === 'superadmin') {
        return reply.status(400).send({
          success: false,
          message: 'سوپر ادمین رو نمیشه از ادمین خارج کرد'
        })
      }

      await app.db.query(
        "UPDATE users SET role = 'user' WHERE id = $1",
        [id]
      )

      return reply.send({
        success: true,
        message: 'دسترسی ادمین حذف شد'
      })

    } catch (err) {
      app.log.error(err)
      return reply.status(500).send({
        success: false,
        message: 'خطای سرور'
      })
    }
  })

  // DELETE /api/admin/posts/:id
  app.delete('/posts/:id', {
    preHandler: [isAdmin]
  }, async (request, reply) => {
    const { id } = request.params

    try {
      await app.db.query('DELETE FROM posts WHERE id = $1', [id])

      return reply.send({
        success: true,
        message: 'پست حذف شد'
      })

    } catch (err) {
      app.log.error(err)
      return reply.status(500).send({
        success: false,
        message: 'خطای سرور'
      })
    }
  })

  // GET /api/admin/stats
  app.get('/stats', {
    preHandler: [isAdmin]
  }, async (request, reply) => {
    try {
      const [users, posts, actions, pendingActions] = await Promise.all([
        app.db.query('SELECT COUNT(*) as count FROM users'),
        app.db.query('SELECT COUNT(*) as count FROM posts'),
        app.db.query('SELECT COUNT(*) as count FROM daily_actions'),
        app.db.query("SELECT COUNT(*) as count FROM daily_actions WHERE status = 'pending'"),
      ])

      return reply.send({
        success: true,
        data: {
          total_users: Number(users.rows[0].count),
          total_posts: Number(posts.rows[0].count),
          total_actions: Number(actions.rows[0].count),
          pending_actions: Number(pendingActions.rows[0].count),
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

}

export default adminRoutes