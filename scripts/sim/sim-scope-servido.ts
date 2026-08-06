#!/usr/bin/env npx tsx
/**
 * SIMULACIÓN — ¿lo que le servimos a ESTA persona entra en SU temario? (T-607)
 *
 * ## Por qué existe, y por qué mide HACIA DELANTE
 *
 * La pregunta «¿estamos sirviendo fuera del temario?» se ha intentado responder dos veces mirando
 * al pasado —cruzando servidas de hace días contra el `topic_scope` de hoy— y las dos veces salió
 * un número que no significaba nada: si a una pregunta le cambian el artículo, o alguien recorta un
 * scope, la servida de la semana pasada aparece «fuera» sin haberlo estado nunca. `topic_scope` no
 * tiene `updated_at`, así que **esa duda no se puede resolver hacia atrás**.
 *
 * Esto pide preguntas AHORA, con la sesión de un usuario REAL, y las juzga contra el scope de
 * AHORA. Los dos extremos son del mismo instante, así que un hallazgo es un hallazgo.
 *
 * No sustituye a la sonda continua que pide [T-607] (esa mide TODAS las servidas de todo el mundo,
 * en el propio punto de servicio). Esto es su versión barata y bajo demanda: sirve para contestar
 * una impugnación concreta —«¿le va a volver a pasar?»— sin esperar días de telemetría.
 *
 * ## El criterio NO se reimplementa
 *
 * El juicio lo pone `fueraDeScope` (`lib/api/_shared/topicScopeSql.ts`), que es el gemelo en memoria
 * de `articleInScope` y la fuente única del scope por artículo — respeta `article_numbers IS NULL`
 * = «toda la ley», que es el error de medida que infló las dos mediciones anteriores. Una segunda
 * opinión aquí sería una tercera copia del criterio, que es como nacen los desacuerdos invisibles.
 *
 * SOLO LEE. No escribe en ninguna tabla.
 *
 * Uso:
 *   npm run sim:scope-servido -- --usuario <uuid>
 *   npm run sim:scope-servido -- --oposicion auxiliar_administrativo_universidad_carlos_iii
 *   npm run sim:scope-servido -- --usuario <uuid> --ruta /mi-oposicion/test/tema/17/test-examen
 *   SIM_BASE=http://localhost:3477 npm run sim:scope-servido -- --usuario <uuid>
 *
 * Necesita AUTH_SECRET (SSM /vence-frontend/AUTH_SECRET) para acuñar la sesión.
 * Sale 1 si alguna pregunta servida cae fuera del temario de esa persona.
 */
import { chromium } from '@playwright/test'
import postgres from 'postgres'
import { mintOwnAuthCookie, cookieForPlaywright } from '../../lib/sim/session'
import { fueraDeScope } from '../../lib/api/_shared/topicScopeSql'

const arg = (n: string, d = '') => {
  const i = process.argv.indexOf(n)
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : d
}
const BASE = process.env.SIM_BASE || arg('--url', 'https://www.vence.es')
const HOST = new URL(BASE).hostname
const SECRET = process.env.AUTH_SECRET || process.env.SIM_AUTH_SECRET || ''
const TANDAS = Number(arg('--tandas', '5'))

const sql = postgres(process.env.DATABASE_URL!, { ssl: 'require', max: 2 })

