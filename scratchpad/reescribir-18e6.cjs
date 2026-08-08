require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');
const { pgConfig } = require('../lib/db/pgSsl.cjs');
const QID = '18e6a9b3-fb4d-4c03-ac1b-d8ee61c3013e';
const NUEVO = {
  question_text: 'La Administración podrá convalidar los actos anulables, subsanando los vicios de que adolezcan. Si un acto no determinante de nulidad ha sido dictado por un órgano distinto del competente, siendo el competente su superior jerárquico, la convalidación podrá realizarse por:',
  option_a: 'El propio órgano que dictó el acto viciado.',
  option_b: 'El órgano competente, por ser superior jerárquico del que dictó el acto.',
  option_c: 'El órgano superior jerárquico común a ambos, en todo caso.',
  option_d: 'Cualquier órgano de la misma Administración, mediante acuerdo motivado.',
};
(async () => {
  const c = new Client(pgConfig(process.env.DATABASE_URL));
  await c.connect();
  const antes = (await c.query('SELECT question_text, option_a, option_b, option_c, option_d, correct_option FROM questions WHERE id=$1', [QID])).rows[0];
  console.log('ANTES:', JSON.stringify(antes, null, 1));
  if (!process.argv.includes('--apply')) { console.log('\n(dry-run)'); await c.end(); return; }
  await c.query(`UPDATE questions SET question_text=$2, option_a=$3, option_b=$4, option_c=$5, option_d=$6, updated_at=now() WHERE id=$1`,
    [QID, NUEVO.question_text, NUEVO.option_a, NUEVO.option_b, NUEVO.option_c, NUEVO.option_d]);
  const despues = (await c.query('SELECT question_text, option_a, option_b, option_c, option_d, correct_option FROM questions WHERE id=$1', [QID])).rows[0];
  console.log('\nDESPUÉS:', JSON.stringify(despues, null, 1));
  await c.end();
})();
