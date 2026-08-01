// Espera a la pasada de las 08:30 UTC del cron law-source-watch y comprueba sus 3 puntos.
const { Client } = require('pg'); const { pgConfig } = require('../../lib/db/pgSsl.cjs')
const dormir = ms => new Promise(r => setTimeout(r, ms))
const DESDE = '2026-08-01T08:25:00Z'
;(async () => {
  for (let i = 0; i < 90; i++) {
    const c = new Client(pgConfig(process.env.DATABASE_URL)); await c.connect()
    const { rows } = await c.query(`
      SELECT event_type, severity, metadata, created_at FROM observable_events
       WHERE created_at > $1
         AND (event_type ILIKE '%law_source%' OR metadata::text ILIKE '%law-source-watch%')
       ORDER BY created_at DESC LIMIT 20`, [DESDE])
    if (rows.length) {
      console.log(`✅ ${rows.length} evento(s) de la vigilancia:`)
      for (const r of rows) console.log(`  ${r.created_at.toISOString()} · ${r.event_type} [${r.severity}] ${JSON.stringify(r.metadata).slice(0,400)}`)
      const { rows: h } = await c.query(`
        SELECT verified_by, count(*) n, max(verified_at) ultima
          FROM law_source_verification_history WHERE verified_at > $1 GROUP BY 1`, [DESDE])
      console.log('\nhistorial escrito en esta pasada:'); console.table(h)
      await c.end(); process.exit(0)
    }
    await c.end(); await dormir(30000)
  }
  console.log('⌛ 45 min sin rastro de la vigilancia'); process.exit(1)
})().catch(e => { console.error('ERROR', e.message); process.exit(2) })
