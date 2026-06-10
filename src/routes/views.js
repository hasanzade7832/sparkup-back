async function viewsRoutes(app) {

  // POST /api/views/:postId — ثبت بازدید
  app.post('/:postId', {
    preHandler: [app.authenticate]
  }, async (request, reply) => {
    const { postId } = request.params
    const userId = request.user.id

    try {
      // چک کن قبلاً دیده یا نه
      const existing = await app.db.query(
        'SELECT id FROM post_views WHERE user_id = $1 AND post_id = $2',
        [userId, postId]
      )

      if (existing.rows.length > 0) {
        return reply.send({
          success: true,
          message: 'قبلاً ثبت شده'
        })
      }

      // ثبت بازدید
      await app.db.query(
        'INSERT INTO post_views (user_id, post_id) VALUES ($1, $2)',
        [userId, postId]
      )

      // آپدیت view_count توی posts
      await app.db.query(
        'UPDATE posts SET view_count = view_count + 1 WHERE id = $1',
        [postId]
      )

      return reply.status(201).send({
        success: true,
        message: 'بازدید ثبت شد'
      })

    } catch (err) {
      app.log.error(err)
      return reply.status(500).send({
        success: false,
        message: 'خطای سرور'
      })
    }
  })

  // GET /api/views/:postId — لیست بینندگان
  app.get('/:postId', {
    preHandler: [app.authenticate]
  }, async (request, reply) => {
    const { postId } = request.params

    try {
      const result = await app.db.query(`
        SELECT u.id, u.name, u.avatar, pv.viewed_at
        FROM post_views pv
        JOIN users u ON pv.user_id = u.id
        WHERE pv.post_id = $1
        ORDER BY pv.viewed_at DESC
      `, [postId])

      return reply.send({
        success: true,
        data: result.rows,
        total: result.rows.length
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

export default viewsRoutes