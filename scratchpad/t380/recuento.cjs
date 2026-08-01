const { Client } = require('pg'); const { pgConfig } = require('../../lib/db/pgSsl.cjs')
;(async () => { const c=new Client(pgConfig(process.env.DATABASE_URL)); await c.connect()
  const { rows } = await c.query(`
    SELECT event_type, count(*), min(created_at) AS primera, max(created_at) AS ultima
      FROM observable_events WHERE created_at > '2026-08-01T08:29:00Z' AND event_type LIKE 'law_source%'
     GROUP BY 1 ORDER BY 2 DESC`)
  console.table(rows)
  const { rows: t } = await c.query(`SELECT count(*)::int n FROM observable_events
    WHERE created_at > '2026-08-01T08:29:00Z' AND event_type LIKE 'law_source%'`)
  console.log('TOTAL de leyes con rastro:', t[0].n, 'de 55 esperadas')
  await c.end() })().catch(e=>{console.error('ERROR',e.message);process.exit(1)})
