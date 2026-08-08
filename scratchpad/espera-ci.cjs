// Espera a que el CI del commit 86bd8ee2 diga algo. Verifica el arreglo de T-370:
// si vuelve `sin_base_de_datos`, el secret DATABASE_URL_REPLICA tampoco estaba.
// Si aparece `tests_en_rojo` o `landings_incoherentes`, la BD YA llega (el gate por fin verifica).
// Si no aparece nada en 18 min, el job terminó limpio.
require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');
const { pgConfig } = require('../lib/db/pgSsl.cjs');
const DESDE = new Date();
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const c = new Client(pgConfig(process.env.DATABASE_URL));
  await c.connect();
  for (let i = 1; i <= 18; i++) {
    const { rows } = await c.query(
      `SELECT ts, event_type, deploy_version sha, metadata->>'causa' causa, metadata->>'runUrl' url
         FROM observable_events
        WHERE event_type IN ('ci_integracion_rojo','workflow_failed','workflow_failure')
          AND ts > $1 ORDER BY ts DESC LIMIT 5`, [DESDE]);
    if (rows.length) {
      console.log(`\nSEÑAL DE CI tras el push (minuto ${i}):`);
      rows.forEach((r) => console.log(`  ${r.ts.toISOString().slice(11,19)} ${r.event_type} sha=${r.sha} causa=${r.causa || '-'} ${r.url || ''}`));
      await c.end();
      return;
    }
    process.stdout.write(`.`);
    await dormir(60_000);
  }
  console.log('\n18 min sin ninguna señal de CI: el gate no se ha quejado (ni sin_base_de_datos ni tests_en_rojo).');
  await c.end();
})();
