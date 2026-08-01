const { Client } = require('pg'); const { pgConfig } = require('../../lib/db/pgSsl.cjs')
const DESDE = '2026-08-01T08:29:00Z'
;(async () => { const c=new Client(pgConfig(process.env.DATABASE_URL)); await c.connect()
  const q=async(l,s,p)=>{const{rows}=await c.query(s,p);console.log(`\n### ${l} (${rows.length})`);console.table(rows)}
  await q('filas de historial escritas por la pasada', `
    SELECT verdict, count(*) FROM law_source_verification_history
     WHERE verified_by='vigilancia-hash' AND created_at > $1 GROUP BY 1 ORDER BY 2 DESC`, [DESDE])
  await q('¿cuántas de las 55 tienen linea base previa?', `
    SELECT count(*)::int AS con_base FROM laws l
      LEFT JOIN law_source_verification v ON v.law_id=l.id AND v.source_url IS NOT NULL AND v.source_url<>''
     WHERE l.is_active AND COALESCE(l.is_virtual,false)=false
       AND COALESCE(v.source_url, NULLIF(l.boe_url,'')) IS NOT NULL
       AND (v.source_url IS NOT NULL OR l.boe_url LIKE '%/doc.php%' OR l.scope='eu')
       AND EXISTS (SELECT 1 FROM law_source_verification_history h
                    WHERE h.law_id=l.id AND h.verified_by='vigilancia-hash')`)
  await q('errores del backend en esa ventana', `
    SELECT event_type, severity, left(metadata::text,200) meta, created_at FROM observable_events
     WHERE created_at BETWEEN $1 AND '2026-08-01T08:40:00Z' AND severity IN ('error','warn')
       AND event_type NOT LIKE 'law_source%' ORDER BY created_at LIMIT 8`, [DESDE])
  await c.end() })().catch(e=>{console.error('ERROR',e.message);process.exit(1)})
