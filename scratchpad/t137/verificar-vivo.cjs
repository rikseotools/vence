const { Client } = require('pg'); const { pgConfig } = require('../../lib/db/pgSsl.cjs')
;(async () => {
  const c = new Client(pgConfig(process.env.DATABASE_URL)); await c.connect()
  const q = async (l,s,p)=>{const{rows}=await c.query(s,p);console.log(`\n### ${l}`);console.table(rows)}
  await q('última pasada del barrido', `
    SELECT max(computed_at) AS ultima, count(*) AS hallazgos
      FROM content_health_findings WHERE computed_at > now() - interval '2 days'`)
  await q('los dos kinds de sobre-inclusión, última pasada', `
    SELECT kind, severity, computed_at, left(message, 120) AS mensaje
      FROM content_health_findings
     WHERE kind IN ('scope_over_inclusion_suspect','scope_over_inclusion_confirmed')
     ORDER BY computed_at DESC LIMIT 6`)
  await c.end()
})().catch(e=>{console.error('ERROR',e.message);process.exit(1)})
