/**
 * SIMULACIÓN [T-603] — el repaso de fallos NO sirve artículos que el usuario no eligió.
 *
 * ## Por qué en navegador y no solo en Jest
 *
 * El defecto vivía **entre dos pantallas**: el configurador de la ley construía bien la
 * selección y el salto a `/test/repaso-fallos-v2` la tiraba por el camino. Ninguna de las
 * dos piezas estaba «mal» por separado —por eso ningún test las cazó durante dos meses y
 * medio— y el usuario veía sus casillas marcadas mientras el test servía la ley entera.
 * Lo que hay que ejercitar es el TRAYECTO: URL → cliente → endpoint → preguntas servidas,
 * con una sesión de verdad.
 *
 * ## Qué cubre cada capa (para no engañarse con lo que esto NO prueba)
 *
 *   · `__tests__/api/tests/failedQuestionsLawScope.test.ts` → configurador → URL (núcleo puro,
 *     con ida y vuelta contra el parser de producción). Además el parámetro `selectedArticles`
 *     es OBLIGATORIO en el tipo, así que ese salto no se puede volver a olvidar sin romper la
 *     compilación.
 *   · `__tests__/integration/failedQuestionsLawScope.integration.test.ts` → la query real
 *     contra RDS.
 *   · **esto** → el trayecto entero en un navegador, que es lo único que reproduce el fallo
 *     tal y como lo sufrió la persona.
 *
 * SOLO LEE. No escribe nada en ninguna tabla.
 *
 * Uso:
 *   SIM_BASE=http://localhost:3477 npx tsx --env-file=.env.local scripts/sim/sim-repaso-articulos.ts
 *   npx tsx --env-file=.env.local scripts/sim/sim-repaso-articulos.ts --url https://www.vence.es
 *
 * ⚠️ Contra producción NO pasa hasta que el arreglo esté desplegado: en rojo antes y en verde
 * después es justo la prueba de que mide lo que dice medir.
 *
 * Sale 1 si el repaso sirve algún artículo fuera de la selección pedida.
 */
import { chromium } from '@playwright/test'
import postgres from 'postgres'
import { mintOwnAuthCookie, cookieForPlaywright } from '../../lib/sim/session'

const arg = (n: string, d: string) => {
  const i = process.argv.indexOf(n)
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : d
}
const BASE = process.env.SIM_BASE || arg('--url', 'https://www.vence.es')
const HOST = new URL(BASE).hostname
const SECRET = process.env.AUTH_SECRET || process.env.SIM_AUTH_SECRET || ''

const sql = postgres(process.env.DATABASE_URL!, { ssl: 'require', max: 2 })
const fallos: string[] = []
const linea = (ok: boolean, txt: string) => `${ok ? '✅' : '❌'} ${txt}`

interface RespuestaRepaso {
  success?: boolean
  questions?: Array<{ article_number?: string | null }>
  message?: string
}

/**
 * Abre el repaso con esos parámetros y devuelve los artículos que el SERVIDOR sirvió.
 *
 * Se espera la RESPUESTA del endpoint, no un temporizador: en dev la primera compilación de
 * la ruta tarda varios segundos y un `waitForTimeout` da verdes y rojos falsos según la
 * máquina (lección ya aprendida en `sim-repaso-ajeno.ts`).
 */
async function articulosServidos(ctx: import('@playwright/test').BrowserContext, url: string) {
  const page = await ctx.newPage()
  const esperaRespuesta = page.waitForResponse(
    (r) => r.url().includes('/api/v2/tests/failed-questions'),
    { timeout: 60000 },
  )
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 })
  const res = await esperaRespuesta
  const body = (await res.json()) as RespuestaRepaso
  await page.close()
  return {
    http: res.status(),
    articulos: (body.questions ?? []).map((q) => String(q.article_number ?? '')),
    mensaje: body.message,
  }
}

