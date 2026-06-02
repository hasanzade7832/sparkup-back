import { createWriteStream, mkdirSync, existsSync } from 'fs'
import { join, extname } from 'path'
import { randomUUID } from 'crypto'
import mime from 'mime-types'

async function mediaRoutes(app) {

  // ساخت پوشه uploads اگه نبود
  const uploadDir = process.env.UPLOAD_DIR || 'uploads'
  if (!existsSync(uploadDir)) {
    mkdirSync(uploadDir, { recursive: true })
    mkdirSync(join(uploadDir, 'images'), { recursive: true })
    mkdirSync(join(uploadDir, 'videos'), { recursive: true })
    mkdirSync(join(uploadDir, 'podcasts'), { recursive: true })
  }

  // POST /api/media/upload
  app.post('/upload', {
    preHandler: [app.authenticate],
    config: {
      rateLimit: {
        max: 20,
        timeWindow: '1 minute'
      }
    }
  }, async (request, reply) => {
    try {
      const data = await request.file()

      if (!data) {
        return reply.status(400).send({
          success: false,
          message: 'فایلی ارسال نشده'
        })
      }

      const mimeType = data.mimetype
      const maxSize = Number(process.env.MAX_FILE_SIZE) || 10485760

      // تعیین نوع فایل
      let folder = ''
      if (mimeType.startsWith('image/')) {
        folder = 'images'
      } else if (mimeType.startsWith('video/')) {
        folder = 'videos'
      } else if (mimeType.startsWith('audio/')) {
        folder = 'podcasts'
      } else {
        return reply.status(400).send({
          success: false,
          message: 'فرمت فایل پشتیبانی نمیشه — فقط تصویر، ویدیو، یا صدا'
        })
      }

      const ext = extname(data.filename) || '.' + mime.extension(mimeType)
      const fileName = `${randomUUID()}${ext}`
      const filePath = join(uploadDir, folder, fileName)
      const fileUrl = `/uploads/${folder}/${fileName}`

      // ذخیره فایل
      let fileSize = 0
      const writeStream = createWriteStream(filePath)

      for await (const chunk of data.file) {
        fileSize += chunk.length
        if (fileSize > maxSize) {
          writeStream.destroy()
          return reply.status(400).send({
            success: false,
            message: `حجم فایل نباید بیشتر از ${maxSize / 1024 / 1024}MB باشه`
          })
        }
        writeStream.write(chunk)
      }

      writeStream.end()

      return reply.status(201).send({
        success: true,
        message: 'فایل با موفقیت آپلود شد',
        data: {
          url: fileUrl,
          name: fileName,
          type: folder,
          size: fileSize,
          mimeType
        }
      })

    } catch (err) {
      app.log.error(err)
      return reply.status(500).send({
        success: false,
        message: 'خطای سرور در آپلود فایل'
      })
    }
  })

  // DELETE /api/media/:filename
  app.delete('/:folder/:filename', {
    preHandler: [app.authenticate]
  }, async (request, reply) => {
    const { folder, filename } = request.params

    try {
      const { unlink } = await import('fs/promises')
      const filePath = join(uploadDir, folder, filename)
      await unlink(filePath)

      return reply.send({
        success: true,
        message: 'فایل حذف شد'
      })

    } catch (err) {
      return reply.status(404).send({
        success: false,
        message: 'فایل یافت نشد'
      })
    }
  })

}

export default mediaRoutes