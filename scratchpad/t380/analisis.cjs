const { Client } = require('pg'); const { pgConfig } = require('../../lib/db/pgSsl.cjs')
const DESDE = '2026-08-01T08:25:00Z'
;(async () => { const c=new Client(pgConfig(process.env.DATABASE_URL)); await c.connect()
  const q=async(l,s,p)=>{const{rows}=await c.query(s,p);console.log(`\n### ${l} (${rows.length})`);console.table(rows)}
  await q('reparto de la pasada', `SELECT event_type, severity, count(*) FROM observable_events
     WHERE created_at > $1 AND event_type LIKE 'law_source%' GROUP BY 1,2 ORDER BY 3 DESC`, [DESDE])
  await q('¿heartbeat del cron?', `SELECT event_type, left(metadata::text,160) meta, created_at FROM observable_events
     WHERE created_at > $1 AND (metadata::text ILIKE '%law-source%' OR event_type ILIKE '%heartbeat%')
     ORDER BY created_at DESC LIMIT 6`, [DESDE])
  await q('columnas del historial', `SELECT column_name FROM information_schema.columns
     WHERE table_name='law_source_verification_history' ORDER BY ordinal_position`)
  await c.end() })().catch(e=>{console.error('ERROR',e.message);process.exit(1)})
