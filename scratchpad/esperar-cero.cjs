// Espera a que el rollout converja y mide si la tasa de 401 de user-stats llega a cero.
const { execSync } = require('child_process');
const { Client } = require('pg');
const { pgConfig } = require('../lib/db/pgSsl.cjs');

const sh = (c) => execSync(c, { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 }).trim();
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

const despliegues = () => JSON.parse(sh(
  'aws --profile vence --region eu-west-2 ecs describe-services --cluster vence-backend ' +
  '--services vence-frontend --query "services[0].deployments[].{t:taskDefinition,r:rolloutState,c:runningCount}" --output json',
));

(async () => {
  // 1) Esperar convergencia: un solo deployment y COMPLETED.
  let convergido = false;
  for (let i = 0; i < 40; i++) {
    const d = despliegues();
    if (d.length === 1 && d[0].r === 'COMPLETED') {
      console.log(`✅ rollout convergido: ${d[0].t.split('/').pop()} con ${d[0].c} tareas`);
      convergido = true;
      break;
    }
    if (i % 5 === 0) console.log(`… esperando: ${d.map((x) => `${x.t.split('/').pop()}=${x.r}(${x.c})`).join(' · ')}`);
    await dormir(30_000);
  }
  if (!convergido) console.log('⚠️ no convergió en 20 min — mido igualmente lo que haya');

  // 2) Ventana LIMPIA: solo tráfico posterior a la convergencia.
  const desde = new Date();
  console.log(`\n⏳ midiendo 6 min de tráfico posterior a la convergencia (desde ${desde.toISOString().slice(11, 19)})…`);
  await dormir(360_000);

  const c = new Client(pgConfig(process.env.DATABASE_URL));
  await c.connect();
  const r = await c.query(`
    SELECT count(*) FILTER (WHERE http_status = 401)          AS c401,
           count(*) FILTER (WHERE http_status IS NOT NULL)     AS total,
           count(DISTINCT user_id) FILTER (WHERE http_status = 401) AS usuarios
      FROM observable_events
     WHERE endpoint LIKE '%user-stats%' AND ts > $1`, [desde.toISOString()]);
  const { c401, total, usuarios } = r.rows[0];
  const pct = Number(total) > 0 ? ((Number(c401) / Number(total)) * 100).toFixed(1) : null;
  console.log(`\n── VENTANA LIMPIA (tras converger) ──`);
  console.log(`   peticiones: ${total} · 401: ${c401} · usuarios con 401: ${usuarios}`);
  console.log(`   tasa de fallo: ${pct === null ? 'sin tráfico en la ventana' : pct + '%'}   (era 95-100% antes del arreglo)`);
  if (pct !== null && Number(pct) === 0) console.log('\n✅ CERO: ninguna petición de estadísticas falla ya.');
  else if (pct !== null && Number(pct) < 10) console.log('\n🟢 residual bajo — comprobar si son sesiones de verdad caducadas (lo normal) y no el bug.');
  else if (pct !== null) console.log('\n⚠️ sigue alto: NO dar por arreglado.');
  await c.end();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
