async function purchaseRoutes(app) {
  app.get('/mine', {
    preHandler: [app.authenticate]
  }, async (request, reply) => {
    const userId = request.user.id
    const { status, page = 1, limit = 20 } = request.query
    const offset = (Number(page) - 1) * Number(limit)

    try {
      const params = [userId]
      let where = 'WHERE user_id = $1'

      if (status) {
        params.push(status)
        where += ` AND status = $${params.length}`
      }

      params.push(Number(limit), offset)

      const result = await app.db.query(`
        SELECT *,
          COUNT(*) OVER() as total_count
        FROM purchase_reports
        ${where}
        ORDER BY created_at DESC
        LIMIT $${params.length - 1} OFFSET $${params.length}
      `, params)

      return reply.send({
        success: true,
        data: result.rows,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total: Number(result.rows[0]?.total_count || 0),
          pages: Math.ceil(Number(result.rows[0]?.total_count || 0) / Number(limit))
        }
      })
    } catch (err) {
      app.log.error(err)
      return reply.status(500).send({ success: false, message: 'خطای سرور' })
    }
  })

  app.post('/', {
    preHandler: [app.authenticate]
  }, async (request, reply) => {
    const userId = request.user.id
    const { title, amount, receipt_url, description } = request.body

    if (!title || title.trim().length < 2) {
      return reply.status(400).send({ success: false, message: 'عنوان گزارش خرید را وارد کنید' })
    }

    if (!receipt_url || typeof receipt_url !== 'string') {
      return reply.status(400).send({ success: false, message: 'تصویر رسید خرید الزامی است' })
    }

    const numericAmount = amount === '' || amount === undefined || amount === null
      ? null
      : Number(amount)

    if (numericAmount !== null && (!Number.isFinite(numericAmount) || numericAmount < 0)) {
      return reply.status(400).send({ success: false, message: 'مبلغ خرید نامعتبر است' })
    }

    try {
      const result = await app.db.query(`
        INSERT INTO purchase_reports (user_id, title, amount, receipt_url, description)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `, [
        userId,
        title.trim(),
        numericAmount,
        receipt_url,
        description?.trim() || ''
      ])

      return reply.status(201).send({
        success: true,
        message: 'گزارش خرید ثبت شد و در انتظار تأیید مدیر است',
        data: result.rows[0]
      })
    } catch (err) {
      app.log.error(err)
      return reply.status(500).send({ success: false, message: 'خطای سرور' })
    }
  })

  app.delete('/:id', {
    preHandler: [app.authenticate]
  }, async (request, reply) => {
    const { id } = request.params
    const userId = request.user.id

    try {
      const check = await app.db.query(
        'SELECT status FROM purchase_reports WHERE id = $1 AND user_id = $2',
        [id, userId]
      )

      if (check.rows.length === 0) {
        return reply.status(404).send({ success: false, message: 'گزارش خرید پیدا نشد' })
      }

      if (check.rows[0].status === 'approved') {
        return reply.status(400).send({ success: false, message: 'گزارش تأیید شده قابل حذف نیست' })
      }

      await app.db.query('DELETE FROM purchase_reports WHERE id = $1 AND user_id = $2', [id, userId])

      return reply.send({ success: true, message: 'گزارش خرید حذف شد' })
    } catch (err) {
      app.log.error(err)
      return reply.status(500).send({ success: false, message: 'خطای سرور' })
    }
  })
}

export default purchaseRoutes
