require('dotenv').config({ path: '.env.local' });
const { pgConfig } = require('../lib/db/pgSsl.cjs');
const { Client } = require('pg');
const PALABRAS = ['articulo','articulos','segun','tambien','aprobacion','informacion',
                  'administracion','organo','organos','mocion','cuestion','dimision',
                  'celebracion','regimen','proteccion','resolucion','sancion'];
const RE = new RegExp('\\b(' + PALABRAS.join('|') + ')\\b', 'gi');
const PAT = '\\m(' + PALABRAS.join('|') + ')\\M';
(async () => {
  const c = new Client(pgConfig()); await c.connect();
  const rows = (await c.query(
    `SELECT id, explanation FROM questions WHERE is_active AND explanation ~ $1
      ORDER BY md5(id::text) LIMIT 12`, [PAT])).rows;
  const conteo = {};
  for (const r of rows) {
    const hits = [...new Set((r.explanation.match(RE) || []).map(s => s.toLowerCase()))];
    hits.forEach(h => conteo[h] = (conteo[h] || 0) + 1);
    console.log(r.id.slice(0, 8), '→', hits.join(', '));
  }
  console.log('\nreparto en la muestra:', conteo);
  // reparto global por palabra
  console.log('\n--- reparto GLOBAL por palabra disparadora ---');
  for (const p of PALABRAS) {
    const [{ n }] = (await c.query(
      `SELECT count(*) n FROM questions WHERE is_active AND explanation ~ $1`,
      ['\\m' + p + '\\M'])).rows;
    if (+n) console.log('  ', p.padEnd(16), n);
  }
  await c.end();
})();
