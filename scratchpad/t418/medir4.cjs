const { Client } = require('pg');
const { pgConfig } = require('../../lib/db/pgSsl.cjs');
require('dotenv').config({ path: __dirname + '/../../.env.local' });

const Q = {
'D. ¿ya estaba agotado ANTES de empezar? questionsToday del PRIMER rechazo del día': `
  WITH r AS (
    SELECT user_id, ts::date AS dia, ts,
           (regexp_match(error_message, '"questionsToday":(\\d+)'))[1]::int AS qt,
           row_number() OVER (PARTITION BY user_id, ts::date ORDER BY ts) AS rn,
           count(*) OVER (PARTITION BY user_id, ts::date) AS total_dia
    FROM observable_events
    WHERE error_message LIKE '%límite diario%' AND source='frontend'
      AND ts > now() - interval '14 days' AND user_id IS NOT NULL
  )
  SELECT CASE WHEN total_dia > 10 THEN 'cola larga (>10)' ELSE 'goteo (1-10)' END AS grupo,
         count(*) AS casos_usuario_dia,
         count(*) FILTER (WHERE qt >= 25) AS ya_agotado_en_el_primer_rechazo,
         round(100.0*count(*) FILTER (WHERE qt >= 25)/count(*),1) AS pct,
         sum(total_dia) AS respuestas_perdidas
  FROM r WHERE rn = 1 GROUP BY 1`,

'E. las respuestas rechazadas, ¿llegaron a test_questions?': `
  SELECT count(*) AS eventos_con_questionId
  FROM observable_events
  WHERE error_message LIKE '%límite diario%' AND source='vercel'
    AND ts > now() - interval '7 days' AND metadata->>'questionId' IS NOT NULL`,

'F. columnas premium de user_profiles': `
  SELECT column_name FROM information_schema.columns
  WHERE table_name='user_profiles' AND column_name ILIKE '%premium%' OR
        (table_name='user_profiles' AND column_name ILIKE '%plan%')`,
};

(async () => {
  const c = new Client(pgConfig(process.env.DATABASE_URL));
  await c.connect();
  for (const [label, sql] of Object.entries(Q)) {
    try {
      const r = await c.query(sql);
      console.log('\n=== ' + label + ' ===');
      console.table(r.rows);
    } catch (e) { console.log('\n=== ' + label + ' ===\n  ERROR: ' + e.message); }
  }
  await c.end();
})().catch(e => { console.error(e.message); process.exit(1); });
