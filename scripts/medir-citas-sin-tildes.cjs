require('dotenv').config({ path: '.env.local' });
const { pgConfig } = require('../lib/db/pgSsl.cjs');
const { Client } = require('pg');

// SOLO palabras cuya forma sin tilde NO existe en español.
// Descartadas a propósito, y cada una es un falso positivo medido:
//  · PLURALES que pierden la tilde y por tanto son correctos sin ella:
//    funciones, sanciones, mociones, cuestiones, resoluciones, administraciones.
//  · FORMAS VERBALES / adjetivos válidos sin tilde: publico, publica, titulo,
//    numero, capitulo (yo capitulo), perdida (la oportunidad perdida).
// Solo se listan SINGULARES cuya versión sin tilde no es palabra.
const PALABRAS = ['articulo','articulos','segun','tambien','aprobacion','informacion',
                  'administracion','organo','organos','mocion','cuestion','dimision',
                  'celebracion','regimen','proteccion','resolucion','sancion'];
const PAT = '\\m(' + PALABRAS.join('|') + ')\\M';

(async () => {
  const c = new Client(pgConfig()); await c.connect();
  const q = async (sql, p) => (await c.query(sql, p)).rows;

  const [{ n: total }] = await q(
    `SELECT count(*) n FROM questions WHERE is_active AND explanation IS NOT NULL`);
  const [{ n: hits }] = await q(
    `SELECT count(*) n FROM questions WHERE is_active AND explanation ~ $1`, [PAT]);
  const [{ n: conCita }] = await q(
    `SELECT count(*) n FROM questions WHERE is_active AND explanation ~ $1
       AND explanation ~ '(^|\n)>'`, [PAT]);
  const [{ n: transcritas }] = await q(
    `SELECT count(*) n FROM questions WHERE is_active AND explanation ~ $1
       AND explanation_data IS NOT NULL`, [PAT]);

  console.log('activas con explicación            :', total);
  console.log('con palabra imposible sin tilde    :', hits, `(${(hits/total*100).toFixed(1)}%)`);
  console.log('  · con blockquote (cita "literal") :', conCita);
  console.log('  · ya transcritas a explanation_data:', transcritas);

  console.log('\n--- 5 al azar, para LEERLAS (no fiarse del número) ---');
  for (const r of await q(
    `SELECT id, left(explanation, 180) e FROM questions
      WHERE is_active AND explanation ~ $1 ORDER BY md5(id::text) LIMIT 5`, [PAT])) {
    console.log(' •', r.id, '\n   ', r.e.replace(/\n/g, ' | '));
  }
  await c.end();
})();
