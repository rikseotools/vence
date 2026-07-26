#!/usr/bin/env node
/**
 * Reactiva un artículo apagado COMPARÁNDOLO ANTES con el texto oficial del BOE consolidado,
 * y reescribiéndolo con el oficial si hace falta.
 *
 * Uso:  node scripts/reactivar-articulo-boe.cjs "<short_name>" "<article_number>"            # DRY-RUN
 *       node scripts/reactivar-articulo-boe.cjs "<short_name>" "<article_number>" --apply
 *       ... [--bloque <id>]   # forzar el bloque del BOE si el mapeo por número no lo encuentra
 *
 * POR QUÉ EXISTE (26/07/2026, T-139). Un artículo escopado pero inactivo no se sirve aunque
 * tenga preguntas activas. Cuando NO hay un artículo activo al que re-anclar esas preguntas
 * (ver `scripts/reanclar-preguntas.cjs`), la salida es reactivar este — pero solo si el
 * texto es el bueno, y eso hay que MEDIRLO contra el BOE, no suponerlo.
 *
 * GOTCHAS que este script ya respeta:
 *  · Se compara contra el bloque **VIGENTE** (`bloqueVigente`), no contra el bloque crudo:
 *    el crudo trae todas las versiones y las notas de modificación, y comparar contra él
 *    hace que un artículo COMPLETO parezca truncado (pasó con el art. 28 del Reglamento de
 *    Armas: 4.628 caracteres frente a 8.839 "oficiales" que en realidad eran 4.672).
 *  · El id de bloque se resuelve con `mapaBloquesPorArticulo` sobre el índice; NUNCA se
 *    fabrica un `a<N>` (en la LGSS el art. 154 tiene id `a`, y `a154` da 404). Para
 *    disposiciones el id es la rúbrica (`dt`, `dasegunda`, `dfunica`), no un número.
 *  · Escribir `content` dispara `reset_questions_on_article_update`, que resetea la
 *    verificación de sus preguntas. Es correcto: se verificaron contra el texto anterior.
 *  · Si el artículo trae NOTA DE VIGENCIA del BOE, se muestra y NO se aplica sin `--apply`
 *    consciente: puede afectar a la clave de sus preguntas.
 */
require('dotenv').config({ path: '.env.local' })
const path = require('path')
const { Client } = require('pg')
const { bloqueVigente, mapaBloquesPorArticulo } = require(path.join(__dirname, '..', 'lib', 'laws', 'boeBloqueVigente'))
const { compararArticuloOficial } = require(path.join(__dirname, '..', 'lib', 'laws', 'compararArticuloOficial'))

const API = 'https://www.boe.es/datosabiertos/api/legislacion-consolidada/id'
const [LEY, NUM] = process.argv.slice(2)
const APPLY = process.argv.includes('--apply')
// OJO: indexOf devuelve -1 si no se pasó la bandera, y argv[0] es la ruta de node — sin
// esta guarda el script pedía al BOE el bloque "/usr/bin/node" y moría con un 404 críptico.
const iBloque = process.argv.indexOf('--bloque')
const BLOQUE = iBloque > -1 ? (process.argv[iBloque + 1] || '').trim() || null : null
if (!LEY || !NUM) {
  console.error('uso: node scripts/reactivar-articulo-boe.cjs "<short_name>" "<article_number>" [--bloque <id>] [--apply]')
  process.exit(2)
}
const get = async (u) => {
  const r = await fetch(u, { headers: { Accept: 'application/xml' } })
  if (!r.ok) throw new Error(`HTTP ${r.status} en ${u}`)
  return r.text()
}

