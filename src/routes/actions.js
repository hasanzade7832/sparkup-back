async function actionsRoutes(app) {

  // POST /api/actions — ثبت اقدام جدید
  app.post('/', {
    preHandler: [app.authenticate]
  }, async (request, reply) => {
    const { category, description } = request.body
    const userId = request.user.id

    const validCategories = ['communication', 'education', 'sales', 'invitation']
    if (!validCategories.includes(category)) {
      return reply.status(400).send({
        success: false,
        message: 'دسته‌بندی نامعتبر است'
      })
    }

    if (!description || description.trim() === '') {
      return reply.status(400).send({
        success: false,
        message: 'توضیحات الزامی است'
      })
    }

    try {
      const result = await app.db.query(`
        INSERT INTO daily_actions (user_id, category, description, action_date)
        VALUES ($1, $2, $3, (NOW() AT TIME ZONE 'Asia/Tehran')::date)
        RETURNING *
      `, [userId, category, description.trim()])

      await app.db.query(`
        INSERT INTO user_scores (user_id, total_score, last_active_date)
        VALUES ($1, 1, (NOW() AT TIME ZONE 'Asia/Tehran')::date)
        ON CONFLICT (user_id) DO UPDATE
        SET
          total_score = user_scores.total_score + 1,
          last_active_date = (NOW() AT TIME ZONE 'Asia/Tehran')::date,
          updated_at = NOW()
      `, [userId])

      await updateStreak(app, userId)

      return reply.status(201).send({
        success: true,
        message: 'اقدام با موفقیت ثبت شد +۱ امتیاز',
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

  // GET /api/actions/week — اقدامات هفته جاری
  app.get('/week', {
    preHandler: [app.authenticate]
  }, async (request, reply) => {
    const userId = request.user.id

    try {
      const result = await app.db.query(`
        SELECT DISTINCT TO_CHAR(action_date, 'YYYY-MM-DD') as action_date
        FROM daily_actions
        WHERE user_id = $1
          AND action_date >= (NOW() AT TIME ZONE 'Asia/Tehran')::date - INTERVAL '6 days'
          AND action_date <= (NOW() AT TIME ZONE 'Asia/Tehran')::date
        ORDER BY action_date ASC
      `, [userId])

      return reply.send({
        success: true,
        data: result.rows.map(r => r.action_date)
      })

    } catch (err) {
      app.log.error(err)
      return reply.status(500).send({ success: false, message: 'خطای سرور' })
    }
  })

  // GET /api/actions/today — اقدامات امروز کاربر
  app.get('/today', {
    preHandler: [app.authenticate]
  }, async (request, reply) => {
    const userId = request.user.id

    try {
      const result = await app.db.query(`
        SELECT * FROM daily_actions
        WHERE user_id = $1
          AND action_date = (NOW() AT TIME ZONE 'Asia/Tehran')::date
        ORDER BY created_at DESC
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

  // GET /api/actions/history — تاریخچه اقدامات کاربر
  app.get('/history', {
    preHandler: [app.authenticate]
  }, async (request, reply) => {
    const userId = request.user.id
    const { page = 1, limit = 20 } = request.query
    const offset = (page - 1) * limit

    try {
      const result = await app.db.query(`
        SELECT *,
          TO_CHAR(action_date, 'YYYY-MM-DD') as action_date_str,
          COUNT(*) OVER() as total_count
        FROM daily_actions
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT $2 OFFSET $3
      `, [userId, limit, offset])

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

  // GET /api/actions/user/:userId — اقدامات یه کاربر خاص
  app.get('/user/:userId', async (request, reply) => {
    const { userId } = request.params
    const { page = 1, limit = 20 } = request.query
    const offset = (page - 1) * limit

    try {
      const result = await app.db.query(`
        SELECT da.*,
          TO_CHAR(da.action_date, 'YYYY-MM-DD') as action_date_str,
          u.name as user_name,
          COUNT(*) OVER() as total_count
        FROM daily_actions da
        JOIN users u ON da.user_id = u.id
        WHERE da.user_id = $1 AND da.status != 'rejected'
        ORDER BY da.created_at DESC
        LIMIT $2 OFFSET $3
      `, [userId, limit, offset])

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

  // DELETE /api/actions/:id — حذف اقدام توسط کاربر
  app.delete('/:id', {
    preHandler: [app.authenticate]
  }, async (request, reply) => {
    const { id } = request.params
    const userId = request.user.id

    try {
      const check = await app.db.query(
        'SELECT id, status FROM daily_actions WHERE id = $1 AND user_id = $2',
        [id, userId]
      )

      if (check.rows.length === 0) {
        return reply.status(403).send({
          success: false,
          message: 'دسترسی ندارید'
        })
      }

      await app.db.query('DELETE FROM daily_actions WHERE id = $1', [id])

      await app.db.query(`
        UPDATE user_scores
        SET total_score = GREATEST(0, total_score - 1), updated_at = NOW()
        WHERE user_id = $1
      `, [userId])

      return reply.send({
        success: true,
        message: 'اقدام حذف شد'
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

// تابع آپدیت استریک
async function updateStreak(app, userId) {
  try {
    const tehranDate = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Tehran' }))
    const today = `${tehranDate.getFullYear()}-${String(tehranDate.getMonth()+1).padStart(2,'0')}-${String(tehranDate.getDate()).padStart(2,'0')}`

    const result = await app.db.query(`
      SELECT
        TO_CHAR(last_active_date, 'YYYY-MM-DD') as last_active_date,
        streak_count
      FROM user_scores WHERE user_id = $1
    `, [userId])

    if (result.rows.length === 0) return

    const { last_active_date, streak_count } = result.rows[0]

    if (!last_active_date) return

    if (last_active_date === today) return

    const diffDays = Math.floor(
      (new Date(today) - new Date(last_active_date)) / (1000 * 60 * 60 * 24)
    )

    let newStreak = streak_count
    if (diffDays === 1) {
      newStreak = streak_count + 1
    } else if (diffDays > 1) {
      newStreak = 1
    }

    await app.db.query(
      `UPDATE user_scores
       SET streak_count = $1,
           last_active_date = (NOW() AT TIME ZONE 'Asia/Tehran')::date
       WHERE user_id = $2`,
      [newStreak, userId]
    )
  } catch (err) {
    console.error('streak error:', err)
  }
}

export default actionsRoutes