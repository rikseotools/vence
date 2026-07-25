#!/usr/bin/env node
/**
 * Construye el INPUT de la auditoría ciega (Paso 7 del manual
 * `docs/maintenance/generar-preguntas-con-ia.md`) para un batch generado.
 *
 * Uso:
 *   node scripts/auditar-batch-input.cjs <batch_id> <salida.json> [--split N]
 *
 * Vuelca `{preguntas: [...], articulos_referenciados: [...]}`:
 *
 *   - `preguntas`: enunciado, opciones, clave y explicación de cada pregunta
 *     del batch, con el texto LITERAL de su artículo.
 *   - `articulos_referenciados`: los artículos que las EXPLICACIONES citan por
 *     su número ("conforme al artículo 21.4", "es el supuesto del art. 120"),
 *     resueltos dentro de las mismas leyes que toca el batch.
 *
 * Por qué lo segundo, que es la razón de ser de este script: si el auditor no
 * tiene el artículo al que remite un bullet, no puede verificarlo y lo devuelve
 * como ISSUE. Pasó el 25/07/2026 dos veces en el mismo día —batch
 * `gen_atc_t208_2026-07-25` (arts. 120, 134 y 101.3) y el de tasas del T215
 * (arts. 7.3, 17, 21.4 y 24)— y las SIETE remisiones eran exactas: ruido puro,
 * una ronda de reparación tirada cada vez. La regla estaba escrita en el manual
 * desde la primera; lo que fallaba era depender de acordarse de aplicarla.
 *
 * `--split N` parte la salida en N ficheros (`<salida>.1.json`, …) para repartir
 * el lote entre auditores independientes sin que se vean entre ellos.
 */
const fs = require('fs')
const path = require('path')
const pg = require(path.join(__dirname, '..', 'backend', 'node_modules', 'postgres'))

/**
 * Artículos citados por una explicación, **de la ley de la propia pregunta**.
 *
 *   "artículo 21.4", "art. 120", "arts. 16 y 17" → ['21','120','16','17']
 *
 * Descarta las citas que nombran OTRA norma a continuación ("el apartado 2 del
 * artículo 4 de la Ley 10/2010…"): resolverlas contra la ley de la pregunta
 * adjunta un artículo que no tiene nada que ver. Pasó en el batch T204, donde
 * una cita a la Ley 10/2010 de blanqueo arrastró el art. 4 de la Ley General
 * Tributaria y el auditor avisó de que el adjunto no pintaba nada.
 *
 * "de este Texto Refundido" y "de esta ley" SÍ pasan: remiten al mismo cuerpo.
 */
const OTRA_NORMA = /^\s*(?:,\s*)?de (?:la|el) (?:Ley|Real Decreto|Reglamento|Decreto|Orden|Directiva|Constituci[óo]n)\b/i

function numerosCitados(texto) {
  const t = String(texto || '')
  const out = new Set()
  const re = /\b(?:art[íi]culos?|arts?\.)\s*([0-9]+(?:\.[0-9]+)*(?:\s*(?:,|y|e)\s*[0-9]+(?:\.[0-9]+)*)*)/gi
  for (const m of t.matchAll(re)) {
    if (OTRA_NORMA.test(t.slice(m.index + m[0].length, m.index + m[0].length + 40))) continue
    for (const n of m[1].split(/\s*(?:,|y|e)\s*/)) {
      const base = n.split('.')[0].trim()
      if (base) out.add(base)
    }
  }
  return [...out]
}

module.exports = { numerosCitados }
if (require.main !== module) return


const args = process.argv.slice(2)
const [BATCH, OUT] = args.filter((a) => !a.startsWith('--'))
const splitIdx = args.indexOf('--split')
const SPLIT = splitIdx >= 0 ? parseInt(args[splitIdx + 1], 10) : 1
if (!BATCH || !OUT) {
  console.error('uso: node scripts/auditar-batch-input.cjs <batch_id> <salida.json> [--split N]')
  process.exit(1)
}

const url = fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8').match(/^DATABASE_URL=(.*)$/m)[1].trim()
const s = pg(url, { ssl: { rejectUnauthorized: false }, max: 1, connect_timeout: 60 })


;(async () => {
  const Q = await s`
    SELECT q.id, q.question_text, q.correct_option, q.option_a, q.option_b, q.option_c, q.option_d,
           q.explanation, a.article_number, a.title AS article_title, a.content, a.law_id, l.short_name AS ley
    FROM questions q
    JOIN articles a ON a.id = q.primary_article_id
    JOIN laws l ON l.id = a.law_id
    WHERE ${BATCH} = ANY(q.tags)
    ORDER BY a.law_id, a.article_number`
  if (!Q.length) { console.error(`❌ el batch ${BATCH} no tiene preguntas`); process.exit(2) }

  const preguntas = Q.map((q) => ({
    id: q.id,
    ley: q.ley,
    articulo: q.article_number,
    titulo_articulo: q.article_title,
    texto_articulo: q.content,
    enunciado: q.question_text,
    opciones: { A: q.option_a, B: q.option_b, C: q.option_c, D: q.option_d },
    clave: 'ABCD'[q.correct_option],
    explicacion: q.explanation,
  }))

  // Artículos que citan las explicaciones. OJO: se calculan POR TROZO, no sobre
  // el batch entero. Cada auditor solo ve su fichero, así que un artículo que
  // viaja en la otra mitad para él no existe — y ese descuido es exactamente el
  // que produjo los avisos de "no verificable" del 25/07.
  const idx = new Map(Q.map((q, i) => [preguntas[i].id, q]))
  const cache = new Map()
  const traer = async (law_id, n) => {
    const k = `${law_id}|${n}`
    if (!cache.has(k)) {
      const r = await s`SELECT a.article_number, a.title, a.content, l.short_name AS ley
                        FROM articles a JOIN laws l ON l.id = a.law_id
                        WHERE a.law_id = ${law_id} AND a.article_number = ${n}`
      cache.set(k, r.length ? { ley: r[0].ley, articulo: r[0].article_number, titulo: r[0].title, texto: r[0].content } : null)
    }
    return cache.get(k)
  }

  const trozos = SPLIT > 1
    ? Array.from({ length: SPLIT }, (_, i) => preguntas.filter((_, j) => j % SPLIT === i))
    : [preguntas]

  let totalRef = 0
  for (const [i, p] of trozos.entries()) {
    const enEsteTrozo = new Set(p.map((x) => `${idx.get(x.id).law_id}|${x.articulo}`))
    const refs = []
    const vistos = new Set()
    for (const x of p) {
      const law_id = idx.get(x.id).law_id
      for (const n of numerosCitados(x.explicacion)) {
        const k = `${law_id}|${n}`
        if (enEsteTrozo.has(k) || vistos.has(k)) continue
        vistos.add(k)
        const art = await traer(law_id, n)
        if (art) refs.push(art)
      }
    }
    const file = SPLIT > 1 ? OUT.replace(/\.json$/, `.${i + 1}.json`) : OUT
    fs.writeFileSync(file, JSON.stringify({ preguntas: p, articulos_referenciados: refs }, null, 1))
    console.log(`   ${file} — ${p.length} preguntas + ${refs.length} artículo(s) referenciado(s)`)
    totalRef += refs.length
  }
  console.log(`\n✅ ${preguntas.length} preguntas · ${totalRef} adjunto(s) de referencia en total`)
  if (!totalRef) console.log('   (ninguna explicación remite a un artículo que falte en su trozo)')
  await s.end()
})().catch((e) => { console.error('❌', e.message); process.exit(1) })
