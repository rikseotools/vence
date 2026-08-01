const { Client } = require('pg');
const { pgConfig } = require('../../lib/db/pgSsl.cjs');
require('dotenv').config({ path: __dirname + '/../../.env.local' });

// DISCRIMINADOR SIN TEXTOS (el de medir5 era falso: separaba épocas de deploy).
// El `questionsToday` del cuerpo del 403 se compara con el contador REAL de la cuenta
// ese día (`daily_question_usage`, que SATURA en el tope):
//   · body == contador de cuenta  → rechazó la puerta de CUENTA  → el cliente PODÍA saberlo
//   · body >  contador de cuenta  → el número suma entre cuentas → puerta de DISPOSITIVO,
//                                    que el cliente NO consulta jamás.
const BASE = `
  WITH ev AS (
    SELECT user_id, ts, ts::date AS dia,
           (regexp_match(error_message, '"questionsToday":(\\d+)'))[1]::int AS body_qt
    FROM observable_events
    WHERE error_message LIKE '%límite diario%' AND source='frontend'
      AND ts > now() - interval '14 days' AND user_id IS NOT NULL
  ),
  j AS (
    SELECT ev.*, u.questions_answered AS cuenta_qt
    FROM ev LEFT JOIN daily_question_usage u
      ON u.user_id = ev.user_id AND u.usage_date = ev.dia
  )`;

const Q = {
'O. ¿el número del rechazo cuadra con el contador de la CUENTA?': `
  ${BASE}
  , clasif AS (
    SELECT CASE
      WHEN cuenta_qt IS NULL          THEN 'sin fila de contador ese día'
      WHEN body_qt = cuenta_qt        THEN 'CUADRA (puerta de cuenta)'
      WHEN body_qt > cuenta_qt        THEN 'body MAYOR (suma entre cuentas = dispositivo)'
      ELSE 'body MENOR (raro)'
    END AS veredicto FROM j
  )
  SELECT veredicto, count(*) AS rechazos FROM clasif GROUP BY 1 ORDER BY 2 DESC`,

'P. lo mismo, pero contando USUARIOS y separando la cola larga': `
  ${BASE}
  , g AS (
    SELECT user_id, dia, count(*) AS n,
           count(*) FILTER (WHERE cuenta_qt IS NOT NULL AND body_qt > cuenta_qt) AS mayor,
           count(*) FILTER (WHERE cuenta_qt IS NOT NULL AND body_qt = cuenta_qt) AS cuadra,
           count(*) FILTER (WHERE cuenta_qt IS NULL) AS sin_fila
    FROM j GROUP BY 1,2
  )
  SELECT CASE WHEN n > 10 THEN 'cola larga (>10)' ELSE 'goteo (1-10)' END AS grupo,
         count(*) AS casos_usuario_dia, count(DISTINCT user_id) AS usuarios,
         sum(n) AS rechazos, sum(cuadra) AS cuadra, sum(mayor) AS body_mayor, sum(sin_fila) AS sin_fila
  FROM g GROUP BY 1`,

'Q. el contador de cuenta de los afectados: ¿estaba realmente al tope?': `
  ${BASE}
  SELECT CASE
           WHEN cuenta_qt IS NULL THEN 'sin fila'
           WHEN cuenta_qt >= 25   THEN 'cuenta AL TOPE (>=25)'
           WHEN cuenta_qt = 0     THEN 'cuenta a CERO'
           ELSE 'cuenta por debajo del tope (1-24)'
         END AS estado_cuenta,
         count(*) AS rechazos, count(DISTINCT user_id) AS usuarios
  FROM j GROUP BY 1 ORDER BY 2 DESC`,
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
