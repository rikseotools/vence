const { Client } = require('pg'); const { pgConfig } = require('../../lib/db/pgSsl.cjs')
;(async () => { const c=new Client(pgConfig(process.env.DATABASE_URL)); await c.connect()
  const { rows } = await c.query(`
    SELECT metadata->>'short_name' AS ley, metadata->>'preguntas' AS preg, metadata->>'url' AS url
      FROM observable_events WHERE created_at > '2026-08-01T08:29:00Z' AND event_type='law_source_changed'
     ORDER BY (metadata->>'preguntas')::int DESC`)
  for (const r of rows) console.log(`  ${String(r.preg).padStart(4)} preg · ${r.ley}\n        ${r.url}`)
  const dom = {}
  for (const r of rows) { const h = new URL(r.url).host; dom[h] = (dom[h]||0)+1 }
  console.log('\npor dominio:', dom)
  const { rows: ok } = await c.query(`
    SELECT metadata->>'url' AS url FROM observable_events
     WHERE created_at > '2026-08-01T08:29:00Z' AND event_type='law_source_checked'`)
  const domOk = {}
  for (const r of ok) { const h = new URL(r.url).host; domOk[h] = (domOk[h]||0)+1 }
  console.log('dominios de las que NO cambiaron:', domOk)
  await c.end() })().catch(e=>{console.error('ERROR',e.message);process.exit(1)})
