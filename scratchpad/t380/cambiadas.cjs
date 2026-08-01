const { Client } = require('pg'); const { pgConfig } = require('../../lib/db/pgSsl.cjs')
;(async () => { const c=new Client(pgConfig(process.env.DATABASE_URL)); await c.connect()
  const q=async(l,s,p)=>{const{rows}=await c.query(s,p);console.log(`\n### ${l} (${rows.length})`);console.table(rows)}
  await q('historial de las 2 CAMBIADAS', `
    SELECT l.short_name, h.verified_by, h.verdict, left(h.source_hash,16) AS source_hash,
           h.created_at
      FROM law_source_verification_history h JOIN laws l ON l.id=h.law_id
     WHERE l.short_name IN ('RGPD UE 2016/679','Decreto 317/2003 Cartas de Servicios Andalucía')
     ORDER BY l.short_name, h.created_at DESC LIMIT 12`)
  await q('¿cuántas leyes tienen fuente vigilable?', `
    SELECT count(*) FILTER (WHERE coalesce(v.source_url, l.boe_url) IS NOT NULL) AS con_fuente,
           count(*) AS total_leyes_activas
      FROM laws l LEFT JOIN law_source_verification v ON v.law_id = l.id
     WHERE EXISTS (SELECT 1 FROM articles a WHERE a.law_id=l.id AND a.is_active)`)
  await c.end() })().catch(e=>{console.error('ERROR',e.message);process.exit(1)})
