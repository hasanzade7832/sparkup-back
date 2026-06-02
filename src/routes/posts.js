import { createPostSchema, updatePostSchema, getPostsSchema } from '../schemas/post.schema.js'

async function postsRoutes(app) {

  // GET /api/posts
  app.get('/', { schema: getPostsSchema }, async (request, reply) => {
    const { type, page = 1, limit = 12 } = request.query
    const offset = (page - 1) * limit

    try {
      let query = `
        SELECT p.*, u.name as author_name,
        COUNT(*) OVER() as total_count
        FROM posts p
        LEFT JOIN users u ON p.user_id = u.id
        WHERE p.is_published = true
      `
      const params = []

      if (type) {
        params.push(type)
        query += ` AND p.type = $${params.length}`
      }

      params.push(limit)
      params.push(offset)
      query += ` ORDER BY p.created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`

      const result = await app.db.query(query, params)

      const total = result.rows[0]?.total_count || 0

      return reply.send({
        success: true,
        data: result.rows,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total: Number(total),
          pages: Math.ceil(total / limit)
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

  // GET /api/posts/featured
  app.get('/featured', async (request, reply) => {
    try {
      const result = await app.db.query(`
        SELECT p.*, u.name as author_name
        FROM posts p
        LEFT JOIN users u ON p.user_id = u.id
        WHERE p.is_featured = true AND p.is_published = true
        ORDER BY p.created_at DESC
        LIMIT 5
      `)

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

  // GET /api/posts/:id
  app.get('/:id', async (request, reply) => {
    const { id } = request.params

    try {
      // افزایش view_count
      await app.db.query(
        'UPDATE posts SET view_count = view_count + 1 WHERE id = $1',
        [id]
      )

      const result = await app.db.query(`
        SELECT p.*, u.name as author_name
        FROM posts p
        LEFT JOIN users u ON p.user_id = u.id
        WHERE p.id = $1 AND p.is_published = true
      `, [id])

      if (result.rows.length === 0) {
        return reply.status(404).send({
          success: false,
          message: 'پست یافت نشد'
        })
      }

      return reply.send({
        success: true,
        data: result.rows[0]
      })

    } catch (err) {
      app.log.error(err)
      return reply.status(500).send({
        success: false,
        message: 'خطای سرور'
      })
    }
  })

  // POST /api/posts
  app.post('/', {
    schema: createPostSchema,
    preHandler: [app.authenticate]
  }, async (request, reply) => {
    const { title, content, type, thumbnail, media_url, is_featured } = request.body

    try {
      const result = await app.db.query(`
        INSERT INTO posts (title, content, type, thumbnail, media_url, is_featured, user_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
      `, [title, content, type, thumbnail, media_url, is_featured || false, request.user.id])

      return reply.status(201).send({
        success: true,
        message: 'پست با موفقیت ساخته شد',
        data: result.rows[0]
      })

    } catch (err) {
      app.log.error(err)
      return reply.status(500).send({
        success: false,
        message: 'خطای سرور'
      })
    }
  })

  // PUT /api/posts/:id
  app.put('/:id', {
    schema: updatePostSchema,
    preHandler: [app.authenticate]
  }, async (request, reply) => {
    const { id } = request.params
    const { title, content, type, thumbnail, media_url, is_featured } = request.body

    try {
      // چک کن پست متعلق به این کاربر باشه
      const check = await app.db.query(
        'SELECT id FROM posts WHERE id = $1 AND user_id = $2',
        [id, request.user.id]
      )

      if (check.rows.length === 0) {
        return reply.status(403).send({
          success: false,
          message: 'دسترسی ندارید'
        })
      }

      const result = await app.db.query(`
        UPDATE posts
        SET title = COALESCE($1, title),
            content = COALESCE($2, content),
            type = COALESCE($3, type),
            thumbnail = COALESCE($4, thumbnail),
            media_url = COALESCE($5, media_url),
            is_featured = COALESCE($6, is_featured),
            updated_at = NOW()
        WHERE id = $7
        RETURNING *
      `, [title, content, type, thumbnail, media_url, is_featured, id])

      return reply.send({
        success: true,
        message: 'پست بروزرسانی شد',
        data: result.rows[0]
      })

    } catch (err) {
      app.log.error(err)
      return reply.status(500).send({
        success: false,
        message: 'خطای سرور'
      })
    }
  })

  // DELETE /api/posts/:id
  app.delete('/:id', {
    preHandler: [app.authenticate]
  }, async (request, reply) => {
    const { id } = request.params

    try {
      const check = await app.db.query(
        'SELECT id FROM posts WHERE id = $1 AND user_id = $2',
        [id, request.user.id]
      )

      if (check.rows.length === 0) {
        return reply.status(403).send({
          success: false,
          message: 'دسترسی ندارید'
        })
      }

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

  // POST /api/posts/:id/like
  app.post('/:id/like', {
    preHandler: [app.authenticate]
  }, async (request, reply) => {
    const { id } = request.params

    try {
      await app.db.query(
        'UPDATE posts SET like_count = like_count + 1 WHERE id = $1',
        [id]
      )

      return reply.send({
        success: true,
        message: 'لایک ثبت شد'
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

export default postsRoutes