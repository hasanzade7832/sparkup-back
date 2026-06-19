import { readFile } from 'fs/promises'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'
import pg from 'pg'
import bcrypt from 'bcrypt'

dotenv.config()

const { Client } = pg
const __dirname = dirname(fileURLToPath(import.meta.url))
const projectRoot = join(__dirname, '..')
const schemaPath = join(projectRoot, 'src', 'db', 'schema.sql')

const databaseUrl = process.env.DATABASE_URL

if (!databaseUrl) {
  console.error('DATABASE_URL is missing in .env')
  process.exit(1)
}

const quoteIdentifier = (value) => `"${String(value).replace(/"/g, '""')}"`

const getDatabaseName = () => {
  const url = new URL(databaseUrl)
  const name = decodeURIComponent(url.pathname.replace(/^\//, ''))
  if (!name) {
    throw new Error('DATABASE_URL must include a database name')
  }
  return name
}

const getMaintenanceUrl = () => {
  const url = new URL(databaseUrl)
  url.pathname = '/postgres'
  return url.toString()
}

async function withClient(connectionString, fn) {
  const client = new Client({ connectionString })
  await client.connect()
  try {
    return await fn(client)
  } finally {
    await client.end()
  }
}

async function ensureDatabase() {
  const dbName = getDatabaseName()
  await withClient(getMaintenanceUrl(), async (client) => {
    const existing = await client.query(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      [dbName]
    )

    if (existing.rowCount === 0) {
      await client.query(`CREATE DATABASE ${quoteIdentifier(dbName)}`)
      console.log(`created database ${dbName}`)
    } else {
      console.log(`database ${dbName} already exists`)
    }
  })
}

async function runSchema() {
  const schema = await readFile(schemaPath, 'utf8')
  await withClient(databaseUrl, async (client) => {
    await client.query(schema)
    console.log('schema is ready')
  })
}

async function upsertUser(client, { name, username, role }) {
  const password = await bcrypt.hash('dev123456', 10)

  const result = await client.query(
    `INSERT INTO users (name, username, password, role)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (username) DO UPDATE
     SET name = EXCLUDED.name,
         role = EXCLUDED.role,
         updated_at = NOW()
     RETURNING id`,
    [name, username, password, role]
  )

  return result.rows[0].id
}

async function seedData() {
  await withClient(databaseUrl, async (client) => {
    const superAdminId = await upsertUser(client, {
      name: 'مدیر اسپارک',
      username: 'admin',
      role: 'superadmin',
    })
    const userId = await upsertUser(client, {
      name: 'سپهر نمونه',
      username: 'sepehr',
      role: 'user',
    })
    const mentorId = await upsertUser(client, {
      name: 'سارا مربی',
      username: 'sara',
      role: 'admin',
    })

    await client.query(
      `INSERT INTO user_scores (user_id, total_score, streak_count, last_active_date)
       VALUES
         ($1, 16, 5, (NOW() AT TIME ZONE 'Asia/Tehran')::date),
         ($2, 9, 3, (NOW() AT TIME ZONE 'Asia/Tehran')::date),
         ($3, 22, 7, (NOW() AT TIME ZONE 'Asia/Tehran')::date)
       ON CONFLICT (user_id) DO UPDATE
       SET total_score = EXCLUDED.total_score,
           streak_count = EXCLUDED.streak_count,
           last_active_date = EXCLUDED.last_active_date,
           updated_at = NOW()`,
      [superAdminId, userId, mentorId]
    )

    const postCount = await client.query('SELECT COUNT(*)::int AS count FROM posts')

    if (postCount.rows[0].count === 0) {
      const posts = [
        {
          userId: superAdminId,
          title: 'صبح را با یک تصمیم روشن شروع کن، نه با تردید',
          content: 'امروز فقط یک حرکت کوچک لازم داری. همان یک تماس، همان یک پیام، همان یک قدمی که دیروز عقب انداختی می‌تواند ریتم روزت را عوض کند.',
          type: 'text',
          featured: true,
          views: 1280,
          likes: 93,
        },
        {
          userId,
          title: 'سه دقیقه تمرکز برای برگشتن به مسیر',
          content: 'قبل از شروع کار بعدی، نفس عمیق بکش و یک هدف کوتاه بنویس. تمرکز از همین لحظه‌های کوچک ساخته می‌شود.',
          type: 'video',
          featured: false,
          views: 842,
          likes: 51,
        },
        {
          userId: mentorId,
          title: 'فروش خوب از اعتماد شروع می‌شود',
          content: 'به جای فشار آوردن، اول دقیق گوش بده. وقتی نیاز واقعی طرف مقابل را بفهمی، پیشنهادت طبیعی‌تر و اثرگذارتر می‌شود.',
          type: 'image',
          featured: true,
          views: 1534,
          likes: 117,
        },
        {
          userId: mentorId,
          title: 'پادکست کوتاه: ساختن عادت پیگیری',
          content: 'پیگیری یعنی احترام گذاشتن به گفت‌وگوی قبلی. یک یادآوری ساده می‌تواند یک رابطه کاری را زنده نگه دارد.',
          type: 'podcast',
          featured: false,
          views: 621,
          likes: 44,
        },
      ]

      const insertedPosts = []
      for (const post of posts) {
        const result = await client.query(
          `INSERT INTO posts
             (user_id, title, content, type, is_featured, view_count, like_count)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           RETURNING id`,
          [
            post.userId,
            post.title,
            post.content,
            post.type,
            post.featured,
            post.views,
            post.likes,
          ]
        )
        insertedPosts.push(result.rows[0].id)
      }

      await client.query(
        `INSERT INTO comments (user_id, post_id, content)
         VALUES
           ($1, $3, 'این دقیقاً همون چیزی بود که امروز لازم داشتم.'),
           ($2, $3, 'عالی بود، مخصوصاً بخش قدم کوچک.')
         ON CONFLICT DO NOTHING`,
        [userId, mentorId, insertedPosts[0]]
      )

      await client.query(
        `INSERT INTO saved_posts (user_id, post_id)
         VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [userId, insertedPosts[0]]
      )
    }

    const actionCount = await client.query('SELECT COUNT(*)::int AS count FROM daily_actions')

    if (actionCount.rows[0].count === 0) {
      await client.query(
        `INSERT INTO daily_actions (user_id, category, description, status, action_date)
         VALUES
           ($1, 'communication', 'پیگیری سه گفت‌وگوی قبلی و ارسال پیام کوتاه', 'approved', (NOW() AT TIME ZONE 'Asia/Tehran')::date),
           ($1, 'education', 'مطالعه یک فصل درباره عادت‌های فروش', 'pending', (NOW() AT TIME ZONE 'Asia/Tehran')::date),
           ($2, 'sales', 'معرفی محصول به دو مشتری جدید', 'approved', (NOW() AT TIME ZONE 'Asia/Tehran')::date),
           ($3, 'invitation', 'دعوت از دو نفر برای جلسه معرفی', 'pending', (NOW() AT TIME ZONE 'Asia/Tehran')::date)`,
        [userId, mentorId, superAdminId]
      )
    }

    console.log('seed data is ready')
    console.log('dev login: admin / dev123456')
  })
}

async function main() {
  await ensureDatabase()
  await runSchema()
  await seedData()
}

main().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
