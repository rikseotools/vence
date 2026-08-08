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
const UID = '355d33fb-3b85-43cd-aedb-aa9d0e546005';       // el usuario que lo reportó
const EMAIL = 'papaevo69@gmail.com';
const DEVICE = 'c50957ca-8d92-41a6-80be-0b05a7d84e6d';    // SU navegador
const FP = 'fp2_5ac2ab39a0b7b408d88cac2d1b32911a';        // la huella que comparten 9 desconocidos

const llamadasV3 = async (c) => {
  const r = await c.query(`
    SELECT COALESCE(SUM(calls),0)::int AS n FROM pg_stat_statements
     WHERE query ILIKE '%get_device_daily_usage_v3%' AND query ILIKE '%AS total%'`);
  return r.rows[0].n;
};

(async () => {
  // Las claves se traen de SSM a ficheros del scratchpad (no van al repo ni al entorno).
  const fs = require('fs');
  const SP = '/tmp/claude-1000/-home-manuel-vence-sessions-movil4/71a6edf6-9027-45ad-8fff-98d8fbb633a7/scratchpad';
  const pem = fs.readFileSync(`${SP}/pk.txt`, 'utf8').trim();
  const kid = fs.readFileSync(`${SP}/kid.txt`, 'utf8').trim();
  if (!pem || !kid) throw new Error('faltan AUTH_JWT_PRIVATE_KEY / AUTH_JWT_KID');

  const key = await importPKCS8(pem.replace(/\\n/g, '\n'), 'RS256');
  const now = Math.floor(Date.now() / 1000);
  const token = await new SignJWT({ email: EMAIL, role: 'authenticated' })
    .setProtectedHeader({ alg: 'RS256', kid })
    .setSubject(UID)
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
      'x-device-id': DEVICE,
      'x-hw-fingerprint': FP,
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
      WHERE user_id = $1 AND usage_date = (now() AT TIME ZONE 'Europe/Madrid')::date`, [UID])).rows[0]?.n ?? 0;
  const v2 = (await c.query('SELECT get_device_daily_usage_v2($1,$2) AS t', [DEVICE, FP])).rows[0].t;

  console.log(`\n  respondidas por él hoy ......... ${suyas}`);
  console.log(`  lo que decía el ancla vieja .... ${v2}   (muro a partir de 25)`);
  console.log(`  lo que le dice producción AHORA . ${hoy}`);
  console.log(`  llamadas a la función corroborada: ${antes} → ${despues}`);

  const ok = Number(hoy) === Number(suyas) && Number(hoy) < 25;
  console.log(`\n${ok ? '✅ VERIFICADO: el muro ya no se le levanta' : '❌ SIGUE BLOQUEADO'}`);
  console.log(despues > antes ? '✅ el código vivo usa la función corroborada' : '⚠️ no se registró llamada a la v3 (¿caché?)');

  await c.end();
  process.exit(ok ? 0 : 1);
})().catch((e) => { console.error('ERR', e.message); process.exit(2); });
