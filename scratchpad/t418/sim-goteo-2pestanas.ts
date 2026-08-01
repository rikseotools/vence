/**
 * scratchpad/t418/sim-goteo-2pestanas.ts — segundo intento de reproducir el goteo de [T-418].
 *
 * POR QUÉ ESTE: la reproducción de una sola pestaña (`sim-goteo.ts`) NO reproduce el goteo —
 * el muro de cuenta funciona, incluso retrasando el guardado 5 s y cerrando el modal. Y los
 * datos descartan el reintento de la cola (634 de 1.185 rechazos ocurren a <30 s de la última
 * respuesta guardada, y 465 de 468 con el usuario activo alrededor): es EN VIVO.
 *
 * HIPÓTESIS QUE PRUEBA: el muro lo levanta un contador que vive EN LA PESTAÑA
 * (`useDailyQuestionLimit`, optimista + reconciliación). Con dos pestañas abiertas —lo normal
 * estudiando— cada una cree tener cupo por su cuenta. La pestaña A gasta la última pregunta;
 * la B no se entera y deja contestar; el servidor rechaza. Encaja con lo medido: contador al
 * tope, 1 sola respuesta perdida, en vivo.
 *
 * Uso: npx tsx --env-file=.env.local scratchpad/t418/sim-goteo-2pestanas.ts [--url=…]
 */
import { config } from 'dotenv'
config({ path: '.env.local' })

const URL_BASE = process.argv.find((a) => a.startsWith('--url='))?.split('=')[1] || 'http://localhost:3001'
const EMAIL = 'sim-goteo2-t418@vence.es'
const RUTA = '/auxiliar-administrativo-estado/test/tema/1/test-personalizado'

const MURO = /Límite diario alcanzado|Has alcanzado tu límite diario|Has completado tus|Limite alcanzado|Has llegado al limite/

