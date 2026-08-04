/**
 * scripts/sim/sim-cabecera-alcanzable.ts — la cabecera NUNCA deja nada fuera de la pantalla.
 *
 * ## Por qué existe (T-504, 03/08/2026)
 *
 * La cabecera de escritorio creció un enlace cada vez durante meses y nadie comprobó que
 * siguiera cabiendo, porque no había con qué: los tests de la cabecera miran QUÉ enlaces se
 * pintan, no DÓNDE acaban. El 03/08 dejó de caber y el avatar y la campana se quedaron fuera
 * del viewport —con `overflow-x: hidden`, o sea sin scroll con el que rescatarlos— en las
 * cuatro anchuras de escritorio y en los dos planes. Lo reportó un usuario.
 *
 * Esta simulación comprueba las TRES cosas que tienen que ser ciertas, con navegador real:
 *
 *   1. **La fila no desborda su contenedor** (`scrollWidth ≤ clientWidth`). Es la causa: sin
 *      esto, todo lo demás es cuestión de suerte.
 *   2. **Todo lo pulsable de la cabecera se puede PULSAR** — su centro cae dentro del
 *      viewport. Es el síntoma que sufre el usuario, y se comprueba aparte a propósito: (1)
 *      puede cumplirse y (2) fallar igual si algo se posiciona por su cuenta.
 *   3. **No se ha perdido ningún enlace**: los que no caben en la barra tienen que estar en el
 *      menú «Más», ese menú tiene que ABRIRSE y sus enlaces tienen que poder PULSARSE —se
 *      comprueba con `elementFromPoint`, no contándolos—. Sin este tercer punto, la forma más
 *      fácil de pasar (1) y (2) sería esconder media navegación.
 *
 * ## Contra qué corre
 *
 *   npx tsx scripts/sim/sim-cabecera-alcanzable.ts                  # localhost:3000
 *   AUTH_SECRET=… npx tsx scripts/sim/sim-cabecera-alcanzable.ts --url=https://www.vence.es
 *
 * Solo LEE: carga páginas y mide geometría. Las sesiones se forjan con `lib/sim/session.ts`,
 * que marca el tráfico como simulación para no envenenar las métricas.
 *
 * ## Salidas
 *
 *   0 = verde   ·   1 = ROJO (hay algo fuera de pantalla o perdido)
 *   2 = NO CONCLUYENTE — no se pudo medir (sin cabecera, sin sesión, sin enlaces). Existe
 *       porque un cero de hallazgos sobre cero casos medidos parece verde y no lo es.
 */
import { config } from 'dotenv'
config({ path: '.env.local' })
import { chromium, type Browser } from 'playwright'
import {
  ANCHURAS_ESCRITORIO,
  GUION_MEDIR_CABECERA,
  GUION_MENU_MAS,
  SELECTOR_BOTON_MAS,
  problemasDeCabecera,
  type MedidaCabecera,
} from '../../lib/ui/navOverflowProbe'

const URL_BASE = process.argv.find((a) => a.startsWith('--url'))?.split('=')[1] || 'http://localhost:3000'
const SOLO = process.argv.find((a) => a.startsWith('--solo'))?.split('=')[1]

/** Anchuras de escritorio reales, compartidas con el smoke de CI: si divergieran, una de las
 *  dos comprobaciones dejaría de mirar la anchura que aprieta. */
const ANCHURAS = ANCHURAS_ESCRITORIO

interface Caso { etiqueta: string; userId: string | null; email: string | null }

async function medirCaso(browser: Browser, caso: Caso, ancho: number, cookie: string | null) {
  const ctx = await browser.newContext({ viewport: { width: ancho, height: 925 } })
  if (cookie) {
    const { cookieForPlaywright } = await import('../../lib/sim/session')
    ctx.addCookies([cookieForPlaywright(cookie, new URL(URL_BASE).hostname)])
  }
  const page = await ctx.newPage()
  await page.goto(URL_BASE, { waitUntil: 'networkidle', timeout: 60000 })
  // El reparto ocurre tras el primer layout (se mide y se vuelve a pintar): sin esta espera
  // se estaría midiendo el render provisional, que a propósito enseña TODOS los enlaces.
  await page.waitForTimeout(2500)

  const m: MedidaCabecera = await page.evaluate(GUION_MEDIR_CABECERA)

  // Abrir «Más» y mirar lo que guarda (el guion y su porqué viven en `navOverflowProbe`).
  let enMenu = 0
  let inalcanzablesEnMenu: string[] = []
  let noSePudoAbrir: string | null = null
  if (m.hayBotonMas) {
    try {
      await page.click(SELECTOR_BOTON_MAS, { timeout: 5000 })
      await page.waitForTimeout(400)
      const r: { total: number; inalcanzables: string[] } = await page.evaluate(GUION_MENU_MAS)
      enMenu = r.total
      inalcanzablesEnMenu = r.inalcanzables
    } catch (e) {
      // Que el clic no llegue NO es lo mismo que un menú roto, y la diferencia importa: los
      // usuarios de prueba salen de la BD (`order by updated_at desc`), así que cambian entre
      // corridas, y a uno le puede tocar un modal (onboarding, aviso) tapando la cabecera.
      // Medido el 04/08: eso reventaba la corrida ENTERA con un TimeoutError que se lee como
      // «la cabecera está rota», tirando por el desagüe los otros 11 casos ya medidos.
      // Se degrada a NO CONCLUYENTE, que ya pone el veredicto en amarillo.
      noSePudoAbrir = (e as Error).message.split('\n')[0].slice(0, 120)
    }
  }
  await ctx.close()
  return { ...m, enMenu, inalcanzablesEnMenu, noSePudoAbrir }
}

