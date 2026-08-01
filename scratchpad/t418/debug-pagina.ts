import { config } from 'dotenv'
config({ path: '.env.local' })

const URL_BASE = 'http://localhost:3001'
const EMAIL = 'sim-goteo-t418@vence.es'
const RUTA = process.argv[2] || '/auxiliar-administrativo-estado/test/aleatorio'

async function main() {
  const { chromium } = await import('playwright')
  const { sessionCookieNameFor, mintOwnAuthCookie } = await import('../../lib/sim/session')
  const { Client } = await import('pg')
  const { pgConfig } = await import('../../lib/db/pgSsl.cjs' as any)

  const db = new Client(pgConfig(process.env.DATABASE_URL))
  await db.connect()
  const { rows: [u] } = await db.query(
    `INSERT INTO user_profiles (id, email, full_name, plan_type, target_oposicion)
     VALUES (gen_random_uuid(), $1, 'Sim Goteo T418', 'free', 'auxiliar_administrativo_estado')
     ON CONFLICT (email) DO UPDATE SET full_name='Sim Goteo T418', target_oposicion='auxiliar_administrativo_estado' RETURNING id`, [EMAIL])
  const userId = u.id

  const host = new URL(URL_BASE).hostname
  const valor = await mintOwnAuthCookie(
    { userId, email: EMAIL }, process.env.AUTH_SECRET!, { nowSec: Math.floor(Date.now()/1000), host })

  const browser = await chromium.launch()
  const ctx = await browser.newContext()
  await ctx.addCookies([{ name: sessionCookieNameFor(host), value: valor, domain: host, path: '/' }])
  const page = await ctx.newPage()
  page.on('console', m => { if (m.type()==='error') console.log('   [console.error]', m.text().slice(0,120)) })
  page.on('response', r => {
    const u = r.url()
    if (/\/api\/(v2\/)?(auth|daily-question|questions|answer)/.test(u)) console.log(`   [net] ${r.status()} ${u.replace(URL_BASE,'')}`)
  })

  console.log(`🌐 ${RUTA}`)
  await page.goto(URL_BASE + RUTA, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.waitForTimeout(9000)

  console.log('\n── URL final:', page.url())
  const texto = await page.locator('body').innerText().catch(()=>'(sin body)')
  console.log('── TEXTO (600 primeros):\n' + texto.slice(0, 600))
  const botones = await page.locator('button').allInnerTexts().catch(()=>[])
  console.log('\n── BOTONES:', JSON.stringify(botones.slice(0, 25)))
  await page.screenshot({ path: 'scratchpad/t418/debug.png', fullPage: false }).catch(()=>{})

  await browser.close()
  await db.query('DELETE FROM user_profiles WHERE id=$1', [userId])
  await db.end()
}
main().catch(e => { console.error('💥', e); process.exit(1) })
