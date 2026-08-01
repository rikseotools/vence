const { Client } = require('pg');
const { pgConfig } = require('../../lib/db/pgSsl.cjs');
require('dotenv').config({ path: __dirname + '/../../.env.local' });

// ¿El rechazo del GOTEO ocurre PEGADO a la última respuesta que sí se guardó (borde del
// muro, en vivo) o MUCHO DESPUÉS (reintento de la cola persistente, que guarda hasta 7
// días en localStorage)? Es lo que distingue las dos causas que quedan, y la reproducción
// con navegador ya descartó la del borde.
const DIA = `(ts AT TIME ZONE 'Europe/Madrid')::date`;

const Q = {
'X. hueco entre el rechazo y la ÚLTIMA respuesta guardada de ese usuario': `
  WITH rech AS (
    SELECT user_id, ts, ${DIA} AS dia,
           row_number() OVER (PARTITION BY user_id, ${DIA} ORDER BY ts) AS rn,
           count(*) OVER (PARTITION BY user_id, ${DIA}) AS n_dia
    FROM observable_events
    WHERE error_message LIKE '%límite diario%' AND source='frontend'
      AND ts > now() - interval '14 days' AND user_id IS NOT NULL
  ),
  goteo AS (SELECT * FROM rech WHERE n_dia <= 10 AND rn = 1),
  con_gap AS (
    SELECT g.user_id, g.ts,
      (SELECT max(tq.created_at) FROM test_questions tq
        WHERE tq.user_id = g.user_id AND tq.created_at <= g.ts
          AND tq.created_at > g.ts - interval '24 hours') AS ultima_guardada
    FROM goteo g
  )
  SELECT CASE
      WHEN ultima_guardada IS NULL THEN 'sin respuesta guardada en 24h'
      WHEN ts - ultima_guardada < interval '30 seconds'  THEN 'a) < 30 s  (borde en vivo)'
      WHEN ts - ultima_guardada < interval '5 minutes'   THEN 'b) 30 s - 5 min'
      WHEN ts - ultima_guardada < interval '1 hour'      THEN 'c) 5 min - 1 h'
      ELSE                                                    'd) > 1 h  (reintento de cola)'
    END AS hueco,
    count(*) AS casos
  FROM con_gap GROUP BY 1 ORDER BY 1`,

'Y. ¿el usuario seguía activo en ese momento? (page_views en ±2 min)': `
  WITH rech AS (
    SELECT user_id, ts, ${DIA} AS dia,
           row_number() OVER (PARTITION BY user_id, ${DIA} ORDER BY ts) AS rn,
           count(*) OVER (PARTITION BY user_id, ${DIA}) AS n_dia
    FROM observable_events
    WHERE error_message LIKE '%límite diario%' AND source='frontend'
      AND ts > now() - interval '7 days' AND user_id IS NOT NULL
  ), goteo AS (SELECT * FROM rech WHERE n_dia <= 10 AND rn = 1)
  SELECT CASE WHEN EXISTS (
           SELECT 1 FROM observable_events e
            WHERE e.user_id = g.user_id
              AND e.ts BETWEEN g.ts - interval '2 minutes' AND g.ts + interval '2 minutes'
              AND e.event_type <> 'usage_limit_hit'
         ) THEN 'con actividad alrededor' ELSE 'SIN otra actividad (suena a fondo)' END AS estado,
         count(*) AS casos
  FROM goteo g GROUP BY 1`,
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
