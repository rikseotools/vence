/**
 * SIMULACIÓN [T-482] — el repaso de un test no se le sirve a otra persona.
 *
 * Se comprueba EN NAVEGADOR REAL y contra la BD real porque el arreglo tiene dos mitades que
 * ninguna otra capa puede ejercitar juntas:
 *
 *   · el SERVIDOR ahora exige sesión y comprueba el dueño;
 *   · el CLIENTE (`app/revisar/[testId]/page.tsx`) tiene que MANDAR el Bearer. Si no lo
 *     manda, el arreglo deja la pantalla de repaso en 401 **para todo el mundo**, y eso no lo
 *     ve ni el typecheck ni un test unitario: es runtime de navegador.
 *
 * Esa segunda mitad ya costó un incidente en esta casa (memoria `project-admin-endpoints-sin-auth`,
 * 20/06): al cerrar `/api/admin/*` se escapó un caller que llamaba con `fetch` crudo, el 401
 * se lo tragó un `catch` y el badge del nav desapareció en silencio. La lección escrita
 * entonces fue literal: «para auth de cliente, build/typecheck NO bastan — reproducir en
 * navegador real».
 *
 * SOLO LEE, salvo el caso 5, que INTENTA escribir a propósito (es el agujero) y comprueba
 * contando filas que no ha escrito nada.
 *
 * Uso:
 *   SIM_BASE=http://localhost:3477 npx tsx --env-file=.env.local scripts/sim/sim-repaso-ajeno.ts
 */
import { chromium } from '@playwright/test'
import postgres from 'postgres'
import { mintOwnAuthCookie, cookieForPlaywright } from '../../lib/sim/session'

const BASE = process.env.SIM_BASE || 'http://localhost:3477'
const HOST = new URL(BASE).hostname
const SECRET = process.env.AUTH_SECRET || process.env.SIM_AUTH_SECRET || ''
const SMOKE = process.env.SMOKE_USER_ID || '127063e1-1137-40ff-804d-d974818f338f'

const sql = postgres(process.env.DATABASE_URL!, { ssl: 'require', max: 2 })
const fallos: string[] = []
const linea = (ok: boolean, txt: string) => `${ok ? '✅' : '❌'} ${txt}`

