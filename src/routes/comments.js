async function commentsRoutes(app) {

  // GET /api/comments/:postId
  app.get('/:postId', async (request, reply) => {
    const { postId } = request.params

    try {
      // همه نظرات و ریپلای‌ها flat
      const result = await app.db.query(`
        SELECT c.*, u.name as user_name, u.avatar as user_avatar, u.username as user_username
        FROM comments c
        JOIN users u ON c.user_id = u.id
        WHERE c.post_id = $1
        ORDER BY c.created_at ASC
      `, [postId])

      // ساختار درختی — نظرات اصلی + ریپلای‌هاشون
      const comments = result.rows.filter(c => !c.parent_id)
      const replies = result.rows.filter(c => c.parent_id)

      const commentsWithReplies = comments.map(comment => ({
        ...comment,
        replies: replies.filter(r => r.parent_id === comment.id)
      }))

      return reply.send({
        success: true,
        data: commentsWithReplies
      })

    } catch (err) {
      app.log.error(err)
      return reply.status(500).send({ success: false, message: 'خطای سرور' })
    }
  })

  // POST /api/comments/:postId
  app.post('/:postId', {
    preHandler: [app.authenticate]
  }, async (request, reply) => {
    const { postId } = request.params
    const { content, parent_id, reply_to_user, reply_to_name } = request.body
    const userId = request.user.id

    if (!content || content.trim() === '') {
      return reply.status(400).send({ success: false, message: 'متن نظر نمیتونه خالی باشه' })
    }

    try {
      // اگه ریپلای به ریپلای بود، parent_id رو به نظر اصلی تبدیل کن
      let actualParentId = parent_id
      if (parent_id) {
        const parentComment = await app.db.query(
          'SELECT parent_id FROM comments WHERE id = $1',
          [parent_id]
        )
        // اگه parent هم ریپلای بود، parent_id اصلی رو بگیر
        if (parentComment.rows[0]?.parent_id) {
          actualParentId = parentComment.rows[0].parent_id
        }
      }

      const result = await app.db.query(`
        INSERT INTO comments (user_id, post_id, parent_id, content, reply_to_user, reply_to_name)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `, [userId, postId, actualParentId || null, content.trim(), reply_to_user || null, reply_to_name || null])

      const comment = await app.db.query(`
        SELECT c.*, u.name as user_name, u.avatar as user_avatar, u.username as user_username
        FROM comments c
        JOIN users u ON c.user_id = u.id
        WHERE c.id = $1
      `, [result.rows[0].id])

      return reply.status(201).send({
        success: true,
        message: 'نظر ثبت شد',
        data: { ...comment.rows[0], replies: [] }
      })

    } catch (err) {
      app.log.error(err)
      return reply.status(500).send({ success: false, message: 'خطای سرور' })
    }
  })

  // PUT /api/comments/:id
  app.put('/:id', {
    preHandler: [app.authenticate]
  }, async (request, reply) => {
    const { id } = request.params
    const { content } = request.body
    const userId = request.user.id

    if (!content || content.trim() === '') {
      return reply.status(400).send({ success: false, message: 'متن نظر نمیتونه خالی باشه' })
    }

    try {
      const check = await app.db.query(
        'SELECT id FROM comments WHERE id = $1 AND user_id = $2',
        [id, userId]
      )

      if (check.rows.length === 0) {
        return reply.status(403).send({ success: false, message: 'دسترسی ندارید' })
      }

      const result = await app.db.query(`
        UPDATE comments SET content = $1, updated_at = NOW()
        WHERE id = $2 RETURNING *
      `, [content.trim(), id])

      return reply.send({
        success: true,
        message: 'نظر ویرایش شد',
        data: result.rows[0]
      })

    } catch (err) {
      app.log.error(err)
      return reply.status(500).send({ success: false, message: 'خطای سرور' })
    }
  })

  // DELETE /api/comments/:id
  app.delete('/:id', {
    preHandler: [app.authenticate]
  }, async (request, reply) => {
    const { id } = request.params
    const userId = request.user.id

    try {
      const check = await app.db.query(
        'SELECT id FROM comments WHERE id = $1 AND user_id = $2',
        [id, userId]
      )

      if (check.rows.length === 0) {
        return reply.status(403).send({ success: false, message: 'دسترسی ندارید' })
      }

      await app.db.query('DELETE FROM comments WHERE id = $1', [id])

      return reply.send({ success: true, message: 'نظر حذف شد' })

    } catch (err) {
      app.log.error(err)
      return reply.status(500).send({ success: false, message: 'خطای سرور' })
    }
  })

  // POST /api/comments/:id/like
  app.post('/:id/like', {
    preHandler: [app.authenticate]
  }, async (request, reply) => {
    const { id } = request.params
    const userId = request.user.id

    try {
      const existing = await app.db.query(
        'SELECT id FROM comment_likes WHERE user_id = $1 AND comment_id = $2',
        [userId, id]
      )

      if (existing.rows.length > 0) {
        await app.db.query('DELETE FROM comment_likes WHERE user_id = $1 AND comment_id = $2', [userId, id])
        await app.db.query('UPDATE comments SET like_count = like_count - 1 WHERE id = $1', [id])
        return reply.send({ success: true, action: 'unliked' })
      }

      await app.db.query('INSERT INTO comment_likes (user_id, comment_id) VALUES ($1, $2)', [userId, id])
      await app.db.query('UPDATE comments SET like_count = like_count + 1 WHERE id = $1', [id])

      return reply.send({ success: true, action: 'liked' })

    } catch (err) {
      app.log.error(err)
      return reply.status(500).send({ success: false, message: 'خطای سرور' })
    }
  })

}

export default commentsRoutes