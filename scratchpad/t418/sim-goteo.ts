/**
 * scratchpad/t418/sim-goteo.ts — REPRODUCCIÓN del «goteo» de [T-418] con navegador real.
 *
 * QUÉ INTENTA REPRODUCIR
 * Un usuario free con el cupo casi agotado contesta y el servidor RECHAZA el guardado con
 * 403, sin que la UI se lo haya impedido antes. Medido en 14 días: 591 usuarios pierden
 * EXACTAMENTE 1 respuesta cada uno, siempre la del muro.
 *
 * POR QUÉ CON NAVEGADOR Y NO CON `fetch`
 * La pregunta no es «¿el servidor devuelve 403?» (eso se sabe leyendo el código), sino
 * «¿le dejó la UI contestar antes de rechazarle?». Eso solo se ve ejecutando el cliente
 * real: el muro vive en `TestLayout.handleAnswerClick` y depende de un contador optimista.
 *
 * CÓMO
 *  1. usuario free EFÍMERO (se borra al final, pase lo que pase);
 *  2. su contador diario sembrado en LIMITE-1, con el día en Europe/Madrid (que es como lo
 *     escribe `increment_daily_questions`, no en UTC — ver la trampa anotada en la ficha);
 *  3. cookie de sesión forjada con `lib/sim/session.ts` (misma que usan las otras sims);
 *  4. se contestan varias preguntas seguidas y se registra CADA respuesta de
 *     `/api/v2/answer-and-save` junto con lo que la pantalla mostraba en ese momento.
 *
 * VEREDICTO: se reproduce si alguna respuesta recibe 403 **habiendo podido contestarla**
 * (la UI no bloqueó). Si la UI bloquea antes del 403, NO se reproduce y la causa que la
 * ficha da por probable es falsa.
 *
 * Uso:  npx tsx --env-file=.env.local scratchpad/t418/sim-goteo.ts [--url http://localhost:3001]
 */
import { config } from 'dotenv'
config({ path: '.env.local' })

const URL_BASE = process.argv.find((a) => a.startsWith('--url='))?.split('=')[1] || 'http://localhost:3001'
const EMAIL = 'sim-goteo-t418@vence.es'
const RUTA_TEST = '/auxiliar-administrativo-estado/test/tema/1/test-personalizado'
const A_CONTESTAR = 4
// Latencia añadida al guardado. La reconciliación del cliente ocurre a los 2.500 ms
// (`useDailyQuestionLimit.recordAnswer` → `setTimeout(fetchStatus, 2500)`), así que con el
// guardado más lento que eso el servidor todavía NO ha cobrado el cupo cuando el cliente
// vuelve a preguntarle. Es la ventana que se quiere provocar. 0 = sin latencia.
const LATENCIA_MS = Number(process.argv.find((a) => a.startsWith('--latencia='))?.split('=')[1] ?? 0)

