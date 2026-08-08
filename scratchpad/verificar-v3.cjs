// Verifica la v3 contra los dos lados: los legítimos dejan de agruparse, el confirmado no.
const { Client } = require('pg');
const { pgConfig } = require('../lib/db/pgSsl.cjs');

(async () => {
  const c = new Client(pgConfig(process.env.DATABASE_URL));
  await c.connect();

  // 1) Diego: su navegador, su huella. La IP con la que entra hoy.
  const diego = await c.query(`
    SELECT ud.device_id, ud.hw_fingerprint,
           (SELECT s.ip_address FROM user_sessions s
             WHERE s.user_id = ud.user_id AND s.ip_address IS NOT NULL
             ORDER BY s.created_at DESC LIMIT 1) AS ip
      FROM user_devices ud WHERE ud.user_id = '355d33fb-3b85-43cd-aedb-aa9d0e546005'`);
  for (const d of diego.rows) {
    const v2 = await c.query('SELECT get_device_daily_usage_v2($1,$2) AS t', [d.device_id, d.hw_fingerprint]);
    const v3 = await c.query('SELECT get_device_daily_usage_v3($1,$2,$3) AS t', [d.device_id, d.hw_fingerprint, d.ip]);
    console.log(`DIEGO · v2 = ${v2.rows[0].t}  →  v3 = ${v3.rows[0].t}   (muro a partir de 25)`);
  }

  // 2) Los 59 medidos esta mañana: ¿cuántos siguen topados con la v3?
  const antes = await c.query(`
    SELECT ud.user_id, ud.device_id, ud.hw_fingerprint,
           COALESCE(dqu.questions_answered,0) AS suyas,
           (SELECT s.ip_address FROM user_sessions s
             WHERE s.user_id = ud.user_id AND s.ip_address IS NOT NULL
             ORDER BY s.created_at DESC LIMIT 1) AS ip
      FROM user_devices ud
      JOIN user_profiles up ON up.id = ud.user_id AND COALESCE(up.plan_type,'free')='free'
      LEFT JOIN daily_question_usage dqu ON dqu.user_id = ud.user_id
             AND dqu.usage_date = (now() AT TIME ZONE 'Europe/Madrid')::date
     WHERE ud.hw_fingerprint LIKE 'fp2\\_%' AND ud.last_seen_at > now() - interval '30 days'`);

  let topadosV2 = 0, topadosV3 = 0, liberados = 0;
  for (const u of antes.rows) {
    const v2 = Number((await c.query('SELECT get_device_daily_usage_v2($1,$2) AS t', [u.device_id, u.hw_fingerprint])).rows[0].t);
    if (!(v2 >= 25 && Number(u.suyas) < 25)) continue;
    topadosV2++;
    const v3 = Number((await c.query('SELECT get_device_daily_usage_v3($1,$2,$3) AS t', [u.device_id, u.hw_fingerprint, u.ip])).rows[0].t);
    if (v3 >= 25 && Number(u.suyas) < 25) topadosV3++; else liberados++;
  }
  console.log(`\nTopados sin haber agotado lo suyo:  v2 = ${topadosV2}  →  v3 = ${topadosV3}   (liberados: ${liberados})`);

  // 3) El confirmado tiene que SEGUIR agrupado.
  const conf = await c.query(`
    SELECT fc.fingerprint, fc.device_id, u AS user_id,
           (SELECT s.ip_address FROM user_sessions s
             WHERE s.user_id = u AND s.ip_address IS NOT NULL
             ORDER BY s.created_at DESC LIMIT 1) AS ip
      FROM fraud_confirmations fc, unnest(fc.user_ids) AS u
     WHERE fc.status='confirmed' AND fc.retention_until > now() AND fc.fingerprint LIKE 'fp2\\_%'`);
  console.log('\nCONFIRMADOS (tienen que seguir sumando entre ellos):');
  for (const f of conf.rows) {
    const v2 = (await c.query('SELECT get_device_daily_usage_v2($1,$2) AS t', [f.device_id, f.fingerprint])).rows[0].t;
    const v3 = (await c.query('SELECT get_device_daily_usage_v3($1,$2,$3) AS t', [f.device_id, f.fingerprint, f.ip])).rows[0].t;
    console.log(`  ${f.fingerprint.slice(0,16)} · usuario ${String(f.user_id).slice(0,8)} · v2=${v2} → v3=${v3} ${String(v2)===String(v3)?'✅ igual':'⚠️ CAMBIA'}`);
  }

  await c.end();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