;(async () => {
  const c = new Client({
    connectionString: (process.env.DATABASE_URL || '').replace(/[?&]sslmode=require/, ''),
    ssl: { rejectUnauthorized: false },
  })
  await c.connect()

  const a = (
    await c.query(
      `SELECT a.id, a.content, a.is_active, l.boe_url, l.short_name
         FROM articles a JOIN laws l ON l.id = a.law_id
        WHERE l.short_name = $1 AND a.article_number = $2`,
      [LEY, NUM],
    )
  ).rows
  if (a.length !== 1) {
    console.error(a.length ? `⛔ ${a.length} artículos coinciden con ${LEY} «${NUM}»: desambigua` : `⛔ no existe ${LEY} «${NUM}»`)
    process.exit(2)
  }
  const art = a[0]
  const boeId = (art.boe_url || '').match(/\b(BOE-[A-Z]-\d{4}-\d+)\b/)?.[1]
  if (!boeId) {
    console.error(`⛔ ${LEY} no tiene BOE-ID reconocible en boe_url (${art.boe_url})`)
    process.exit(1)
  }

  // Un artículo que no está en ningún topic_scope activo no se sirve aunque se reactive:
  // reactivarlo sería trabajo invisible y un falso "arreglado".
  const temas = (
    await c.query(
      `SELECT DISTINCT t.position_type||'/T'||t.topic_number k
         FROM articles ar
         JOIN topic_scope ts ON ts.law_id = ar.law_id
                            AND (ts.article_numbers IS NULL OR ar.article_number = ANY(ts.article_numbers))
         JOIN topics t ON t.id = ts.topic_id AND t.is_active
        WHERE ar.id = $1`,
      [art.id],
    )
  ).rows.map((r) => r.k)
  const preg = (await c.query(`SELECT count(*)::int n FROM questions WHERE primary_article_id=$1 AND is_active`, [art.id])).rows[0].n

  const bid = BLOQUE || mapaBloquesPorArticulo(await get(`${API}/${boeId}/texto/indice`))[NUM]
  console.log(`\n━━━ ${art.short_name} «${NUM}» (${boeId}) — ${APPLY ? 'APLICANDO' : 'DRY-RUN'}`)
  console.log(`    activo=${art.is_active} · ${preg} pregunta(s) activa(s) · ${temas.length} tema(s) lo escopan`)
  if (!bid) {
    console.error('⛔ no se localiza el bloque en el índice del BOE. Pásalo con --bloque (las disposiciones usan la rúbrica: dt, dasegunda, dfunica…)')
    process.exit(1)
  }
  const b = bloqueVigente(await get(`${API}/${boeId}/texto/bloque/${bid}`))
  const oficial = String((b && b.texto) || '').trim()
  const cmp = compararArticuloOficial(art.content, oficial)
  console.log(`    bloque ${bid} · nuestro ${(art.content || '').length}ch · oficial ${oficial.length}ch`)
  console.log(`    veredicto: ${cmp.clase.toUpperCase()} — ${cmp.resumen}`)
  for (const p of cmp.faltan.slice(0, 5)) console.log(`      + falta: ${p.slice(0, 140)}`)
  for (const p of cmp.sobran.slice(0, 5)) console.log(`      - sobra: ${p.slice(0, 140)}`)
  if (b && b.notaVigencia) console.log(`    ⚠️  NOTA DE VIGENCIA del BOE: ${b.notaVigencia.replace(/\s+/g, ' ').slice(0, 240)}`)

  const bloqueos = []
  if (!temas.length) bloqueos.push('no está en ningún topic_scope activo: reactivarlo no lo haría visible')
  if (cmp.clase === 'sin_oficial') bloqueos.push('no se ha podido leer el texto oficial')
  if (cmp.clase === 'contaminado') bloqueos.push('tenemos párrafos que el BOE no tiene: averigua de dónde salen ANTES de reactivar (puede ser otra norma o una versión derogada)')
  if (bloqueos.length) {
    for (const x of bloqueos) console.log(`  ⛔ ${x}`)
    await c.end()
    process.exit(1)
  }

  const reescribe = cmp.clase !== 'identico'
  console.log(`  ✅ se puede reactivar${reescribe ? ' reescribiendo el texto con el oficial del BOE' : ' sin tocar el texto'}`)
  if (!APPLY) {
    console.log('\n(dry-run: no se ha escrito nada. Repite con --apply)')
    await c.end()
    return
  }

  await c.query('BEGIN')
  try {
    if (reescribe) await c.query(`UPDATE articles SET content=$1 WHERE id=$2`, [oficial, art.id])
    await c.query(`UPDATE articles SET is_active=true WHERE id=$1`, [art.id])
    // Comprobación DENTRO de la transacción: si lo escrito no es lo que se quería, no se
    // confirma. Barato, y evita descubrirlo por un informe optimista.
    const post = (await c.query(`SELECT content, is_active FROM articles WHERE id=$1`, [art.id])).rows[0]
    const ver = compararArticuloOficial(post.content, oficial)
    if (!post.is_active || (reescribe && ver.clase !== 'identico')) throw new Error(`la verificación post-escritura falla: activo=${post.is_active} clase=${ver.clase}`)
    await c.query('COMMIT')
    console.log(`  ✅ reactivado${reescribe ? ' y reescrito verbatim' : ''} · ${preg} pregunta(s) vuelven a servirse en ${temas.length} tema(s)`)
  } catch (e) {
    await c.query('ROLLBACK')
    throw e
  }
  await c.query('SELECT public.refresh_topic_question_summary()')
  console.log('  🔄 vista materializada refrescada. Falta purgar la caché de prod (tags test-counts/temario/teoria/questions).')
  await c.end()
})().catch((e) => {
  console.error('❌', e.message)
  process.exit(1)
})
