#!/usr/bin/env node
const postgres = require('postgres')
require('dotenv').config({ path: '/home/manuel/vence-sessions/movil4/.env.local' })
const sql = postgres(process.env.DATABASE_URL, { max: 1 })
;(async () => {
  const cols = await sql`SELECT table_name FROM information_schema.tables WHERE table_name LIKE '%alert%'`
  console.log('tablas de alertas:', cols.map((c) => c.table_name).join(', ') || '(ninguna)')
  const ev = await sql`
    SELECT created_at, event_type, error_message
      FROM observable_events
     WHERE event_type IN ('alert_fired', 'flota_sin_memoria')
       AND created_at > now() - interval '4 hours'
     ORDER BY created_at DESC LIMIT 8`
  console.log(`\neventos (4 h): ${ev.length}`)
  ev.forEach((x) => console.log(' ', x.created_at.toISOString().slice(11, 19), x.event_type, '|', String(x.error_message || '').slice(0, 80)))
  await sql.end()
})().catch((e) => { console.error(e.message); process.exit(1) })
