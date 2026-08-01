const { Client } = require('pg');
const { pgConfig } = require('../../lib/db/pgSsl.cjs');
require('dotenv').config({ path: __dirname + '/../../.env.local' });

const Q = {
'K. ¿el error_message llega CORTADO? (longitudes)': `
  SELECT length(error_message) AS len, count(*) AS n
  FROM observable_events
  WHERE error_message LIKE '%límite diario%' AND source='frontend'
    AND ts > now() - interval '14 days'
  GROUP BY 1 ORDER BY 2 DESC LIMIT 10`,

'L. muestra CRUDA de 3 mensajes (para ver qué sobrevive al corte)': `
  SELECT DISTINCT right(error_message, 60) AS cola_del_mensaje, count(*) AS n
  FROM observable_events
  WHERE error_message LIKE '%límite diario%' AND source='frontend'
    AND ts > now() - interval '14 days'
  GROUP BY 1 ORDER BY 2 DESC LIMIT 8`,

'M. LA PUERTA DE VERDAD: eventos propios del gate de dispositivo (backend)': `
  SELECT event_type, count(*) AS n, count(DISTINCT user_id) AS usuarios,
         min(ts)::date AS desde, max(ts)::date AS hasta
  FROM observable_events
  WHERE event_type IN ('device_daily_limit_blocked','usage_limit_hit','daily_limit_reached')
    AND ts > now() - interval '14 days'
  GROUP BY 1 ORDER BY 2 DESC`,

'N. el gate de dispositivo: ¿en SOMBRA o cortando? (metadata.mode)': `
  SELECT metadata->>'mode' AS modo, (metadata->>'dirigido')::text AS dirigido,
         count(*) AS n, count(DISTINCT user_id) AS usuarios,
         min(ts)::date AS desde, max(ts)::date AS hasta
  FROM observable_events
  WHERE event_type = 'device_daily_limit_blocked' AND ts > now() - interval '14 days'
  GROUP BY 1,2 ORDER BY 3 DESC`,
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
