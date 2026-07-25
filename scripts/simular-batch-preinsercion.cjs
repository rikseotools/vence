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

  const ids = [...new Set(Q.map((q) => q.primary_article_id).filter(Boolean))]
  const arts = new Map()
  if (ids.length) {
    const ra = await c.query(
      'SELECT id, content FROM articles WHERE id = ANY($1) AND is_active = true',
      [ids],
    )
    ra.rows.forEach((r) => arts.set(r.id, r.content))
  }
  const rv = ids.length
    ? await c.query(
        'SELECT question_text FROM questions WHERE primary_article_id = ANY($1) AND is_active = true',
        [ids],
      )
    : { rows: [] }
  await c.end()

  const errores = []
  const avisos = []

  Q.forEach((q, i) => {
    if (!arts.has(q.primary_article_id)) {
      errores.push(`${etiqueta(q, i)}: artículo inexistente o inactivo (${q.primary_article_id})`)
      return
    }
    const r = analizarPregunta(q, arts.get(q.primary_article_id))
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
