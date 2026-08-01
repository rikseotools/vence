const { Client } = require('pg');
const { pgConfig } = require('../../lib/db/pgSsl.cjs');
require('dotenv').config({ path: __dirname + '/../../.env.local' });

// REVISIÓN del discriminador de medir7. Allí uní por `ts::date` (zona de la sesión),
// pero `daily_question_usage.usage_date` lo escribe la función SQL como
// `(NOW() AT TIME ZONE 'Europe/Madrid')::DATE`. En verano son +2 h de desfase, así que
// todo rechazo entre 22:00 y 24:00 UTC se unía al día EQUIVOCADO.
// Aquí se repite la clasificación con el día de Madrid y se compara con la versión mala.
const DIA_MADRID = `(ts AT TIME ZONE 'Europe/Madrid')::date`;

function clasificacion(diaExpr, etiqueta) {
  return `
  WITH ev AS (
    SELECT user_id, ts, ${diaExpr} AS dia,
           (regexp_match(error_message, '"questionsToday":(\\d+)'))[1]::int AS body_qt
    FROM observable_events
    WHERE error_message LIKE '%límite diario%' AND source='frontend'
      AND ts > now() - interval '14 days' AND user_id IS NOT NULL
  ), j AS (
    SELECT ev.*, u.questions_answered AS cuenta_qt
    FROM ev LEFT JOIN daily_question_usage u
      ON u.user_id = ev.user_id AND u.usage_date = ev.dia
  )
  SELECT '${etiqueta}' AS version, CASE
      WHEN cuenta_qt IS NULL   THEN 'sin fila de contador'
      WHEN body_qt = cuenta_qt THEN 'CUADRA (puerta de cuenta)'
      WHEN body_qt > cuenta_qt THEN 'body MAYOR (dispositivo)'
      ELSE 'body MENOR (raro)'
    END AS veredicto, count(*) AS rechazos, count(DISTINCT user_id) AS usuarios
  FROM j GROUP BY 1,2`;
}

const Q = {
'U. ¿cuánto movía el error de zona horaria? (mal vs bien, lado a lado)':
  clasificacion('ts::date', 'A) ts::date (MAL)') + ' UNION ALL ' +
  clasificacion(DIA_MADRID, 'B) día Madrid (BIEN)') + ' ORDER BY 1, 3 DESC',

'V. las DOS poblaciones recontadas con el día correcto': `
  WITH ev AS (
    SELECT user_id, ${DIA_MADRID} AS dia,
           (regexp_match(error_message, '"questionsToday":(\\d+)'))[1]::int AS body_qt
    FROM observable_events
    WHERE error_message LIKE '%límite diario%' AND source='frontend'
      AND ts > now() - interval '14 days' AND user_id IS NOT NULL
  ), j AS (
    SELECT ev.*, u.questions_answered AS cuenta_qt
    FROM ev LEFT JOIN daily_question_usage u
      ON u.user_id = ev.user_id AND u.usage_date = ev.dia
  ), g AS (
    SELECT user_id, dia, count(*) AS n,
           count(*) FILTER (WHERE cuenta_qt IS NOT NULL AND body_qt = cuenta_qt) AS cuadra,
           count(*) FILTER (WHERE cuenta_qt IS NOT NULL AND body_qt > cuenta_qt) AS mayor,
           count(*) FILTER (WHERE cuenta_qt IS NULL) AS sin_fila
    FROM j GROUP BY 1,2
  )
  SELECT CASE WHEN n > 10 THEN 'cola larga (>10)' ELSE 'goteo (1-10)' END AS grupo,
         count(*) AS casos, count(DISTINCT user_id) AS usuarios, sum(n) AS rechazos,
         sum(cuadra) AS cuadra, sum(mayor) AS body_mayor, sum(sin_fila) AS sin_fila
  FROM g GROUP BY 1`,

'W. el goteo con el día correcto: ¿sigue siendo 1 sola respuesta?': `
  WITH r AS (
    SELECT user_id, ${DIA_MADRID} AS dia, count(*) AS n
    FROM observable_events
    WHERE error_message LIKE '%límite diario%' AND source='frontend'
      AND ts > now() - interval '14 days' AND user_id IS NOT NULL
    GROUP BY 1,2 HAVING count(*) <= 10
  )
  SELECT n AS rechazos_ese_dia, count(*) AS casos, count(DISTINCT user_id) AS usuarios
  FROM r GROUP BY 1 ORDER BY 1 LIMIT 6`,
};

(async () => {
  const c = new Client(pgConfig(process.env.DATABASE_URL));
  await c.connect();
  console.log('TimeZone de la sesión pg:', (await c.query('SHOW TimeZone')).rows[0].TimeZone);
  for (const [label, sql] of Object.entries(Q)) {
    try {
      const r = await c.query(sql);
      console.log('\n=== ' + label + ' ===');
      console.table(r.rows);
    } catch (e) { console.log('\n=== ' + label + ' ===\n  ERROR: ' + e.message); }
  }
  await c.end();
})().catch(e => { console.error(e.message); process.exit(1); });
