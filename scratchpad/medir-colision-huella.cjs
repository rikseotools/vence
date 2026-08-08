// ¿Cuántas cuentas free están topando el cupo del DISPOSITIVO por una huella v2 COMPARTIDA
// entre navegadores/ciudades/IPs distintos (o sea: colisión, no el mismo aparato)?
const { Client } = require('pg');
const { pgConfig } = require('../lib/db/pgSsl.cjs');

(async () => {
  const c = new Client(pgConfig(process.env.DATABASE_URL));
  await c.connect();

  const compartidas = await c.query(`
    SELECT ud.hw_fingerprint AS fp,
           count(DISTINCT ud.user_id)   AS cuentas,
           count(DISTINCT ud.device_id) AS navegadores,
           count(DISTINCT up.ciudad)    AS ciudades,
           count(DISTINCT up.registration_ip) AS ips
      FROM user_devices ud
      JOIN user_profiles up ON up.id = ud.user_id
     WHERE ud.hw_fingerprint LIKE 'fp2\\_%'
       AND ud.last_seen_at > now() - interval '30 days'
     GROUP BY 1
    HAVING count(DISTINCT ud.user_id) > 1
     ORDER BY 2 DESC`);

  console.log(`HUELLAS fp2 compartidas por >1 cuenta (30d): ${compartidas.rowCount}`);
  console.table(compartidas.rows.slice(0, 15).map((r) => ({
    fp: r.fp.slice(0, 18), cuentas: r.cuentas, navegadores: r.navegadores, ciudades: r.ciudades, ips: r.ips,
  })));

  // Colisión probable = tantos navegadores distintos como cuentas Y >1 ciudad.
  const colision = compartidas.rows.filter((r) => Number(r.navegadores) === Number(r.cuentas) && Number(r.ciudades) > 1);
  const cuentasColision = colision.reduce((a, r) => a + Number(r.cuentas), 0);
  console.log(`\nDe ellas, COLISIÓN probable (1 navegador por cuenta y ciudades distintas): ${colision.length} huellas · ${cuentasColision} cuentas`);

  // Cuántas de esas cuentas están HOY topadas por el dispositivo sin haber respondido ellas.
  const fps = colision.map((r) => r.fp);
  if (fps.length) {
    const afectados = await c.query(`
      SELECT up.email, up.plan_type,
             COALESCE(dqu.questions_answered, 0) AS suyas_hoy,
             public.get_device_daily_usage_v2(ud.device_id, ud.hw_fingerprint) AS total_dispositivo
        FROM user_devices ud
        JOIN user_profiles up ON up.id = ud.user_id
        LEFT JOIN daily_question_usage dqu
               ON dqu.user_id = up.id
              AND dqu.usage_date = (now() AT TIME ZONE 'Europe/Madrid')::date
       WHERE ud.hw_fingerprint = ANY($1::text[])
         AND COALESCE(up.plan_type,'free') = 'free'
         AND ud.last_seen_at > now() - interval '30 days'`, [fps]);

    const bloqueados = afectados.rows.filter((r) => Number(r.total_dispositivo) >= 25 && Number(r.suyas_hoy) < 25);
    console.log(`\n🚧 HOY topan el muro SIN haber agotado lo suyo: ${bloqueados.length} cuentas free`);
    console.table(bloqueados.map((r) => ({ email: r.email, suyas_hoy: r.suyas_hoy, total_dispositivo: r.total_dispositivo })));
  }

  await c.end();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
