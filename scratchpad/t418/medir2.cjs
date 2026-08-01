const { Client } = require('pg');
const { pgConfig } = require('../../lib/db/pgSsl.cjs');
require('dotenv').config({ path: __dirname + '/../../.env.local' });

const Q = {
'1. volumen por día (14d) — 403 de límite en answer-and-save': `
  SELECT date_trunc('day', ts)::date AS dia,
         count(*) FILTER (WHERE event_type='usage_limit_hit') AS usage_limit_hit,
         count(*) FILTER (WHERE event_type='console_error')   AS console_error,
         count(DISTINCT user_id) AS usuarios
  FROM observable_events
  WHERE error_message LIKE '%límite diario%' AND source='frontend'
    AND ts > now() - interval '14 days'
  GROUP BY 1 ORDER BY 1 DESC`,

'2. por pantalla (7d)': `
  SELECT metadata->>'url' AS url, count(*) AS rechazos, count(DISTINCT user_id) AS usuarios
  FROM observable_events
  WHERE error_message LIKE '%límite diario%' AND source='frontend'
    AND ts > now() - interval '7 days'
  GROUP BY 1 ORDER BY 2 DESC LIMIT 12`,

'3. ¿tienen perfil? (hipótesis hasLimit=false por userProfile ausente)': `
  WITH afectados AS (
    SELECT DISTINCT user_id FROM observable_events
    WHERE error_message LIKE '%límite diario%' AND source='frontend'
      AND ts > now() - interval '7 days' AND user_id IS NOT NULL
  )
  SELECT count(*) AS usuarios_afectados,
         count(p.id) AS con_perfil,
         count(*) - count(p.id) AS sin_perfil,
         count(*) FILTER (WHERE p.plan_type='premium') AS premium,
         count(*) FILTER (WHERE p.plan_type IS NULL) AS plan_null
  FROM afectados a LEFT JOIN user_profiles p ON p.id = a.user_id`,

'4. rechazos por usuario/día (distintas preguntas en balde)': `
  WITH r AS (
    SELECT user_id, ts::date AS dia, count(*) AS rechazos
    FROM observable_events
    WHERE error_message LIKE '%límite diario%' AND source='frontend'
      AND ts > now() - interval '7 days' AND user_id IS NOT NULL
    GROUP BY 1,2
  )
  SELECT width_bucket(rechazos, 1, 41, 8) AS banda,
         min(rechazos) AS min, max(rechazos) AS max, count(*) AS casos_usuario_dia
  FROM r GROUP BY 1 ORDER BY 1`,
};

(async () => {
  const c = new Client(pgConfig(process.env.DATABASE_URL));
  await c.connect();
  for (const [label, sql] of Object.entries(Q)) {
    const r = await c.query(sql);
    console.log('\n=== ' + label + ' ===');
    console.table(r.rows);
  }
  await c.end();
})().catch(e => { console.error(e.message); process.exit(1); });
