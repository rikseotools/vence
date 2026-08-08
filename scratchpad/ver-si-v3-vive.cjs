// ¿El código VIVO llama ya a la v3? Se mide por el DELTA de llamadas, no por el acumulado:
// las de `AS t` son de las comprobaciones a mano; las de la app llevan `AS total`.
const { Client } = require('pg');
const { pgConfig } = require('../lib/db/pgSsl.cjs');

const foto = async (c) => {
  const r = await c.query(`
    SELECT left(query, 60) AS q, calls
      FROM pg_stat_statements
     WHERE query ILIKE '%get_device_daily_usage%' AND query ILIKE '%AS total%'`);
  return Object.fromEntries(r.rows.map((x) => [x.q.includes('_v3') ? 'v3' : x.q.includes('_v2') ? 'v2' : 'v1', Number(x.calls)]));
};

(async () => {
  const c = new Client(pgConfig(process.env.DATABASE_URL));
  await c.connect();
  const a = await foto(c);
  console.log('t0:', JSON.stringify(a));
  await new Promise((r) => setTimeout(r, 300_000));
  const b = await foto(c);
  console.log('t+300s:', JSON.stringify(b));
  const delta = (k) => (b[k] ?? 0) - (a[k] ?? 0);
  console.log(`\nDELTA en 5 min →  v1: ${delta('v1')}  ·  v2: ${delta('v2')}  ·  v3: ${delta('v3')}`);
  if (delta('v3') > 0 && delta('v2') === 0) console.log('✅ el código vivo llama SOLO a la v3');
  else if (delta('v3') > 0) console.log('🟡 v3 viva, pero algo sigue llamando a la v2 (¿backend sin desplegar?)');
  else if (delta('v2') > 0) console.log('❌ sigue usándose la v2: el arreglo NO está sirviendo');
  else console.log('⏸️ sin tráfico en la ventana — repetir con más tiempo');
  await c.end();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
