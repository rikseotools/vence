#!/usr/bin/env node
// Espera a que el supervisor publique `flota_sin_memoria` tras el canario de OOM.
const postgres = require('postgres')
require('dotenv').config({ path: '/home/manuel/vence-sessions/movil4/.env.local' })
const sql = postgres(process.env.DATABASE_URL, { max: 1 })
const LIMITE = 8 * 60 * 1000
const inicio = Date.now()
;(async () => {
  for (;;) {
    const r = await sql`
      SELECT created_at, severity, error_message, metadata->>'via' via
        FROM observable_events
       WHERE event_type = 'flota_sin_memoria' AND created_at > now() - interval '20 minutes'
       ORDER BY created_at DESC LIMIT 1`
    if (r.length) {
      console.log(`EMITIDO ${r[0].created_at.toISOString().slice(11, 19)} via=${r[0].via || 'journalctl'} :: ${r[0].error_message}`)
      break
    }
    if (Date.now() - inicio > LIMITE) { console.log('SIN EMITIR tras 8 min — el detector NO lo ha visto'); break }
    await new Promise((r2) => setTimeout(r2, 20000))
  }
  await sql.end()
})().catch((e) => { console.error(e.message); process.exit(1) })
