/**
 * scratchpad/t418/sim-multicuenta.ts — comprueba, con navegador real, lo que pidió Manuel:
 *
 *   1. dos cuentas FREE en el mismo dispositivo COMPARTEN el cupo del día
 *      (si la primera hizo 15, a la segunda le quedan 10, no 25 ni 0);
 *   2. al entrar con la segunda, sale el aviso de «una cuenta por persona y dispositivo»
 *      con su botón Aceptar;
 *   3. y un PREMIUM en ese mismo aparato NO queda limitado NI recibe el aviso
 *      («ojo, no bloquear a ningún premium, muchas veces tienen cuentas free y premium»).
 *
 * El punto 3 es el que de verdad hay que vigilar: es un cliente que paga.
 *
 * Uso: npx tsx --env-file=.env.local scratchpad/t418/sim-multicuenta.ts [--url=…]
 */
import { config } from 'dotenv'
config({ path: '.env.local' })

const URL_BASE = process.argv.find((a) => a.startsWith('--url='))?.split('=')[1] || 'http://localhost:3001'
const RUTA = '/auxiliar-administrativo-estado/test/tema/1/test-personalizado'
const DEVICE = 'sim-t418-device-compartido'
const USADAS_POR_A = 15

const AVISO = /Una cuenta por persona y dispositivo/i

async function main() {
  const secret = process.env.AUTH_SECRET
  if (!secret) { console.error('❌ Falta AUTH_SECRET'); process.exit(1) }

  const { chromium } = await import('playwright')
  const { sessionCookieNameFor, mintOwnAuthCookie } = await import('../../lib/sim/session')
  const { Client } = await import('pg')
  const { pgConfig } = await import('../../lib/db/pgSsl.cjs' as any)

  const db = new Client(pgConfig(process.env.DATABASE_URL))
  await db.connect()
  const ids: string[] = []

  const crear = async (email: string, plan: string) => {
    const { rows: [u] } = await db.query(
      `INSERT INTO user_profiles (id, email, full_name, plan_type, target_oposicion,
                                  age, gender, ciudad, onboarding_completed_at)
       VALUES (gen_random_uuid(), $1, 'Sim T418', $2, 'auxiliar_administrativo_estado',
               30, 'female', 'Madrid', NOW())
       ON CONFLICT (email) DO UPDATE SET plan_type = $2,
               target_oposicion='auxiliar_administrativo_estado', age=30, gender='female',
               ciudad='Madrid', onboarding_completed_at=NOW()
       RETURNING id`, [email, plan])
    ids.push(u.id)
    // Mismo aparato para las tres cuentas: es la situación que se quiere probar.
    await db.query(
      `INSERT INTO user_devices (user_id, device_id, device_label, first_seen_at, last_seen_at)
       VALUES ($1, $2, 'Sim', NOW(), NOW()) ON CONFLICT DO NOTHING`, [u.id, DEVICE])
    return u.id as string
  }

  try {
    const A = await crear('sim-t418-a@vence.es', 'free')
    const B = await crear('sim-t418-b@vence.es', 'free')
    const P = await crear('sim-t418-premium@vence.es', 'premium')

    const { rows: [d] } = await db.query(`SELECT (NOW() AT TIME ZONE 'Europe/Madrid')::date AS d`)
    await db.query(
      `INSERT INTO daily_question_usage (user_id, usage_date, questions_answered, last_question_at, updated_at)
       VALUES ($1,$2,$3,NOW(),NOW())
       ON CONFLICT (user_id, usage_date) DO UPDATE SET questions_answered=$3`,
      [A, d.d, USADAS_POR_A])
    console.log(`🧪 cuenta A (free) ha usado ${USADAS_POR_A} hoy en el dispositivo ${DEVICE}`)

    const host = new URL(URL_BASE).hostname
    const browser = await chromium.launch()

    const mirar = async (userId: string, email: string, etiqueta: string) => {
      const ctx = await browser.newContext({ viewport: { width: 1280, height: 1200 } })
      const valor = await mintOwnAuthCookie({ userId, email }, secret,
        { nowSec: Math.floor(Date.now() / 1000), host })
      await ctx.addCookies([{ name: sessionCookieNameFor(host), value: valor, domain: host, path: '/' }])
      const page = await ctx.newPage()
      // El device_id lo lee el cliente de localStorage y lo manda como X-Device-Id.
      await page.addInitScript((dev) => {
        try { window.localStorage.setItem('vence_device_id', dev as string) } catch {}
      }, DEVICE)

      let estado: any = null
      page.on('response', async (r) => {
        if (!r.url().includes('/api/v2/daily-question/status')) return
        try { estado = (await r.json())?.status } catch {}
      })

      await page.goto(URL_BASE + RUTA, { waitUntil: 'domcontentloaded', timeout: 60000 })
      await page.waitForTimeout(9000)
      const texto = (await page.locator('body').innerText().catch(() => '')) || ''
      const conAviso = AVISO.test(texto)
      await page.screenshot({ path: `scratchpad/t418/multicuenta-${etiqueta}.png` }).catch(() => {})
      await ctx.close()
      return { estado, conAviso }
    }

    console.log('\n🅰️  entrando con la cuenta A (la que ya gastó 15)…')
    const rA = await mirar(A, 'sim-t418-a@vence.es', 'A')
    console.log(`   questions_today=${rA.estado?.questions_today} · aviso=${rA.conAviso}`)

    console.log('\n🅱️  entrando con la cuenta B (segunda free en el MISMO aparato)…')
    const rB = await mirar(B, 'sim-t418-b@vence.es', 'B')
    console.log(`   questions_today=${rB.estado?.questions_today} · aviso=${rB.conAviso} · cuentas=${rB.estado?.cuentas_en_dispositivo}`)

    console.log('\n👑 entrando con la cuenta PREMIUM del mismo aparato…')
    const rP = await mirar(P, 'sim-t418-premium@vence.es', 'premium')
    console.log(`   questions_today=${rP.estado?.questions_today} · is_premium=${rP.estado?.is_premium} · aviso=${rP.conAviso}`)

    await browser.close()

    console.log('\n──────── VEREDICTO ────────')
    const comp = [
      ['B comparte cupo (ve las 15 del aparato, le quedan 10)', Number(rB.estado?.questions_today) === USADAS_POR_A],
      ['B recibe el aviso de una cuenta por persona y dispositivo', rB.conAviso === true],
      ['PREMIUM no queda limitado (su conteo no arrastra el del aparato)', Number(rP.estado?.questions_today ?? 0) === 0],
      ['PREMIUM no recibe el aviso', rP.conAviso === false],
    ] as const
    for (const [q, ok] of comp) console.log(`${ok ? '✅' : '❌'} ${q}`)
    console.log(comp.every(([, ok]) => ok) ? '\n✅ TODO CORRECTO' : '\n❌ HAY ALGO MAL — mirar arriba')
  } finally {
    for (const id of ids) {
      for (const t of ['daily_question_usage', 'user_devices', 'user_streaks', 'test_questions',
                       'test_sessions', 'daily_questions_served', 'user_question_favorites']) {
        await db.query(`DELETE FROM ${t} WHERE user_id=$1`, [id]).catch(() => {})
      }
      await db.query('DELETE FROM user_profiles WHERE id=$1', [id]).catch(() => {})
    }
    console.log('\n🧹 usuarios efímeros borrados')
    await db.end()
  }
}
main().catch((e) => { console.error('💥', e); process.exit(1) })
