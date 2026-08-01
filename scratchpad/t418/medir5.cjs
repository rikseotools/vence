const { Client } = require('pg');
const { pgConfig } = require('../../lib/db/pgSsl.cjs');
require('dotenv').config({ path: __dirname + '/../../.env.local' });

// Las dos puertas del servidor devuelven el MISMO texto, pero NO el mismo body:
//  · cuenta      → {limitReached, questionsToday, dailyLimit, isGraduated}
//  · dispositivo → {limitReached, questionsToday}   (sin dailyLimit ni isGraduated)
// Es la única forma de separarlas a posteriori, y decide el arreglo: la de cuenta
// el cliente PUEDE preverla (tiene el contador), la de dispositivo NO la ve jamás.
const PUERTA = `CASE WHEN error_message LIKE '%dailyLimit%' THEN 'cuenta' ELSE 'DISPOSITIVO' END`;

const Q = {
'G. reparto por PUERTA (14d) — ¿cuál rechaza de verdad?': `
  SELECT ${PUERTA} AS puerta, count(*) AS rechazos,
         count(DISTINCT user_id) AS usuarios,
         count(DISTINCT (user_id::text || ts::date::text)) AS casos_usuario_dia
  FROM observable_events
  WHERE error_message LIKE '%límite diario%' AND source='frontend'
    AND ts > now() - interval '14 days'
  GROUP BY 1 ORDER BY 2 DESC`,

'H. reparto por puerta y día (¿cambió algo al desplegar T-304 el 30/07?)': `
  SELECT ts::date AS dia, ${PUERTA} AS puerta, count(*) AS rechazos, count(DISTINCT user_id) AS usuarios
  FROM observable_events
  WHERE error_message LIKE '%límite diario%' AND source='frontend'
    AND ts > now() - interval '14 days'
  GROUP BY 1,2 ORDER BY 1 DESC, 3 DESC`,

'I. la COLA LARGA (>10 en un día), ¿de qué puerta viene?': `
  WITH r AS (
    SELECT user_id, ts::date AS dia, count(*) AS n,
           count(*) FILTER (WHERE error_message LIKE '%dailyLimit%') AS de_cuenta
    FROM observable_events
    WHERE error_message LIKE '%límite diario%' AND source='frontend'
      AND ts > now() - interval '14 days' AND user_id IS NOT NULL
    GROUP BY 1,2
  )
  SELECT CASE WHEN n > 10 THEN 'cola larga (>10)' ELSE 'goteo (1-10)' END AS grupo,
         count(*) AS casos, sum(n) AS rechazos,
         sum(de_cuenta) AS por_cuenta, sum(n) - sum(de_cuenta) AS por_dispositivo
  FROM r GROUP BY 1`,

'J. ¿por qué PANTALLA? (la cola de examen/psico no cablea el puente de T-304)': `
  SELECT endpoint, ${PUERTA} AS puerta, count(*) AS rechazos, count(DISTINCT user_id) AS usuarios
  FROM observable_events
  WHERE error_message LIKE '%límite diario%' AND source='frontend'
    AND ts > now() - interval '14 days'
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