async function main() {
  if (!SECRET) throw new Error('falta AUTH_SECRET (SSM /vence-frontend/AUTH_SECRET)')
  console.log(`🎯 SIMULACIÓN — el repaso respeta la selección de artículos (T-603) contra ${BASE}\n`)

  // Caso REAL, descubierto y no fijado: un usuario con falladas en ≥3 artículos de una misma
  // ley. Fijar a mano un usuario concreto convierte el canario en una bomba de relojería el
  // día que esa persona se dé de baja o repase sus fallos.
  const caso = await sql<{ user_id: string; short_name: string; arts: string[] }[]>`
    WITH heavy AS (
      SELECT user_id FROM user_stats_summary ORDER BY total_questions DESC LIMIT 20
    )
    SELECT tq.user_id::text, l.short_name, array_agg(DISTINCT a.article_number) AS arts
      FROM test_questions tq
      JOIN heavy h ON h.user_id = tq.user_id
      JOIN questions q ON q.id = tq.question_id AND q.is_active = true
      JOIN articles a ON a.id = q.primary_article_id
      JOIN laws l ON l.id = a.law_id
     WHERE tq.is_correct = false
     GROUP BY tq.user_id, l.short_name
    HAVING count(DISTINCT a.article_number) >= 3
     ORDER BY count(DISTINCT a.article_number) DESC
     LIMIT 1`

  if (!caso.length) {
    console.log('⚠️  Nadie con fallos en ≥3 artículos de una misma ley: no hay nada que simular.')
    await sql.end()
    process.exit(0)
  }
  const { user_id: userId, short_name: ley, arts } = caso[0]
  const elegido = arts[0]
  console.log(`   usuario ${userId.slice(0, 8)}… · ley «${ley}» · ${arts.length} artículos fallados`)
  console.log(`   acotaremos al artículo ${elegido}\n`)

  const browser = await chromium.launch()
  const ctx = await browser.newContext({ baseURL: BASE, locale: 'es-ES' })
  const cookie = await mintOwnAuthCookie(
    { userId, email: 'sim-t603@vence.es' },
    SECRET,
    { nowSec: Math.floor(Date.now() / 1000), host: HOST },
  )
  await ctx.addCookies([cookieForPlaywright(cookie, HOST)])

  const q = (extra: string) =>
    `${BASE}/test/repaso-fallos-v2?law=${encodeURIComponent(ley)}&n=50&days=36500&order=recent${extra}`

  // ── CASO 1 — acotado a UN artículo: no puede colarse ningún otro.
  const acotado = await articulosServidos(ctx, q(`&selected_articles=${encodeURIComponent(elegido)}`))
  const fuera = [...new Set(acotado.articulos.filter((a) => a !== String(elegido)))]
  const ok1 = acotado.http === 200 && fuera.length === 0
  console.log(linea(ok1, `acotado al art. ${elegido}: ${acotado.articulos.length} pregunta(s) servidas, ${fuera.length} fuera de la selección`))
  if (fuera.length) console.log(`     artículos que NO pidió: ${fuera.slice(0, 12).join(', ')}`)
  if (!ok1) fallos.push('el repaso sirve artículos fuera de la selección')

  // ── CONTRASTE — sin acotar tiene que seguir viniendo la ley entera.
  //    Sin este caso, un filtro que dejara la lista VACÍA siempre pasaría el caso 1.
  const libre = await articulosServidos(ctx, q(''))
  const distintos = new Set(libre.articulos)
  const ok2 = libre.http === 200 && distintos.size > 1
  console.log(linea(ok2, `sin acotar: ${libre.articulos.length} pregunta(s) de ${distintos.size} artículo(s) distintos`))
  if (!ok2) fallos.push('sin acotar ya no llega la ley entera: el filtro se aplica sin que nadie lo pida')

  // ── CASO 3 — el filtro ACOTA de verdad (no es que no haya nada más que servir).
  const ok3 = acotado.articulos.length < libre.articulos.length || distintos.size === 1
  console.log(linea(ok3, `el filtro recorta: ${libre.articulos.length} sin acotar → ${acotado.articulos.length} acotado`))
  if (!ok3) fallos.push('acotar no cambió nada: el parámetro se está ignorando')

  await browser.close()
  await sql.end()

  console.log(fallos.length ? `\n❌ ${fallos.length} fallo(s):` : '\n✅ el repaso respeta la selección\n')
  fallos.forEach((f) => console.log(`   · ${f}`))
  process.exit(fallos.length ? 1 : 0)
}

main().catch((e) => { console.error('❌', e); process.exit(1) })
