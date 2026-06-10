async function reactionsRoutes(app) {

  // POST /api/reactions/:postId
  app.post('/:postId', {
    preHandler: [app.authenticate]
  }, async (request, reply) => {
    const { postId } = request.params
    const { type } = request.body
    const userId = request.user.id

    const validTypes = ['❤️', '🔥', '👏', '😮', '💯']
    if (!validTypes.includes(type)) {
      return reply.status(400).send({
        success: false,
        message: 'نوع ری‌اکشن نامعتبر است'
      })
    }

    try {
      // چک کن قبلاً ری‌اکشن زده یا نه
      const existing = await app.db.query(
        'SELECT id, type FROM reactions WHERE user_id = $1 AND post_id = $2',
        [userId, postId]
      )

      if (existing.rows.length > 0) {
        if (existing.rows[0].type === type) {
          // همون ری‌اکشن → حذف
          await app.db.query(
            'DELETE FROM reactions WHERE user_id = $1 AND post_id = $2',
            [userId, postId]
          )
          return reply.send({
            success: true,
            action: 'removed',
            message: 'ری‌اکشن حذف شد'
          })
        } else {
          // ری‌اکشن متفاوت → آپدیت
          await app.db.query(
            'UPDATE reactions SET type = $1 WHERE user_id = $2 AND post_id = $3',
            [type, userId, postId]
          )
          return reply.send({
            success: true,
            action: 'updated',
            message: 'ری‌اکشن آپدیت شد'
          })
        }
      }

      // ری‌اکشن جدید
      await app.db.query(
        'INSERT INTO reactions (user_id, post_id, type) VALUES ($1, $2, $3)',
        [userId, postId, type]
      )

      return reply.status(201).send({
        success: true,
        action: 'added',
        message: 'ری‌اکشن ثبت شد'
      })

    } catch (err) {
      app.log.error(err)
      return reply.status(500).send({
        success: false,
        message: 'خطای سرور'
      })
    }
  })

  // GET /api/reactions/:postId
  app.get('/:postId', async (request, reply) => {
    const { postId } = request.params

    try {
      // تعداد هر نوع ری‌اکشن
      const counts = await app.db.query(`
        SELECT type, COUNT(*) as count
        FROM reactions
        WHERE post_id = $1
        GROUP BY type
      `, [postId])

      // لیست کاربران
      const users = await app.db.query(`
        SELECT r.type, u.id, u.name, u.avatar
        FROM reactions r
        JOIN users u ON r.user_id = u.id
        WHERE r.post_id = $1
        ORDER BY r.created_at DESC
      `, [postId])

      return reply.send({
        success: true,
        data: {
          counts: counts.rows,
          users: users.rows
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

  // GET /api/reactions/:postId/me
  app.get('/:postId/me', {
    preHandler: [app.authenticate]
  }, async (request, reply) => {
    const { postId } = request.params
    const userId = request.user.id

    try {
      const result = await app.db.query(
        'SELECT type FROM reactions WHERE user_id = $1 AND post_id = $2',
        [userId, postId]
      )

      return reply.send({
        success: true,
        reaction: result.rows[0]?.type || null
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

export default reactionsRoutes