// Verificación: la consulta EXACTA que acabo de meter en los dos gemelos, contra datos vivos.
const { Client } = require('pg')
const { pgConfig } = require('../../lib/db/pgSsl.cjs')
;(async () => {
  const c = new Client(pgConfig(process.env.DATABASE_URL)); await c.connect()
  const { rows } = await c.query(`
    SELECT t.position_type pt, t.topic_number tn, l.short_name ley, a.band
      FROM scope_over_inclusion_adjudications a
      JOIN topics t ON t.id = a.topic_id
      JOIN laws l ON l.id = a.law_id
     WHERE a.verdict = 'over_inclusion' AND a.verificado
       AND t.is_active = true
     ORDER BY t.position_type, t.topic_number`)
  const nOpos = new Set(rows.map(r => r.pt)).size
  console.log(`kind scope_over_inclusion_confirmed → ${rows.length} recorte(s) en ${nOpos} oposición(es)`)
  console.log(rows.map(r => `  ${r.pt} T${r.tn} ${r.ley} [${r.band}]`).join('\n'))
  await c.end()
})().catch(e => { console.error('ERROR', e.message); process.exit(1) })
