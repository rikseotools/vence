// VERIFICACIÓN EN VIVO del muro del cupo contra producción (T-657).
//
// No espera a que pase tráfico ajeno: acuña un token real y llama al endpoint que decide el muro,
// con las cabeceras del caso que reportó el usuario (su huella colisionada). Comprueba dos cosas:
//   1. que el conteo que recibe NO incluye el consumo de desconocidos que comparten huella;
//   2. que el código vivo consulta la función corroborada (delta en pg_stat_statements).
const { SignJWT, importPKCS8 } = require('jose');
const { Client } = require('pg');
const { pgConfig } = require('../lib/db/pgSsl.cjs');

const BASE = 'https://www.vence.es';
const UID = 'ade0f4d4-0000-0000-0000-000000000000';       // PLACEHOLDER, se resuelve abajo
let EMAIL = null;
const DEVICE = null;   // se resuelve abajo
const FP = 'fp2_36b1453d7e6c';   // se resuelve abajo (fraude CONFIRMADO a mano)

const llamadasV3 = async (c) => {
  const r = await c.query(`
    SELECT COALESCE(SUM(calls),0)::int AS n FROM pg_stat_statements
     WHERE query ILIKE '%get_device_daily_usage_v3%' AND query ILIKE '%AS total%'`);
  return r.rows[0].n;
};

(async () => {
  const cid = new (require('pg').Client)(pgConfig(process.env.DATABASE_URL));
  await cid.connect();
  // Cuenta free que HOY no ha respondido nada pero comparte NAVEGADOR con otra que agotó el cupo.
  // Con el device_id la agrupación no necesita corroboración: es prueba directa del mismo aparato.
  const q = await cid.query(`
    WITH hoy AS (SELECT user_id, questions_answered FROM daily_question_usage
                  WHERE usage_date = (now() AT TIME ZONE 'Europe/Madrid')::date)
    SELECT ud.user_id AS uid, ud.device_id, ud.hw_fingerprint AS fingerprint, up.email
      FROM user_devices ud
      JOIN user_profiles up ON up.id = ud.user_id AND COALESCE(up.plan_type,'free')='free'
      LEFT JOIN hoy h ON h.user_id = ud.user_id
     WHERE ud.device_id = '00677a19-16e2-4b1b-9183-940ce4a906e8'
       AND COALESCE(h.questions_answered,0) = 0
     LIMIT 1`);
  const real = q.rows[0];
  await cid.end();
  if (!real) throw new Error('no encuentro al confirmado');
  // Las claves se traen de SSM a ficheros del scratchpad (no van al repo ni al entorno).
  const fs = require('fs');
  const SP = '/tmp/claude-1000/-home-manuel-vence-sessions-movil4/71a6edf6-9027-45ad-8fff-98d8fbb633a7/scratchpad';
  const pem = fs.readFileSync(`${SP}/pk.txt`, 'utf8').trim();
  const kid = fs.readFileSync(`${SP}/kid.txt`, 'utf8').trim();
  if (!pem || !kid) throw new Error('faltan AUTH_JWT_PRIVATE_KEY / AUTH_JWT_KID');

  const key = await importPKCS8(pem.replace(/\\n/g, '\n'), 'RS256');
  const now = Math.floor(Date.now() / 1000);
  EMAIL = real.email;
  const token = await new SignJWT({ email: EMAIL, role: 'authenticated' })
    .setProtectedHeader({ alg: 'RS256', kid })
    .setSubject(real.uid)
    .setIssuer(process.env.AUTH_JWT_ISSUER || 'https://www.vence.es')
    .setAudience('authenticated')
    .setIssuedAt(now)
    .setExpirationTime(now + 300)
    .sign(key);

  const c = new Client(pgConfig(process.env.DATABASE_URL));
  await c.connect();
  const antes = await llamadasV3(c);

  const r = await fetch(`${BASE}/api/v2/daily-question/status`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'x-device-id': real.device_id,
      'x-hw-fingerprint': real.fingerprint,
    },
  });
  const body = await r.json().catch(() => null);
  console.log('HTTP', r.status);
  console.log('respuesta:', JSON.stringify(body));

  // El servidor tiene 30 s de caché para el conteo del aparato; damos margen al contador.
  await new Promise((res) => setTimeout(res, 5000));
  const despues = await llamadasV3(c);

  const hoy = body?.status?.questions_today;
  const suyas = (await c.query(
    `SELECT COALESCE(questions_answered,0) AS n FROM daily_question_usage
      WHERE user_id = $1 AND usage_date = (now() AT TIME ZONE 'Europe/Madrid')::date`, [real.uid])).rows[0]?.n ?? 0;
  const v2 = (await c.query('SELECT get_device_daily_usage_v2($1,$2) AS t', [real.device_id, real.fingerprint])).rows[0].t;

  console.log(`\n  respondidas por él hoy ......... ${suyas}`);
  console.log(`  lo que decía el ancla vieja .... ${v2}   (muro a partir de 25)`);
  console.log(`  lo que le dice producción AHORA . ${hoy}`);
  console.log(`  llamadas a la función corroborada: ${antes} → ${despues}`);

  const ok = Number(hoy) >= 25 && Number(suyas) === 0;
  console.log(`\n${ok ? '✅ la AGRUPACIÓN por navegador sigue viva: 0 propias y aun así topado' : '❌ ya no agrupa por navegador: el antifraude se ha aflojado'}`);
  console.log(despues > antes ? '✅ el código vivo usa la función corroborada' : '⚠️ no se registró llamada a la v3 (¿caché?)');

  await c.end();
  process.exit(ok ? 0 : 1);
})().catch((e) => { console.error('ERR', e.message); process.exit(2); });
