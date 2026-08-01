const fs = require('fs');
const { Client } = require('pg');
const { pgConfig } = require('../../lib/db/pgSsl.cjs');
const F = 'scratchpad/t115e/borrador.json';
const BATCH = 'gen_lcsp5_2026-07-31_t115e';

let raw = fs.readFileSync(F, 'utf8');
const antes = (raw.match(/\[…\]/g) || []).length;
// El marcador de elipsis rompe la comparación literal del gate: la cita se recorta a
// un fragmento CONTIGUO del artículo, que es lo que el blockquote debe acreditar.
raw = raw.split('\\"[…] ').join('\\"').split(' […]\\"').join('\\"');
const despues = (raw.match(/\[…\]/g) || []).length;
fs.writeFileSync(F, raw);
console.log(`marcadores […]: ${antes} → ${despues}`);

const preguntas = JSON.parse(raw);
(async () => {
  const c = new Client(pgConfig()); await c.connect();
  let n = 0;
  for (const q of preguntas) {
    const r = await c.query(
      `UPDATE questions SET explanation=$1
        WHERE question_text=$2 AND $3 = ANY(tags) AND explanation IS DISTINCT FROM $1
        RETURNING id`, [q.explanation, q.question_text, BATCH]);
    if (r.rowCount) { n++; console.log('  actualizada', r.rows[0].id); }
  }
  console.log(`explicaciones reescritas en BD: ${n}`);
  await c.end();
})().catch(e => { console.error('ERROR', e.message); process.exit(1); });
