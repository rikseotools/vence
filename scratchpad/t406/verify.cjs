require('dotenv').config({ path: '.env.local' })
const { pgConfig } = require('../../lib/db/pgSsl.cjs')
const { Client } = require('pg')
const fs = require('fs')

const norm = (s) => (s == null ? null : String(s).trim().replace(/\s+/g, ' '))

;(async () => {
  const c = new Client(pgConfig(process.env.DATABASE_URL))
  await c.connect()
  const { rows } = await c.query(`
    SELECT q.id, q.question_text, q.option_a, q.option_b, q.option_c, q.option_d,
           q.correct_option, q.is_official_exam, q.tags, q.explanation,
           q.explanation_data IS NOT NULL AS has_ed, q.explanation_data,
           q.lifecycle_state, q.exam_source,
           a.article_number, a.title AS art_title, left(a.content, 2500) AS art_content, l.short_name AS ley
    FROM questions q
    LEFT JOIN articles a ON a.id = q.primary_article_id
    LEFT JOIN laws l ON l.id = a.law_id
    WHERE q.is_active = true`)

  const out = []
  for (const q of rows) {
    const opts = [q.option_a, q.option_b, q.option_c, q.option_d].map(norm)
    const pares = []
    for (let i = 0; i < 4; i++)
      for (let j = i + 1; j < 4; j++)
        if (opts[i] && opts[j] && opts[i] === opts[j]) pares.push([i, j])
    if (pares.length) out.push({ ...q, pares })
  }
  fs.writeFileSync(__dirname + '/dump.json', JSON.stringify(out, null, 2))
  console.log('preguntas volcadas:', out.length)
  await c.end()
})()
