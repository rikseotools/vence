const { Client } = require('pg');
const { pgConfig } = require('../../lib/db/pgSsl.cjs');
require('dotenv').config({ path: __dirname + '/../../.env.local' });

const Q = {
'R. el GOTEO: ¿cuántas pierde cada uno? (esperado ~1, la del muro)': `
  WITH r AS (
    SELECT user_id, ts::date AS dia, count(*) AS n
    FROM observable_events
    WHERE error_message LIKE '%límite diario%' AND source='frontend'
      AND ts > now() - interval '14 days' AND user_id IS NOT NULL
    GROUP BY 1,2 HAVING count(*) <= 10
  )
  SELECT n AS rechazos_ese_dia, count(*) AS casos, count(DISTINCT user_id) AS usuarios
  FROM r GROUP BY 1 ORDER BY 1`,

'S. la COLA LARGA: ¿son multicuenta? (señales de fraude de esos usuarios)': `
  WITH largos AS (
    SELECT user_id FROM observable_events
    WHERE error_message LIKE '%límite diario%' AND source='frontend'
      AND ts > now() - interval '14 days' AND user_id IS NOT NULL
    GROUP BY user_id, ts::date HAVING count(*) > 10
  )
  SELECT coalesce(f.alert_type,'— sin señal de fraude —') AS senal,
         count(DISTINCT l.user_id) AS usuarios
  FROM (SELECT DISTINCT user_id FROM largos) l
  LEFT JOIN fraud_alerts f ON l.user_id = ANY(f.user_ids)
  GROUP BY 1 ORDER BY 2 DESC`,

'T. ¿cuántas cuentas comparten el dispositivo de la cola larga?': `
  WITH largos AS (
    SELECT DISTINCT user_id FROM (
      SELECT user_id FROM observable_events
      WHERE error_message LIKE '%límite diario%' AND source='frontend'
        AND ts > now() - interval '14 days' AND user_id IS NOT NULL
      GROUP BY user_id, ts::date HAVING count(*) > 10
    ) x
  )
  SELECT count(DISTINCT l.user_id) AS usuarios_cola_larga,
         count(DISTINCT CASE WHEN f.id IS NOT NULL THEN l.user_id END) AS con_señal_multicuenta
  FROM largos l
  LEFT JOIN fraud_alerts f ON l.user_id = ANY(f.user_ids)
    AND f.alert_type IN ('multi_account_device','multi_account_reg_ip','device_daily_farming','premium_sharing')`,
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
