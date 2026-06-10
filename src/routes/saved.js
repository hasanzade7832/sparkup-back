async function savedRoutes(app) {

  // POST /api/saved/:postId — ذخیره/حذف پست
  app.post('/:postId', {
    preHandler: [app.authenticate]
  }, async (request, reply) => {
    const { postId } = request.params
    const userId = request.user.id

    try {
      const existing = await app.db.query(
        'SELECT id FROM saved_posts WHERE user_id = $1 AND post_id = $2',
        [userId, postId]
      )

      if (existing.rows.length > 0) {
        // حذف از ذخیره‌ها
        await app.db.query(
          'DELETE FROM saved_posts WHERE user_id = $1 AND post_id = $2',
          [userId, postId]
        )
        return reply.send({
          success: true,
          action: 'unsaved',
          message: 'از ذخیره‌ها حذف شد'
        })
      }

      // ذخیره پست
      await app.db.query(
        'INSERT INTO saved_posts (user_id, post_id) VALUES ($1, $2)',
        [userId, postId]
      )

      return reply.status(201).send({
        success: true,
        action: 'saved',
        message: 'پست ذخیره شد'
      })

    } catch (err) {
      app.log.error(err)
      return reply.status(500).send({
        success: false,
        message: 'خطای سرور'
      })
    }
  })

  // GET /api/saved — لیست پست‌های ذخیره‌شده
  app.get('/', {
    preHandler: [app.authenticate]
  }, async (request, reply) => {
    const userId = request.user.id

    try {
      const result = await app.db.query(`
        SELECT p.*, u.name as author_name, sp.created_at as saved_at
        FROM saved_posts sp
        JOIN posts p ON sp.post_id = p.id
        JOIN users u ON p.user_id = u.id
        WHERE sp.user_id = $1
        ORDER BY sp.created_at DESC
      `, [userId])

      return reply.send({
        success: true,
        data: result.rows
      })

    } catch (err) {
      app.log.error(err)
      return reply.status(500).send({
        success: false,
        message: 'خطای سرور'
      })
    }
  })

  // GET /api/saved/:postId/check — چک کن ذخیره شده یا نه
  app.get('/:postId/check', {
    preHandler: [app.authenticate]
  }, async (request, reply) => {
    const { postId } = request.params
    const userId = request.user.id

    try {
      const result = await app.db.query(
        'SELECT id FROM saved_posts WHERE user_id = $1 AND post_id = $2',
        [userId, postId]
      )

      return reply.send({
        success: true,
        isSaved: result.rows.length > 0
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

export default savedRoutes