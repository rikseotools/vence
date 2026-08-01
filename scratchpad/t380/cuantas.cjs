const { Client } = require('pg'); const { pgConfig } = require('../../lib/db/pgSsl.cjs')
;(async () => { const c=new Client(pgConfig(process.env.DATABASE_URL)); await c.connect()
  // La MISMA condición que usa el @Cron, copiada literal.
  const { rows } = await c.query(`
    SELECT count(*)::int AS objetivo FROM laws l
      LEFT JOIN law_source_verification v ON v.law_id = l.id AND v.source_url IS NOT NULL AND v.source_url <> ''
     WHERE l.is_active AND COALESCE(l.is_virtual,false)=false
       AND COALESCE(v.source_url, NULLIF(l.boe_url,'')) IS NOT NULL
       AND (v.source_url IS NOT NULL OR l.boe_url LIKE '%/doc.php%' OR l.scope='eu')`)
  console.log('leyes que el @Cron DEBERÍA revisar:', rows[0].objetivo)
  console.log('eventos emitidos en la pasada de las 08:30:', 11)
  await c.end() })().catch(e=>{console.error('ERROR',e.message);process.exit(1)})