async function main() {
  const esLocal = /localhost|127\.0\.0\.1/.test(URL_BASE)
  const secret = process.env.AUTH_SECRET
  if (!secret) { console.error('❌ Falta AUTH_SECRET (SSM /vence-frontend/AUTH_SECRET).'); process.exit(2) }

  const { mintOwnAuthCookie } = await import('../../lib/sim/session')
  const { Client } = await import('pg')
  const { pgConfig } = await import('../../lib/db/pgSsl.cjs')
  const c = new Client(pgConfig(process.env.DATABASE_URL!))
  await c.connect()
  // Los dos planes tienen menús de distinta longitud (premium suma «Recompensas» y pierde el
  // botón «Hazte Premium»), así que probar solo uno deja el otro sin vigilar.
  const prem = (await c.query(`select id, email from user_profiles where plan_type='premium' order by updated_at desc limit 1`)).rows[0]
  const free = (await c.query(`select id, email from user_profiles where plan_type='free' and target_oposicion is not null order by updated_at desc limit 1`)).rows[0]
  await c.end()

  const casos: Caso[] = [
    { etiqueta: 'premium', userId: prem?.id ?? null, email: prem?.email ?? null },
    { etiqueta: 'free', userId: free?.id ?? null, email: free?.email ?? null },
    { etiqueta: 'sin sesión', userId: null, email: null },
  ].filter((k) => !SOLO || k.etiqueta === SOLO)

  console.log(`\n🧭 Cabecera alcanzable — ${URL_BASE}${esLocal ? ' (local)' : ' (PRODUCCIÓN)'}\n`)

  const browser = await chromium.launch()
  let rojos = 0
  let medidos = 0
  const noConcluyentes: string[] = []
  const sinMedidor: string[] = []

  for (const caso of casos) {
    if (caso.userId === null && caso.etiqueta !== 'sin sesión') {
      noConcluyentes.push(`${caso.etiqueta}: no hay usuario de ese plan en la BD`)
      continue
    }
    const cookie = caso.userId
      ? await mintOwnAuthCookie(
          { userId: caso.userId, email: caso.email! },
          secret,
          { nowSec: Math.floor(Date.now() / 1000), ttlSec: 900, host: new URL(URL_BASE).hostname },
        )
      : null

    for (const ancho of ANCHURAS) {
      const r = await medirCaso(browser, caso, ancho, cookie)
      const nombre = `${caso.etiqueta} @${ancho}`
      if (!r.hayCabecera) { noConcluyentes.push(`${nombre}: no se encontró la cabecera`); continue }
      if (caso.userId && !r.haySesion) { noConcluyentes.push(`${nombre}: la sesión no se aplicó (sin campana)`); continue }
      // Sin poder abrir «Más» no se puede juzgar si falta algún enlace, así que este caso no
      // se cuenta como medido — pero tampoco como rojo: no se ha visto ningún defecto.
      if (r.noSePudoAbrir) { noConcluyentes.push(`${nombre}: no se pudo abrir «Más» (${r.noSePudoAbrir})`); continue }
      medidos++

      // El veredicto es compartido con el smoke de CI (`lib/ui/navOverflowProbe.ts`): dos
      // criterios sobre lo mismo divergen.
      const problemas = problemasDeCabecera(r, ancho)
      if (r.totalEnlaces === 0) sinMedidor.push(nombre)

      if (problemas.length) {
        rojos++
        console.log(`❌ ${nombre}`)
        problemas.forEach((p) => console.log(`     · ${p}`))
      } else {
        const reparto = r.totalEnlaces > 0 ? ` — ${r.enBarra} en barra${r.enMenu ? ` + ${r.enMenu} en «Más»` : ''}` : ''
        console.log(`✅ ${nombre}${reparto}`)
      }
    }
  }
  await browser.close()

  console.log('')
  if (sinMedidor.length) {
    console.log(`⚠️  sin medidor en ${sinMedidor.length} caso(s) → NO se ha podido comprobar que no falte ningún enlace: ${sinMedidor.join(', ')}`)
  }
  if (noConcluyentes.length) noConcluyentes.forEach((n) => console.log(`⚠️  no concluyente — ${n}`))

  if (rojos > 0) {
    console.log(`\n🔴 ${rojos} de ${medidos} casos con algo fuera de la pantalla.`)
    process.exit(1)
  }
  // Un verde PARCIAL no es un verde. Si algún caso no se pudo medir, el veredicto es amarillo
  // aunque lo medido esté limpio: si no, basta con que una comprobación se rompa en silencio
  // para que la simulación deje de mirar y siga diciendo que todo va bien.
  if (medidos === 0 || noConcluyentes.length || sinMedidor.length) {
    console.log(`\n🟡 NO CONCLUYENTE: ${medidos} caso(s) medidos y ${noConcluyentes.length + sinMedidor.length} sin poder juzgar del todo.`)
    process.exit(2)
  }
  console.log(`\n🟢 ${medidos} casos medidos, todo dentro de la pantalla y ningún enlace perdido.`)
}

main().catch((e) => { console.error('💥', e); process.exit(2) })
