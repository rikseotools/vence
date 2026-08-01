const { Client } = require('pg');
const { pgConfig } = require('../../lib/db/pgSsl.cjs');
(async () => {
  const c = new Client(pgConfig()); await c.connect();

  console.log('═══ 1. Cobertura de huellas v2 (se llena sola con el tráfico) ═══');
  console.table((await c.query(`
    SELECT count(*) FILTER (WHERE hw_fingerprint LIKE 'fp2\\_%') AS v2,
           count(*) FILTER (WHERE hw_fingerprint IS NOT NULL AND hw_fingerprint NOT LIKE 'fp2\\_%') AS v1,
           count(*) FILTER (WHERE hw_fingerprint IS NULL) AS sin_huella,
           max(last_seen_at) FILTER (WHERE hw_fingerprint LIKE 'fp2\\_%') AS ultima_v2
      FROM user_devices`)).rows);

  console.log('═══ 1.bis ¿Crece? huellas v2 vistas por día ═══');
  console.table((await c.query(`
    SELECT date_trunc('day', last_seen_at)::date AS dia, count(*) AS dispositivos_v2
      FROM user_devices WHERE hw_fingerprint LIKE 'fp2\\_%' AND last_seen_at > now() - interval '7 days'
     GROUP BY 1 ORDER BY 1 DESC`)).rows);

  console.log('═══ 2. Bloqueos: ¿existen y en qué MODO? ═══');
  console.table((await c.query(`
    SELECT metadata->>'mode' AS modo, metadata->>'anchor' AS ancla,
           count(*) AS n, min(ts)::date AS primero, max(ts) AS ultimo
      FROM observable_events
     WHERE event_type='device_daily_limit_blocked'
     GROUP BY 1,2 ORDER BY 5 DESC NULLS LAST`)).rows);

  console.log('═══ 3. Farmeo por dispositivo en 3 días (lo que la alerta vigila) ═══');
  console.table((await c.query(`
    SELECT count(*) AS device_dias_sobre_25
      FROM daily_questions_served
     WHERE subject_kind='device' AND served > 25 AND usage_date > (now() - interval '3 days')::date`)).rows);

  await c.end();
})().catch(e => { console.error('ERROR', e.message); process.exit(1); });