interface Intento {
  n: number
  contestada: boolean
  status: number | null
  bloqueoUI: boolean
  cuerpo: string
}

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
  const intentos: Intento[] = []

  try {
    // ── 1. usuario free efímero ────────────────────────────────────────────────
    const { rows: [u] } = await db.query(
      // El onboarding (edad/género/ciudad) se sirve como modal a pantalla completa que
       // INTERCEPTA los clics del test. Se rellena aquí para que no aparezca: si no, la sim
       // registra "no pudo pulsar" y eso se confunde con un bloqueo por límite.
       `INSERT INTO user_profiles (id, email, full_name, plan_type, target_oposicion,
                                   age, gender, ciudad, onboarding_completed_at)
       VALUES (gen_random_uuid(), $1, 'Sim Goteo T418', 'free', 'auxiliar_administrativo_estado',
               30, 'female', 'Madrid', NOW())
       ON CONFLICT (email) DO UPDATE SET full_name = 'Sim Goteo T418',
               target_oposicion = 'auxiliar_administrativo_estado', age = 30,
               gender = 'female', ciudad = 'Madrid', onboarding_completed_at = NOW()
       RETURNING id`, [EMAIL])
    userId = u.id
    console.log(`👤 usuario free efímero: ${userId}`)

    // ── 2. contador sembrado justo por debajo del tope ────────────────────────
    // El límite puede estar graduado; se pregunta al mismo sitio que el servidor.
    const { rows: [lim] } = await db.query(
      `SELECT questions_remaining + questions_today AS limite
         FROM get_daily_question_status($1::uuid)`, [userId])
    const LIMITE = Number(lim?.limite) || 25
    const { rows: [dia] } = await db.query(
      `SELECT (NOW() AT TIME ZONE 'Europe/Madrid')::date AS d`)
    await db.query(
      `INSERT INTO daily_question_usage (user_id, usage_date, questions_answered, last_question_at, updated_at)
       VALUES ($1, $2, $3, NOW(), NOW())
       ON CONFLICT (user_id, usage_date) DO UPDATE SET questions_answered = $3`,
      [userId, dia.d, LIMITE - 1])
    console.log(`🌱 contador sembrado en ${LIMITE - 1}/${LIMITE} (día Madrid ${dia.d})`)
    console.log(`   → le queda UNA. La 2.ª que conteste es la que el servidor debe rechazar.`)

    // ── 3. sesión forjada ─────────────────────────────────────────────────────
    const host = new URL(URL_BASE).hostname
    const valor = await mintOwnAuthCookie(
      { userId: userId!, email: EMAIL }, secret, { nowSec: Math.floor(Date.now() / 1000), host })

    const browser = await chromium.launch()
    const ctx = await browser.newContext()
    await ctx.addCookies([{ name: sessionCookieNameFor(host), value: valor, domain: host, path: '/' }])
    const page = await ctx.newPage()

    if (LATENCIA_MS > 0) {
      await page.route('**/api/v2/answer-and-save', async (route) => {
        await new Promise((r) => setTimeout(r, LATENCIA_MS))
        await route.continue()
      })
      console.log(`🐢 guardado retrasado ${LATENCIA_MS} ms (la reconciliación del cliente va a 2.500 ms)`)
    }

    const respuestas: { status: number; cuerpo: string }[] = []
    page.on('response', async (r) => {
      if (!r.url().includes('/api/v2/answer-and-save')) return
      let cuerpo = ''
      try { cuerpo = (await r.text()).slice(0, 160) } catch {}
      respuestas.push({ status: r.status(), cuerpo })
    })

    console.log(`🌐 ${URL_BASE}${RUTA_TEST}`)
    await page.goto(URL_BASE + RUTA_TEST, { waitUntil: 'domcontentloaded', timeout: 60000 })
    await page.waitForTimeout(10000)

    // El banner de cookies tapa los botones de respuesta y hace que el click expire
    // ("element is not stable / intercepts pointer events"). Sin quitarlo, la sim da un
    // falso "no pudo pulsar" que se confundiría con un bloqueo de la UI.
    for (const etiqueta of ['Aceptar todo', 'Completar después', 'Aceptar', 'Entendido']) {
      const b = page.getByRole('button', { name: etiqueta, exact: false }).first()
      if (await b.count() > 0) { try { await b.click({ timeout: 2500 }); break } catch {} }
    }
    await page.waitForTimeout(1000)

    // ── 4. contestar varias seguidas, mirando la pantalla en cada una ─────────
    for (let n = 1; n <= A_CONTESTAR; n++) {
      const antes = respuestas.length

      // ¿La UI ya está enseñando el muro ANTES de intentar contestar?
      const texto = (await page.locator('body').innerText().catch(() => '')) || ''
      // El muro se manifiesta de DOS formas y las dos cuentan: la pantalla de límite que
      // sustituye al test, y el modal de Premium que `setShowUpgradeModal(true)` levanta
      // encima. Sin la segunda, un modal correcto se contabiliza como "no pudo pulsar" y
      // parecería un fallo del arnés.
      // ⚠️ NO buscar "Hazte Premium" en el body: ese botón está en la CABECERA de todas
      // las páginas, así que da bloqueo SIEMPRE (falso positivo que hace pasar por "muro
      // correcto" lo que solo es el header). Se busca lo que únicamente aparece cuando el
      // muro está puesto: la pantalla de límite de TestLayout, o el contador del modal
      // `UpgradeLimitModal` ("N/25 preguntas hoy - Limite alcanzado").
      const bloqueoUI = /Límite diario alcanzado|Has alcanzado tu límite diario|Has completado tus|Limite alcanzado|Has llegado al limite/.test(texto)

      // La OPCIÓN LARGA (el botón que contiene el texto de la respuesta). Se prefiere al
      // cuadrado rápido A/B/C/D porque está más arriba y no queda tapado por la barra
      // flotante; los dos llaman al mismo `handleAnswerClick`.
      const opcion = page.locator('button').filter({ hasText: /^A\s*\n?.{6,}/ }).first()
      let contestada = false
      const cuantos = await opcion.count()
      if (!bloqueoUI && cuantos > 0) {
        try { await opcion.click({ timeout: 5000 }); contestada = true }
        catch (e: any) { console.log(`     ⚠️ click falló: ${String(e.message).split('\n')[0].slice(0, 110)}`) }
      } else if (bloqueoUI) {
        // Lo que hace un usuario real: CERRAR el aviso y seguir. El modal es estado
        // propio (`showUpgradeModal`), no se deriva de `isLimitReached`, así que al
        // cerrarlo la única puerta que queda es la de `handleAnswerClick` — que depende
        // del contador YA reconciliado con el servidor.
        for (const cerrar of ['Seguir practicando', 'Ahora no', 'Cerrar', 'Continuar', '✕', '×']) {
          const b = page.getByRole('button', { name: cerrar, exact: false }).first()
          if (await b.count() > 0) { try { await b.click({ timeout: 2000 }); break } catch {} }
        }
        await page.keyboard.press('Escape').catch(() => {})
        await page.waitForTimeout(1200)
        const cuantos2 = await opcion.count()
        if (cuantos2 > 0) {
          try { await opcion.click({ timeout: 4000 }); contestada = true; console.log('     ↩️ modal cerrado y SÍ le deja contestar otra vez') }
          catch { console.log('     ↩️ modal cerrado pero la opción sigue sin ser pulsable (muro real)') }
        }
      } else {
        console.log(`     ⚠️ no hay botón 'A' (count=${cuantos}). En pantalla: ${texto.replace(/\s+/g, ' ').slice(0, 150)}`)
      }
      await page.waitForTimeout(3500)

      const nueva = respuestas[antes] ?? null
      intentos.push({
        n, contestada, bloqueoUI,
        status: nueva?.status ?? null,
        cuerpo: nueva?.cuerpo ?? '(sin llamada a answer-and-save)',
      })
      console.log(`  ${n}. ${bloqueoUI ? 'UI BLOQUEA' : contestada ? 'contestó' : 'no pudo pulsar'} → ${nueva ? `HTTP ${nueva.status}` : 'sin llamada'}`)

      if (!bloqueoUI && contestada) {
        const sig = page.locator('button:has-text("Siguiente"), button:has-text("siguiente")').first()
        if (await sig.count() > 0) { try { await sig.click({ timeout: 4000 }) } catch {} }
        await page.waitForTimeout(1500)
      }
    }

    await page.screenshot({ path: 'scratchpad/t418/goteo-final.png', fullPage: false }).catch(() => {})
    await browser.close()

    // ── 5. veredicto ──────────────────────────────────────────────────────────
    const { rows: [fin] } = await db.query(
      `SELECT questions_answered FROM daily_question_usage WHERE user_id=$1 AND usage_date=$2`,
      [userId, dia.d])

    console.log('\n──────── VEREDICTO ────────')
    console.table(intentos)
    console.log(`contador final en BD: ${fin?.questions_answered}/${LIMITE}`)

    const goteo = intentos.find((i) => i.contestada && i.status === 403)
    if (goteo) {
      console.log(`\n✅ REPRODUCIDO: en el intento ${goteo.n} la UI le DEJÓ contestar y el servidor devolvió 403.`)
      console.log(`   cuerpo: ${goteo.cuerpo}`)
    } else {
      const bloqueado = intentos.find((i) => i.bloqueoUI)
      console.log(`\n❌ NO reproducido con esta secuencia.`)
      if (bloqueado) console.log(`   La UI bloqueó en el intento ${bloqueado.n} ANTES de que hubiera 403.`)
      console.log(`   → la causa que la ficha da por probable NO se sostiene tal cual; hay que buscar otra ventana.`)
    }
  } finally {
    if (userId) {
      // Varias tablas cuelgan del perfil sin CASCADE; se limpian antes para que el
      // usuario efímero no quede huérfano en producción si la sim falla.
      for (const t of ['daily_question_usage', 'user_streaks', 'test_questions', 'test_sessions',
                       'daily_questions_served', 'user_question_favorites']) {
        await db.query(`DELETE FROM ${t} WHERE user_id=$1`, [userId]).catch(() => {})
      }
      await db.query('DELETE FROM user_profiles WHERE id=$1', [userId]).catch((e) =>
        console.log('   ⚠️ no se pudo borrar el perfil:', e.message.slice(0, 120)))
      console.log('\n🧹 usuario efímero borrado')
    }
    await db.end()
  }
}

main().catch((e) => { console.error('💥', e); process.exit(1) })
