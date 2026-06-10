async function scoresRoutes(app) {

  // GET /api/scores/leaderboard — لیدربورد
  app.get('/leaderboard', async (request, reply) => {
    try {
      const result = await app.db.query(`
        SELECT 
          u.id,
          u.name,
          u.avatar,
          us.total_score,
          us.streak_count,
          us.last_active_date,
          ROW_NUMBER() OVER (ORDER BY us.total_score DESC) as rank
        FROM user_scores us
        JOIN users u ON us.user_id = u.id
        WHERE us.total_score > 0
        ORDER BY us.total_score DESC
        LIMIT 50
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

  // GET /api/scores/me — امتیاز و رتبه کاربر
  app.get('/me', {
    preHandler: [app.authenticate]
  }, async (request, reply) => {
    const userId = request.user.id

    try {
      // امتیاز و استریک
      const scoreResult = await app.db.query(`
        SELECT us.*, 
        (
          SELECT COUNT(*) + 1 
          FROM user_scores 
          WHERE total_score > us.total_score
        ) as rank
        FROM user_scores us
        WHERE us.user_id = $1
      `, [userId])

      // تعداد کل کاربران
      const totalUsers = await app.db.query(
        'SELECT COUNT(*) as count FROM user_scores WHERE total_score > 0'
      )

      // اقدامات امروز
      const todayActions = await app.db.query(`
        SELECT category, COUNT(*) as count
        FROM daily_actions
        WHERE user_id = $1 AND action_date = CURRENT_DATE
        GROUP BY category
      `, [userId])

      return reply.send({
        success: true,
        data: {
          score: scoreResult.rows[0] || {
            total_score: 0,
            streak_count: 0,
            rank: null
          },
          total_users: Number(totalUsers.rows[0].count),
          today_actions: todayActions.rows
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

  // GET /api/scores/user/:userId — امتیاز یه کاربر خاص
  app.get('/user/:userId', async (request, reply) => {
    const { userId } = request.params

    try {
      const result = await app.db.query(`
        SELECT 
          u.id, u.name, u.avatar, u.created_at,
          us.total_score, us.streak_count, us.last_active_date,
          (
            SELECT COUNT(*) + 1
            FROM user_scores
            WHERE total_score > us.total_score
          ) as rank,
          (
            SELECT COUNT(*)
            FROM daily_actions
            WHERE user_id = u.id AND status != 'rejected'
          ) as total_actions
        FROM users u
        LEFT JOIN user_scores us ON u.id = us.user_id
        WHERE u.id = $1
      `, [userId])

      if (result.rows.length === 0) {
        return reply.status(404).send({
          success: false,
          message: 'کاربر یافت نشد'
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

  // POST /api/scores/reset — صفر کردن امتیاز کاربرانی که امروز فعال نبودن
  // این route توسط یه cron job روزانه صدا زده میشه
  app.post('/reset', async (request, reply) => {
    try {
      const result = await app.db.query(`
        UPDATE user_scores
        SET total_score = 0, streak_count = 0, updated_at = NOW()
        WHERE last_active_date < CURRENT_DATE
        RETURNING user_id
      `)

      return reply.send({
        success: true,
        message: `${result.rows.length} کاربر ریست شدن`,
        reset_count: result.rows.length
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

export default scoresRoutes