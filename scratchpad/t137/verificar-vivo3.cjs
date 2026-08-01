const { Client } = require('pg'); const { pgConfig } = require('../../lib/db/pgSsl.cjs')
;(async () => {
  const c = new Client(pgConfig(process.env.DATABASE_URL)); await c.connect()
  const q = async (l,s)=>{const{rows}=await c.query(s);console.log(`\n### ${l} (${rows.length})`);console.table(rows)}
  await q('columnas', `SELECT column_name FROM information_schema.columns WHERE table_name='content_health_findings' ORDER BY ordinal_position`)
  await q('pasadas por MINUTO', `
    SELECT date_trunc('minute', computed_at) AS pasada, count(*) AS hallazgos, count(DISTINCT kind) AS kinds
      FROM content_health_findings GROUP BY 1 ORDER BY 1 DESC LIMIT 8`)
  await q('kinds presentes en la última pasada', `
    SELECT kind, count(*) FROM content_health_findings
     WHERE computed_at >= (SELECT max(computed_at) FROM content_health_findings) - interval '5 minutes'
     GROUP BY 1 ORDER BY 2 DESC LIMIT 25`)
  await c.end()
})().catch(e=>{console.error('ERROR',e.message);process.exit(1)})
