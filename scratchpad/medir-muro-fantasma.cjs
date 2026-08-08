// ¿El muro del cliente (T-418) está parando a gente a la que el servidor NO corta (modo shadow)?
const { Client } = require('pg');
const { pgConfig } = require('../lib/db/pgSsl.cjs');

(async () => {
  const c = new Client(pgConfig(process.env.DATABASE_URL));
  await c.connect();

  const ev = await c.query(`
    SELECT date_trunc('day', created_at) AS dia,
           count(*) AS bloqueos,
           count(DISTINCT user_id) AS usuarios,
           count(*) FILTER (WHERE metadata->>'mode' = 'shadow') AS en_sombra,
           count(*) FILTER (WHERE (metadata->>'dirigido')::boolean) AS dirigidos,
           count(*) FILTER (WHERE metadata->>'anchor' = 'fingerprint_v2') AS por_huella
      FROM observable_events
     WHERE event_type = 'device_daily_limit_blocked'
       AND created_at > now() - interval '14 days'
     GROUP BY 1 ORDER BY 1 DESC`);
  console.log('Eventos device_daily_limit_blocked (14d):');
  console.table(ev.rows);

  // Tests abiertos y abandonados sin una sola respuesta, por día, en cuentas free.
  const abandonos = await c.query(`
    SELECT date_trunc('day', t.created_at)::date AS dia,
           count(*) AS tests_abiertos,
           count(*) FILTER (WHERE tq.n = 0) AS sin_una_sola_respuesta,
           count(DISTINCT t.user_id) FILTER (WHERE tq.n = 0) AS usuarios
      FROM tests t
      JOIN user_profiles up ON up.id = t.user_id AND COALESCE(up.plan_type,'free') = 'free'
      LEFT JOIN LATERAL (SELECT count(*) AS n FROM test_questions q WHERE q.test_id = t.id) tq ON true
     WHERE t.created_at > now() - interval '18 days'
     GROUP BY 1 ORDER BY 1`);
  console.log('\nTests de cuentas FREE abiertos y abandonados sin responder nada:');
  console.table(abandonos.rows.map((r) => ({
    dia: r.dia.toISOString().slice(0, 10),
    tests: r.tests_abiertos,
    sin_responder: r.sin_una_sola_respuesta,
    pct: Math.round((r.sin_una_sola_respuesta / r.tests_abiertos) * 100) + '%',
    usuarios: r.usuarios,
  })));

  await c.end();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