async function main() {
  if (!SECRET) throw new Error('falta AUTH_SECRET (SSM /vence-frontend/AUTH_SECRET)')

  // A quién medimos. Con --oposicion se coge a alguien REAL de esa oposición que además haya
  // hecho tests: un usuario sin historial no ejercita los caminos que dependen de él.
  let userId = arg('--usuario')
  let positionType = arg('--oposicion')
  if (!userId && !positionType) throw new Error('pásame --usuario <uuid> o --oposicion <position_type>')

  if (!userId) {
    const cand = await sql<{ id: string }[]>`
      SELECT p.id FROM user_profiles p
       WHERE p.target_oposicion = ${positionType}
         AND EXISTS (SELECT 1 FROM tests t WHERE t.user_id = p.id)
       ORDER BY p.created_at DESC LIMIT 1`
    if (!cand.length) { console.log(`⚠️  nadie con tests en «${positionType}»: no hay a quién medir.`); await sql.end(); process.exit(0) }
    userId = cand[0].id
  }

  const perfil = await sql<{ target_oposicion: string | null }[]>`
    SELECT target_oposicion FROM user_profiles WHERE id = ${userId}`
  if (!perfil.length) throw new Error(`no existe el usuario ${userId}`)
  positionType = perfil[0].target_oposicion || positionType
  if (!positionType) { console.log('⚠️  ese usuario no tiene oposición fijada: sin temario contra el que medir.'); await sql.end(); process.exit(0) }

  console.log(`🎯 ¿le servimos fuera de su temario? — ${userId.slice(0, 8)}… · «${positionType}» · ${BASE}\n`)

  // El temario: TODAS las filas de topic_scope de sus temas activos. Se pasan crudas al núcleo
  // puro; resumirlas aquí (p.ej. aplanando los NULL) sería reimplementar su criterio a medias.
  const scope = await sql<{ lawId: string | null; articleNumbers: string[] | null }[]>`
    SELECT ts.law_id AS "lawId", ts.article_numbers AS "articleNumbers"
      FROM topic_scope ts JOIN topics t ON t.id = ts.topic_id
     WHERE t.position_type = ${positionType} AND t.is_active`
  if (!scope.length) { console.log('⚠️  esa oposición no tiene topic_scope: nada que comparar.'); await sql.end(); process.exit(0) }
  console.log(`   temario: ${scope.length} fila(s) de topic_scope`)

  const rutas = arg('--ruta') ? [arg('--ruta')] : ['/test/rapido']
  const navegador = await chromium.launch()
  const ctx = await navegador.newContext({ baseURL: BASE, locale: 'es-ES' })
  const cookie = await mintOwnAuthCookie(
    { userId, email: 'sim-scope@vence.es' },
    SECRET,
    { nowSec: Math.floor(Date.now() / 1000), host: HOST },
  )
  await ctx.addCookies([cookieForPlaywright(cookie, HOST)])

  const servidosIds: string[] = []
  for (const ruta of rutas) {
    console.log(`\n📄 ${ruta}`)
    for (let i = 1; i <= TANDAS; i++) {
      const page = await ctx.newPage()
      // Se espera la RESPUESTA del endpoint, nunca un temporizador: en dev la primera compilación
      // tarda segundos y un `waitForTimeout` da verdes y rojos según lo rápida que sea la máquina.
      const espera = page.waitForResponse(r => r.url().includes('/api/questions/filtered'), { timeout: 60000 })
        .catch(() => null)
      await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded', timeout: 60000 })
      const res = await espera
      if (!res) { console.log(`   tanda ${i}: sin respuesta del endpoint`); await page.close(); continue }
      const qs = ((await res.json()).questions ?? []) as Array<{ id: string }>
      qs.forEach(q => servidosIds.push(q.id))
      console.log(`   tanda ${i}: ${qs.length} pregunta(s)`)
      await page.close()
    }
  }
  await navegador.close()

  const unicos = [...new Set(servidosIds)]
  if (!unicos.length) { console.log('\n⚠️  no se sirvió ninguna pregunta: no se puede afirmar nada.'); await sql.end(); process.exit(0) }

  // (ley, artículo) se resuelven en BD y NO desde el JSON servido: la forma serializada de una
  // pregunta no es un contrato, y adivinar el nombre del campo ya dio un falso 40-de-40.
  const servidas = await sql<{ id: string; lawId: string | null; articleNumber: string | null; ley: string }[]>`
    SELECT q.id, a.law_id AS "lawId", a.article_number AS "articleNumber", l.short_name AS ley
      FROM questions q
      JOIN articles a ON a.id = q.primary_article_id
      JOIN laws l ON l.id = a.law_id
     WHERE q.id = ANY(${unicos})`
  await sql.end()

  const fuera = fueraDeScope(servidas, scope)
  console.log(`\nservidas: ${servidosIds.length} (${unicos.length} únicas · ${servidas.length} con artículo resuelto)`)
  if (!fuera.length) { console.log('\n✅ ninguna fuera de su temario\n'); process.exit(0) }

  const cuenta = new Map<string, number>()
  for (const f of fuera) {
    const k = `${f.ley} art ${f.articleNumber}`
    cuenta.set(k, (cuenta.get(k) ?? 0) + 1)
  }
  console.log(`\n❌ ${fuera.length} de ${servidas.length} FUERA de su temario:`)
  ;[...cuenta.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25)
    .forEach(([k, v]) => console.log(`   ${String(v).padStart(3)}×  ${k}`))
  console.log()
  process.exit(1)
}

main().catch(e => { console.error('❌', e); process.exit(1) })
