// ¿Sirve exigir IP COMPARTIDA para agrupar cuentas bajo la misma huella?
// Se mide contra los dos lados: los CONFIRMADOS (tiene que seguir cazándolos)
// y las colisiones de modelo (tiene que dejar de agruparlas).
const { Client } = require('pg');
const { pgConfig } = require('../lib/db/pgSsl.cjs');

// Cuántas IPs distintas comparten entre sí las cuentas de una huella.
const SQL_IPS = `
  WITH cuentas AS (
    SELECT DISTINCT ud.user_id FROM user_devices ud
     WHERE ud.hw_fingerprint = $1 AND ud.last_seen_at > now() - interval '30 days'
  ), ips AS (
    SELECT s.user_id, s.ip_address
      FROM user_sessions s
     WHERE s.user_id IN (SELECT user_id FROM cuentas)
       AND s.ip_address IS NOT NULL
       AND s.created_at > now() - interval '30 days'
     GROUP BY 1,2
  )
  SELECT count(DISTINCT user_id) AS cuentas_con_ip,
         count(*) FILTER (WHERE compartida) AS pares_ip_compartida,
         count(DISTINCT ip_address) FILTER (WHERE compartida) AS ips_compartidas
    FROM (
      SELECT i.*, EXISTS (
        SELECT 1 FROM ips j WHERE j.ip_address = i.ip_address AND j.user_id <> i.user_id
      ) AS compartida FROM ips i
    ) z`;

(async () => {
  const c = new Client(pgConfig(process.env.DATABASE_URL));
  await c.connect();

  const confirmados = await c.query(`
    SELECT fingerprint, device_id, array_length(user_ids,1) AS n_cuentas
      FROM fraud_confirmations
     WHERE status='confirmed' AND retention_until > now() AND fingerprint LIKE 'fp2\\_%'`);
  console.log(`CONFIRMADOS con huella v2: ${confirmados.rowCount}`);
  for (const f of confirmados.rows) {
    const r = await c.query(SQL_IPS, [f.fingerprint]);
    console.log(`  ${f.fingerprint.slice(0, 16)} · cuentas confirmadas ${f.n_cuentas} · ` +
      `con IP conocida ${r.rows[0].cuentas_con_ip} · IPs compartidas entre ellas: ${r.rows[0].ips_compartidas}` +
      `  → ${Number(r.rows[0].ips_compartidas) > 0 ? '✅ la corroboración por IP LO SIGUE CAZANDO' : '⚠️ se escaparía'}`);
  }

  const colisiones = await c.query(`
    SELECT ud.hw_fingerprint AS fp, count(DISTINCT ud.user_id) AS cuentas,
           count(DISTINCT ud.device_id) AS navegadores, count(DISTINCT up.ciudad) AS ciudades
      FROM user_devices ud JOIN user_profiles up ON up.id = ud.user_id
     WHERE ud.hw_fingerprint LIKE 'fp2\\_%' AND ud.last_seen_at > now() - interval '30 days'
     GROUP BY 1 HAVING count(DISTINCT ud.user_id) > 1
     ORDER BY 2 DESC LIMIT 25`);

  console.log(`\nHUELLAS COMPARTIDAS (top ${colisiones.rowCount}) — ¿comparten IP de verdad?`);
  let sinIp = 0;
  for (const f of colisiones.rows) {
    const r = await c.query(SQL_IPS, [f.fp]);
    const comparten = Number(r.rows[0].ips_compartidas) > 0;
    if (!comparten) sinIp++;
    console.log(`  ${f.fp.slice(0, 16)} · ${f.cuentas} cuentas / ${f.navegadores} navegadores / ${f.ciudades} ciudades` +
      ` · IPs compartidas: ${r.rows[0].ips_compartidas} ${comparten ? '← se seguirían agrupando' : '← DEJAN de agruparse'}`);
  }
  console.log(`\nDe las ${colisiones.rowCount} medidas, ${sinIp} dejarían de agruparse por no compartir ninguna IP.`);

  await c.end();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
