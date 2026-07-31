const { Client } = require('pg')
const { pgConfig } = require('../../lib/db/pgSsl.cjs')
;(async () => {
  const c = new Client(pgConfig(process.env.DATABASE_URL)); await c.connect()
  const q = async (l, s) => { const { rows } = await c.query(s); console.log(`\n### ${l} (${rows.length})`); console.table(rows) }
  await q('los 29 over_inclusion NO verificados: ¿cuántos son "RECORTE APLICADO"?',
    `SELECT (razon LIKE '[RECORTE APLICADO%') AS ya_aplicado, count(*) FROM scope_over_inclusion_adjudications
     WHERE verdict='over_inclusion' AND verificado=false GROUP BY 1`)
  await q('los 16 CONFIRMADOS (verdict=over_inclusion AND verificado)',
    `SELECT a.band, t.position_type, t.topic_number AS tema, l.short_name AS ley,
            left(coalesce(a.arts_correctos,''), 40) AS arts_correctos,
            a.adjudicado_at::date AS adjudicado, left(a.razon, 60) AS razon
       FROM scope_over_inclusion_adjudications a
       JOIN topics t ON t.id = a.topic_id
       JOIN laws l ON l.id = a.law_id
      WHERE a.verdict='over_inclusion' AND a.verificado
      ORDER BY t.position_type, t.topic_number`)
  await c.end()
})().catch(e => { console.error('ERROR', e.message); process.exit(1) })
