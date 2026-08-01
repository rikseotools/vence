const { Client } = require('pg');
const { pgConfig } = require('../../lib/db/pgSsl.cjs');
require('dotenv').config({ path: __dirname + '/../../.env.local' });

const Q = {
'A. LA COLA LARGA: usuario/día con >10 rechazos — ¿tiene perfil? ¿qué plan?': `
  WITH r AS (
    SELECT user_id, ts::date AS dia, count(*) AS rechazos,
           min(ts) AS primero, max(ts) AS ultimo,
           (array_agg(DISTINCT metadata->>'url'))[1] AS url
    FROM observable_events
    WHERE error_message LIKE '%límite diario%' AND source='frontend'
      AND ts > now() - interval '14 days' AND user_id IS NOT NULL
    GROUP BY 1,2 HAVING count(*) > 10
  )
  SELECT left(r.user_id::text,8) AS uid, r.dia, r.rechazos,
         round(extract(epoch from (r.ultimo-r.primero))/60) AS minutos,
         coalesce(p.plan_type,'SIN PERFIL') AS plan, r.url
  FROM r LEFT JOIN user_profiles p ON p.id=r.user_id
  ORDER BY r.rechazos DESC LIMIT 15`,

'B. ¿los 12 premium lo eran YA cuando se les rechazó?': `
  WITH e AS (
    SELECT user_id, min(ts) AS primer_rechazo, max(ts) AS ultimo_rechazo, count(*) AS n
    FROM observable_events
    WHERE error_message LIKE '%límite diario%' AND source='frontend'
      AND ts > now() - interval '7 days' AND user_id IS NOT NULL
    GROUP BY 1
  )
  SELECT left(e.user_id::text,8) AS uid, e.n AS rechazos, p.plan_type,
         p.premium_expires_at,
         (p.premium_expires_at > e.ultimo_rechazo) AS ya_era_premium
  FROM e JOIN user_profiles p ON p.id=e.user_id
  WHERE p.plan_type='premium' ORDER BY e.n DESC`,

'C. cuántas respuestas se pierden DE VERDAD: rechazos vs guardadas ese día': `
  WITH r AS (
    SELECT user_id, ts::date AS dia, count(*) AS rechazadas
    FROM observable_events
    WHERE error_message LIKE '%límite diario%' AND source='frontend'
      AND ts > now() - interval '7 days' AND user_id IS NOT NULL
    GROUP BY 1,2
  )
  SELECT sum(rechazadas) AS total_rechazadas,
         count(*) AS casos_usuario_dia,
         count(DISTINCT user_id) AS usuarios,
         round(avg(rechazadas),1) AS media,
         percentile_cont(0.5) WITHIN GROUP (ORDER BY rechazadas) AS mediana,
         sum(rechazadas) FILTER (WHERE rechazadas > 10) AS en_la_cola_larga
  FROM r`,
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
