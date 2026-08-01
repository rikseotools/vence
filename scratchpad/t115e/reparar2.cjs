const fs = require('fs');
const { Client } = require('pg');
const { pgConfig } = require('../../lib/db/pgSsl.cjs');
const F = 'scratchpad/t115e/borrador.json';
const BATCH = 'gen_lcsp5_2026-07-31_t115e';

const VIEJA = '- **C)** El límite no lo fija la designación que haga el adjudicatario, sino la difusión restringida del documento; y los informes que genere el órgano de contratación no quedan excluidos en bloque, sino solo en cuanto no puedan cubrirse por entero.';
const NUEVA = '- **C)** El límite no lo fija la designación que haga el adjudicatario, sino la difusión restringida del documento; y respecto de los informes que genere el órgano de contratación, lo que el artículo impide es que la confidencialidad alcance a todo su contenido, no que pueda alcanzar a una parte de él.';

let raw = fs.readFileSync(F, 'utf8');
if (!raw.includes(VIEJA)) { console.error('❌ no encuentro la viñeta en el borrador'); process.exit(1); }
raw = raw.replace(VIEJA, NUEVA);
fs.writeFileSync(F, raw);
console.log('✅ borrador actualizado');

(async () => {
  const c = new Client(pgConfig()); await c.connect();
  const r = await c.query(
    `UPDATE questions SET explanation = replace(explanation, $1, $2)
      WHERE $3 = ANY(tags) AND explanation LIKE '%' || $1 || '%'
      RETURNING id`, [VIEJA, NUEVA, BATCH]);
  console.log(`✅ filas reparadas en BD: ${r.rowCount}`, r.rows.map(x => x.id).join(', '));
  await c.end();
})().catch(e => { console.error('ERROR', e.message); process.exit(1); });