async function main() {
  if (!SECRET) throw new Error('falta AUTH_SECRET (SSM /vence-frontend/AUTH_SECRET)')
  console.log(`🔀 SIMULACIÓN — el repaso ajeno (T-482) contra ${BASE}\n`)

  // Dos usuarios REALES con un test completado cada uno. No se crea nada.
  const pares = await sql<{ id: string; user_id: string }[]>`
    SELECT DISTINCT ON (t.user_id) t.id, t.user_id
    FROM tests t
    WHERE t.is_completed = true AND t.user_id IS NOT NULL
      AND EXISTS (SELECT 1 FROM test_questions tq WHERE tq.test_id = t.id)
    ORDER BY t.user_id, t.completed_at DESC NULLS LAST
    LIMIT 2`
  if (pares.length < 2) {
    console.log('⚠️  No hay dos usuarios con test completado: no se puede simular el caso ajeno.')
    await sql.end()
    process.exit(0)
  }
  const [A, B] = pares
  console.log(`   A = ${A.user_id.slice(0, 8)}… (test ${A.id.slice(0, 8)}…)`)
  console.log(`   B = ${B.user_id.slice(0, 8)}… (test ${B.id.slice(0, 8)}…)\n`)

  const browser = await chromium.launch()
  const ctx = await browser.newContext({ baseURL: BASE })
  const cookie = await mintOwnAuthCookie(
    { userId: A.user_id, email: 'sim-t482@vence.es' },
    SECRET,
    { nowSec: Math.floor(Date.now() / 1000), host: HOST },
  )
  await ctx.addCookies([cookieForPlaywright(cookie, HOST)])
  const page = await ctx.newPage()

  // Se ESPERA la respuesta del endpoint, no un temporizador. En dev la primera compilación
  // de la ruta se lleva varios segundos y un `waitForTimeout` daba un rojo falso: la petición
  // salía con su Bearer y la respuesta llegaba después de mirar. Un canario que depende de lo
  // rápido que compile la máquina no es un canario.
  const esperaReview = (id: string) =>
    page.waitForResponse((r) => r.url().includes(`/review`) && r.url().includes(id), { timeout: 120_000 })

  // ── 1. A abre SU repaso: tiene que verlo (o el arreglo ha roto la pantalla) ──────────────
  const pReview = esperaReview(A.id)
  await page.goto(`/revisar/${A.id}`, { waitUntil: 'domcontentloaded', timeout: 90_000 })
  const rPropio = await pReview.catch(() => null)
  const conAuth = !!rPropio?.request().headers()['authorization']
  await page.waitForTimeout(1500)
  const textoPropio = await page.locator('body').innerText()
  const veSuTest = !/No se pudo cargar|sesión ha caducado|no es tuyo/i.test(textoPropio)
  const ok1 = rPropio?.status() === 200 && conAuth && veSuTest
  console.log(linea(ok1, `1) A ve SU repaso (${rPropio?.status() ?? 'sin respuesta'}, Bearer: ${conAuth ? 'sí' : 'NO'})`))
  if (!conAuth) fallos.push('la pantalla de repaso NO manda el Bearer → 401 para todo el mundo')
  if (rPropio?.status() !== 200) fallos.push(`el dueño recibe ${rPropio?.status() ?? 'nada'} en su propio repaso`)
  if (!veSuTest) fallos.push('el dueño ve una pantalla de error en su propio repaso')

  // ── 2. A intenta abrir el repaso de B: no puede ─────────────────────────────────────────
  const pAjeno = esperaReview(B.id)
  await page.goto(`/revisar/${B.id}`, { waitUntil: 'domcontentloaded', timeout: 90_000 })
  const rAjeno = await pAjeno.catch(() => null)
  await page.waitForTimeout(1500)
  const textoAjeno = await page.locator('body').innerText()
  const bloqueado = /no es tuyo|No se pudo cargar/i.test(textoAjeno)
  // Y lo que de verdad importa: que NO se haya pintado el examen de B.
  const sinFuga = !/Pregunta 1 de|Aciertos/i.test(textoAjeno)
  console.log(linea(rAjeno?.status() === 403 && bloqueado && sinFuga, `2) A NO ve el repaso de B (${rAjeno?.status() ?? 'sin respuesta'})`))
  if (rAjeno?.status() !== 403) fallos.push(`el repaso ajeno no dio 403 (dio ${rAjeno?.status() ?? 'nada'})`)
  if (!bloqueado) fallos.push('la pantalla de repaso ajeno NO avisa')
  if (!sinFuga) fallos.push('🚨 se está pintando el examen de otra persona')

  // ── 3. Sin sesión, la API no suelta el examen (antes: 200 con todo) ──────────────────────
  const anon = await browser.newContext({ baseURL: BASE })
  const rAnon = await anon.request.get(`/api/tests/${A.id}/review`)
  const cuerpoAnon = await rAnon.text()
  const filtra = /questionText|correctAnswer/.test(cuerpoAnon)
  console.log(linea(rAnon.status() === 401 && !filtra, `3) sin sesión, GET /api/tests/<id>/review → ${rAnon.status()}`))
  if (rAnon.status() !== 401) fallos.push(`sin sesión el review devuelve ${rAnon.status()}, no 401`)
  if (filtra) fallos.push('sin sesión el cuerpo TODAVÍA lleva preguntas/respuestas')

  // ── 4. El gemelo psicotécnico, mismo trato ──────────────────────────────────────────────
  const rPsico = await anon.request.get(`/api/psychometric/review?sessionId=${A.id}`)
  console.log(linea(rPsico.status() === 401, `4) sin sesión, GET /api/psychometric/review → ${rPsico.status()}`))
  if (rPsico.status() !== 401) fallos.push(`el gemelo psicotécnico devuelve ${rPsico.status()}, no 401`)

  // ── 5. ESCRITURA: sin sesión no se le puede crear un test a nadie ────────────────────────
  const [{ n: antes }] = await sql<{ n: number }[]>`
    SELECT count(*)::int AS n FROM tests WHERE user_id = ${SMOKE}::uuid`
  const rRec = await anon.request.post('/api/tests/recover', {
    data: {
      userId: SMOKE,
      pendingTest: {
        tema: 1, currentQuestion: 1, score: 1,
        startTime: Date.now() - 60_000, savedAt: Date.now(),
        answeredQuestions: [{ question: 0, selectedAnswer: 1, correct: true, timestamp: new Date().toISOString() }],
        detailedAnswers: [],
      },
    },
  })
  await new Promise((r) => setTimeout(r, 1500))
  const [{ n: despues }] = await sql<{ n: number }[]>`
    SELECT count(*)::int AS n FROM tests WHERE user_id = ${SMOKE}::uuid`
  const noEscribio = antes === despues
  console.log(linea(rRec.status() === 401 && noEscribio, `5) sin sesión, POST /api/tests/recover → ${rRec.status()} · tests de la cuenta ${antes}→${despues}`))
  if (rRec.status() !== 401) fallos.push(`recover sin sesión devuelve ${rRec.status()}, no 401`)
  if (!noEscribio) fallos.push(`🚨 recover ESCRIBIÓ en una cuenta ajena sin sesión (${antes}→${despues})`)

  await browser.close()
  await sql.end()

  console.log('')
  if (fallos.length) {
    console.log('❌ FALLA:')
    for (const f of fallos) console.log('   · ' + f)
    process.exit(1)
  }
  console.log('✅ El repaso es de su dueño, y sin sesión no se lee ni se escribe nada.')
}

main().catch(async (e) => {
  console.error('💥', e)
  await sql.end().catch(() => {})
  process.exit(1)
})
