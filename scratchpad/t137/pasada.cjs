const { Client } = require('pg'); const { pgConfig } = require('../../lib/db/pgSsl.cjs')
;(async () => { const c=new Client(pgConfig(process.env.DATABASE_URL)); await c.connect()
  const q=async(l,s)=>{const{rows}=await c.query(s);console.log(`\n### ${l} (${rows.length})`);console.table(rows)}
  await q('kinds de la pasada de hoy', `SELECT kind, count(*) FROM content_health_findings
    WHERE computed_at > '2026-08-01T07:00:00Z' GROUP BY 1 ORDER BY 2 DESC`)
  await q('¿hay señal de barrido incompleto?', `SELECT event_type, severity, left(metadata::text,200) meta, created_at
    FROM observable_events WHERE created_at > '2026-08-01T07:00:00Z'
      AND (event_type ILIKE '%sweep%' OR event_type ILIKE '%cron%') ORDER BY created_at DESC LIMIT 8`)
  await c.end() })().catch(e=>{console.error('ERROR',e.message);process.exit(1)})
