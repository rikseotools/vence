require('dotenv').config({ path: '.env.local' });
const { pgConfig } = require('/home/manuel/Documentos/github/vence/lib/db/pgSsl.cjs');
const { Client } = require('pg');
(async () => {
  const c = new Client(pgConfig());
  await c.connect();
  const cols = await c.query(`SELECT column_name FROM information_schema.columns WHERE table_name='oposiciones_ssot' AND (column_name ILIKE '%slug%' OR column_name ILIKE '%position%' OR column_name ILIKE '%programa%' OR column_name ILIKE '%nombre%')`);
  console.log('cols:', cols.rows.map(r=>r.column_name).join(', '));
  const o = await c.query(`SELECT * FROM oposiciones_ssot WHERE slug ILIKE '%carlos%iii%' OR slug ILIKE '%carlos-iii%'`);
  for (const r of o.rows) console.log({slug:r.slug, programa_url:r.programa_url, estado:r.estado_proceso, activa:r.is_active});
  const v = await c.query(`SELECT t.topic_number, tev.state, tev.source_url
    FROM topic_epigrafe_verification tev JOIN topics t ON t.id=tev.topic_id
    WHERE t.position_type='auxiliar_administrativo_universidad_carlos_iii' ORDER BY t.topic_number LIMIT 5`);
  console.log('epigrafe_verification:', v.rows.length ? JSON.stringify(v.rows) : '(sin filas → never_sourced)');
  await c.end();
})();
