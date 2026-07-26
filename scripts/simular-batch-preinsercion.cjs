#!/usr/bin/env node
/**
 * SIMULADOR PRE-INSERCIÓN de un batch de preguntas generadas — capa de I/O.
 *
 * Uso:  node scripts/simular-batch-preinsercion.cjs <borrador.json> [--json]
 *       exit 0 = limpio para insertar · 1 = hay bloqueantes · 2 = error de uso
 *
 * Toda la lógica vive en `lib/generacion/simularBatch.js` (núcleo PURO, testeado en
 * `__tests__/lib/generacion/simularBatch.test.js`). Este fichero solo lee de RDS —en
 * SOLO LECTURA— el texto de los artículos y los enunciados de las preguntas ya vivas,
 * y pinta el resultado.
 *
 * Encaja en el Paso 3/5.bis del manual `generar-preguntas-con-ia.md`: corre ANTES de
 * insertar, con los MISMOS núcleos que `verificar-batch-generado.cjs` usa DESPUÉS, para
 * que el veredicto no dependa de si el batch ya está en la base.
 */
require('dotenv').config({ path: '.env.local' })
const fs = require('fs')
const path = require('path')
const { Client } = require('pg')
const {
  analizarPregunta,
  analizarLote,
  analizarDuplicados,
} = require(path.join(__dirname, '..', 'lib/generacion/simularBatch.js'))

const FILE = process.argv[2]
const AS_JSON = process.argv.includes('--json')
if (!FILE) {
  console.error('uso: node scripts/simular-batch-preinsercion.cjs <borrador.json> [--json]')
  process.exit(2)
}

const etiqueta = (q, i) => `Q${i + 1}${q.article_label ? ` (${q.article_label})` : ''}`

;(async () => {
  const Q = JSON.parse(fs.readFileSync(FILE, 'utf8'))
  if (!Array.isArray(Q) || !Q.length) {
    console.error('el borrador está vacío o no es un array')
    process.exit(2)
  }

  const c = new Client({
    connectionString: (process.env.DATABASE_URL || '').replace(/[?&]sslmode=require/, ''),
    ssl: { rejectUnauthorized: false },
  })
  await c.connect()

  // El artículo se resuelve por las DOS vías que circulan, igual que la normalización de
  // campos: por `primary_article_id` (formato del manual) o por `law_slug` +
  // `primary_article_number` (el que de verdad lee `insertar-batch-generado.cjs`). Sin la
  // segunda, un borrador en el formato del INSERTER no se puede simular — que es
  // justamente el que hay que simular. (T-096, 26/07: se descubrió usando el simulador.)
  const ids = [...new Set(Q.map((q) => q.primary_article_id).filter(Boolean))]
  const porNumero = [
    ...new Set(
      Q.filter((q) => !q.primary_article_id && q.law_slug && q.primary_article_number)
        .map((q) => `${q.law_slug}\u0000${q.primary_article_number}`),
    ),
  ]

  const arts = new Map() // clave: id  ó  `${law_slug}\u0000${article_number}`
  const articleIds = []
  if (ids.length) {
    const ra = await c.query(
      'SELECT id, content FROM articles WHERE id = ANY($1) AND is_active = true',
      [ids],
    )
    ra.rows.forEach((r) => { arts.set(r.id, r.content); articleIds.push(r.id) })
  }
  for (const clave of porNumero) {
    const [slug, num] = clave.split('\u0000')
    const r = await c.query(
      `SELECT a.id, a.content FROM articles a JOIN laws l ON l.id = a.law_id
       WHERE l.slug = $1 AND a.article_number = $2 AND a.is_active = true LIMIT 1`,
      [slug, num],
    )
    if (r.rows.length) { arts.set(clave, r.rows[0].content); articleIds.push(r.rows[0].id) }
  }

  const claveDe = (q) =>
    q.primary_article_id || `${q.law_slug}\u0000${q.primary_article_number}`

  const rv = articleIds.length
    ? await c.query(
        'SELECT question_text FROM questions WHERE primary_article_id = ANY($1) AND is_active = true',
        [articleIds],
      )
    : { rows: [] }
  await c.end()

  const errores = []
  const avisos = []

  Q.forEach((q, i) => {
    const clave = claveDe(q)
    if (!arts.has(clave)) {
      errores.push(
        `${etiqueta(q, i)}: artículo inexistente o inactivo (${q.primary_article_id || `${q.law_slug} art.${q.primary_article_number}`})`,
      )
      return
    }
    const r = analizarPregunta(q, arts.get(clave))
    r.errores.forEach((e) => errores.push(`${etiqueta(q, i)}: ${e}`))
    r.avisos.forEach((a) => avisos.push(`${etiqueta(q, i)}: ${a}`))
  })

  const lote = analizarLote(Q)
  lote.errores.forEach((e) => errores.push(e))
  analizarDuplicados(Q, rv.rows.map((r) => r.question_text)).forEach((d) =>
    avisos.push(`${etiqueta(Q[d.i], d.i)}: ${d.motivo}`),
  )

  if (AS_JSON) {
    console.log(
      JSON.stringify(
        { n: Q.length, distribucion: lote.distribucionTexto, secuencia: lote.secuencia, errores, avisos },
        null,
        2,
      ),
    )
  } else {
    console.log(`\n━━━ SIMULACIÓN PRE-INSERCIÓN — ${path.basename(FILE)} (${Q.length} preguntas) ━━━`)
    console.log(`  distribución: ${lote.distribucionTexto}`)
    console.log(`  secuencia   : ${lote.secuencia}`)
    console.log(`  vivas en esos artículos: ${rv.rows.length}`)
    console.log(`\n  ❌ ${errores.length} bloqueante(s)`)
    errores.forEach((e) => console.log(`     ❌ ${e}`))
    console.log(`  🟡 ${avisos.length} a revisar a mano`)
    avisos.forEach((a) => console.log(`     🟡 ${a}`))
    console.log(
      errores.length
        ? '\n  → NO insertar: repara el borrador y vuelve a simular.'
        : '\n  → Limpio para insertar. Los 🟡 exigen criterio (§2.2: la literalidad mecánica es un PROXY, no un veredicto).',
    )
  }
  process.exit(errores.length ? 1 : 0)
})().catch((e) => {
  console.error('ERR', e.message)
  process.exit(2)
})
