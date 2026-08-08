// La fecha de la Ley 33/2003 estaba mal en NUESTRO import, no en el BOE.
//
// El BOE consolidado del RD 1155/2024 (BOE-A-2024-24099) la cita DOS veces como «de 3 de
// noviembre», que es la fecha real de la ley (BOE-A-2003-20254; el 4 de noviembre es la fecha de
// PUBLICACIÓN, que es de donde suele venir la confusión). Nuestro `articles.content` del art. 220
// decía «de 4 de noviembre», y la pregunta que lo cita copió el dato malo — correctamente, porque
// la regla manda citar el artículo LITERAL. Así que la raíz es el artículo, y se arregla ahí
// primero; si no, cualquier pregunta futura sobre este artículo repetiría el error.
//
// Se toca SOLO esa cadena, en el artículo y en la pregunta. Ni la clave, ni el estado.
const { Client } = require('pg')
const { pgConfig } = require('../lib/db/pgSsl.cjs')

const APLICAR = process.argv.includes('--apply')
const MAL = 'Ley 33/2003, de 4 de noviembre'
const BIEN = 'Ley 33/2003, de 3 de noviembre'

;(async () => {
  const c = new Client(pgConfig())
  await c.connect()

  // 1) ¿Cuántos artículos de CUALQUIER ley arrastran la fecha mal? (medir antes de tocar)
  const { rows: arts } = await c.query(`
    SELECT a.id, l.short_name, a.article_number
      FROM articles a JOIN laws l ON l.id = a.law_id
     WHERE a.content LIKE '%' || $1 || '%'`, [MAL])
  console.log(`artículos con «${MAL}»: ${arts.length}`)
  for (const a of arts) console.log(`   · ${a.short_name} art. ${a.article_number}`)

  // 2) ¿Y cuántas preguntas activas?
  const { rows: qs } = await c.query(`
    SELECT id, left(question_text, 70) AS q
      FROM questions
     WHERE is_active AND (
       question_text LIKE '%' || $1 || '%' OR explanation LIKE '%' || $1 || '%' OR
       option_a LIKE '%' || $1 || '%' OR option_b LIKE '%' || $1 || '%' OR
       option_c LIKE '%' || $1 || '%' OR option_d LIKE '%' || $1 || '%')`, [MAL])
  console.log(`preguntas ACTIVAS que la citan mal: ${qs.length}`)
  for (const q of qs) console.log(`   · ${String(q.id).slice(0, 8)} ${q.q}`)

  if (!APLICAR) { console.log('\n(dry-run — repite con --apply)'); await c.end(); return }

  for (const a of arts) {
    await c.query(`UPDATE articles SET content = replace(content, $1, $2), updated_at = now() WHERE id = $3`,
      [MAL, BIEN, a.id])
  }
  for (const q of qs) {
    await c.query(`
      UPDATE questions SET
        question_text = replace(question_text, $1, $2),
        explanation   = replace(explanation, $1, $2),
        option_a = replace(option_a, $1, $2), option_b = replace(option_b, $1, $2),
        option_c = replace(option_c, $1, $2), option_d = replace(option_d, $1, $2),
        updated_at = now()
      WHERE id = $3`, [MAL, BIEN, q.id])
  }
  console.log(`\n✅ ${arts.length} artículo(s) y ${qs.length} pregunta(s) corregidos`)
  await c.end()
})().catch((e) => { console.error(e.message); process.exit(1) })
