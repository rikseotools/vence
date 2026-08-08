// ¿El lote de T-679 duplica alguna de las 12 que T-683 acaba de re-anclar al RD 1125/2024?
// Es el aviso literal que dejó la ficha de T-683, y ahora las 12 están VIVAS, así que toca medirlo.
const { Client } = require('pg')
const { pgConfig } = require('../lib/db/pgSsl.cjs')
const { urlLecturaNegocio } = require('../lib/db/negocioSoloLectura.cjs')

const lote = require('./t679/gen_gcivil_t17_rd1125_2026-08-07_borrador.json')
const nuevas = Array.isArray(lote) ? lote : lote.questions || lote.preguntas || []

const pal = (t) =>
  new Set(
    String(t || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .match(/[a-z0-9]{4,}/g) || [],
  )
const jaccard = (a, b) => {
  const A = pal(a), B = pal(b)
  if (!A.size || !B.size) return 0
  let inter = 0
  for (const x of A) if (B.has(x)) inter++
  return inter / (A.size + B.size - inter)
}

;(async () => {
  const c = new Client(pgConfig(urlLecturaNegocio()))
  await c.connect()
  const { rows: vivas } = await c.query(`
    SELECT left(q.id::text, 8) AS id, q.question_text, a.article_number
      FROM questions q
      JOIN articles a ON a.id = q.primary_article_id
      JOIN laws l ON l.id = a.law_id
     WHERE l.slug = 'rd-1125-2024-tic-age' AND q.is_active`)
  console.log(`vivas hoy en RD 1125/2024: ${vivas.length} (las re-ancladas por T-683)`)

  let sospechas = 0
  for (const [i, q] of nuevas.entries()) {
    for (const v of vivas) {
      const s = jaccard(q.question_text, v.question_text)
      if (s >= 0.45) {
        sospechas++
        console.log(`\n⚠️  Q${i + 1} (art. ${q.primary_article_number}) ~ viva ${v.id} (art. ${v.article_number}) · Jaccard ${s.toFixed(2)}`)
        console.log(`    nueva: ${q.question_text.slice(0, 130)}`)
        console.log(`    viva : ${v.question_text.slice(0, 130)}`)
      }
    }
  }
  console.log(sospechas ? `\n${sospechas} pareja(s) a leer a mano` : '\n✅ ninguna pareja por encima de 0,45')
  await c.end()
})().catch((e) => { console.error(e.message); process.exit(1) })
