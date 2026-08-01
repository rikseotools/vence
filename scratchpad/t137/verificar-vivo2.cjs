const { Client } = require('pg'); const { pgConfig } = require('../../lib/db/pgSsl.cjs')
;(async () => {
  const c = new Client(pgConfig(process.env.DATABASE_URL)); await c.connect()
  const q = async (l,s)=>{const{rows}=await c.query(s);console.log(`\n### ${l} (${rows.length})`);console.table(rows)}
  await q('pasadas recientes del barrido (por computed_at)', `
    SELECT computed_at, count(*) AS hallazgos, count(DISTINCT kind) AS kinds
      FROM content_health_findings GROUP BY 1 ORDER BY 1 DESC LIMIT 6`)
  await q('kinds de la última pasada que empiezan por scope_', `
    SELECT kind, count(*) FROM content_health_findings
     WHERE computed_at = (SELECT max(computed_at) FROM content_health_findings)
       AND kind LIKE 'scope%' GROUP BY 1`)
  await q('¿existe alguna vez scope_over_inclusion_*?', `
    SELECT kind, count(*), max(computed_at) AS ultima FROM content_health_findings
     WHERE kind LIKE 'scope_over_inclusion%' GROUP BY 1`)
  await c.end()
})().catch(e=>{console.error('ERROR',e.message);process.exit(1)})