async function main() {
  const secret = process.env.AUTH_SECRET
  if (!secret) { console.error('❌ Falta AUTH_SECRET'); process.exit(1) }

  const { chromium } = await import('playwright')
  const { sessionCookieNameFor, mintOwnAuthCookie } = await import('../../lib/sim/session')
  const { Client } = await import('pg')
  const { pgConfig } = await import('../../lib/db/pgSsl.cjs' as any)

  const db = new Client(pgConfig(process.env.DATABASE_URL))
  await db.connect()
  let userId: string | null = null

  try {
    const { rows: [u] } = await db.query(
      `INSERT INTO user_profiles (id, email, full_name, plan_type, target_oposicion,
                                  age, gender, ciudad, onboarding_completed_at)
       VALUES (gen_random_uuid(), $1, 'Sim Goteo2 T418', 'free', 'auxiliar_administrativo_estado',
               30, 'female', 'Madrid', NOW())
       ON CONFLICT (email) DO UPDATE SET full_name='Sim Goteo2 T418',
               target_oposicion='auxiliar_administrativo_estado', age=30, gender='female',
               ciudad='Madrid', onboarding_completed_at=NOW()
       RETURNING id`, [EMAIL])
    userId = u.id

    const { rows: [lim] } = await db.query(
      `SELECT questions_remaining + questions_today AS limite FROM get_daily_question_status($1::uuid)`, [userId])
    const LIMITE = Number(lim?.limite) || 25
    const { rows: [d] } = await db.query(`SELECT (NOW() AT TIME ZONE 'Europe/Madrid')::date AS d`)
    await db.query(
      `INSERT INTO daily_question_usage (user_id, usage_date, questions_answered, last_question_at, updated_at)
       VALUES ($1,$2,$3,NOW(),NOW())
       ON CONFLICT (user_id, usage_date) DO UPDATE SET questions_answered=$3`, [userId, d.d, LIMITE - 1])
    console.log(`👤 ${userId}  ·  contador ${LIMITE - 1}/${LIMITE} — le queda UNA`)

    const host = new URL(URL_BASE).hostname
    const valor = await mintOwnAuthCookie({ userId: userId!, email: EMAIL }, secret,
      { nowSec: Math.floor(Date.now() / 1000), host })

    const browser = await chromium.launch()
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 1400 } })
    await ctx.addCookies([{ name: sessionCookieNameFor(host), value: valor, domain: host, path: '/' }])

    const capturas: Record<string, { status: number; cuerpo: string }[]> = { A: [], B: [] }
    const abrir = async (nombre: 'A' | 'B') => {
      const p = await ctx.newPage()
      p.on('response', async (r) => {
        if (!r.url().includes('/api/v2/answer-and-save')) return
        let cuerpo = ''; try { cuerpo = (await r.text()).slice(0, 120) } catch {}
        capturas[nombre].push({ status: r.status(), cuerpo })
      })
      await p.goto(URL_BASE + RUTA, { waitUntil: 'domcontentloaded', timeout: 60000 })
      await p.waitForTimeout(9000)
      for (const et of ['Aceptar todo', 'Completar después']) {
        const b = p.getByRole('button', { name: et, exact: false }).first()
        if (await b.count() > 0) { try { await b.click({ timeout: 2000 }) } catch {} }
      }
      await p.waitForTimeout(800)
      return p
    }

    // Las DOS pestañas se abren ANTES de gastar nada: las dos leen "queda 1".
    console.log('🗂️  abriendo pestaña A…'); const A = await abrir('A')
    console.log('🗂️  abriendo pestaña B…'); const B = await abrir('B')

    const opcion = (p: any) => p.locator('button').filter({ hasText: /^A\s*\n?.{6,}/ }).first()
    const muro = async (p: any) => MURO.test((await p.locator('body').innerText().catch(() => '')) || '')

    console.log(`\n🅰️  pestaña A contesta (gasta la última)…`)
    console.log(`    muro antes: ${await muro(A)}`)
    try { await opcion(A).click({ timeout: 6000 }) } catch (e: any) { console.log('    ⚠️', String(e.message).split('\n')[0]) }
    await A.waitForTimeout(6000)
    console.log(`    → A: ${JSON.stringify(capturas.A)}`)

    const { rows: [tras] } = await db.query(
      `SELECT questions_answered FROM daily_question_usage WHERE user_id=$1 AND usage_date=$2`, [userId, d.d])
    console.log(`    contador en BD tras A: ${tras?.questions_answered}/${LIMITE}`)

    console.log(`\n🅱️  pestaña B contesta (no se ha enterado)…`)
    const muroB = await muro(B)
    console.log(`    muro antes: ${muroB}`)
    let contestoB = false
    try { await opcion(B).click({ timeout: 6000 }); contestoB = true } catch (e: any) { console.log('    ⚠️', String(e.message).split('\n')[0]) }
    await B.waitForTimeout(7000)
    console.log(`    → B: ${JSON.stringify(capturas.B)}`)

    await B.screenshot({ path: 'scratchpad/t418/goteo-2pestanas.png' }).catch(() => {})
    await browser.close()

    console.log('\n──────── VEREDICTO ────────')
    const rech = capturas.B.find((r) => r.status === 403)
    if (contestoB && !muroB && rech) {
      console.log('✅ REPRODUCIDO. La pestaña B no enseñó ningún muro, le DEJÓ contestar,')
      console.log('   y el servidor rechazó el guardado con 403. La respuesta se pierde.')
      console.log(`   cuerpo: ${rech.cuerpo}`)
    } else if (muroB) {
      console.log('❌ no reproducido: la pestaña B ya mostraba el muro (se enteró sola).')
    } else if (!contestoB) {
      console.log('❌ no concluyente: no se pudo pulsar en B (arnés, no producto).')
    } else {
      console.log(`❌ no reproducido: B contestó sin muro pero el servidor no rechazó → ${JSON.stringify(capturas.B)}`)
    }
  } finally {
    if (userId) {
      for (const t of ['daily_question_usage', 'user_streaks', 'test_questions', 'test_sessions',
                       'daily_questions_served', 'user_question_favorites']) {
        await db.query(`DELETE FROM ${t} WHERE user_id=$1`, [userId]).catch(() => {})
      }
      await db.query('DELETE FROM user_profiles WHERE id=$1', [userId]).catch(() => {})
      console.log('\n🧹 usuario efímero borrado')
    }
    await db.end()
  }
}
main().catch((e) => { console.error('💥', e); process.exit(1) })
