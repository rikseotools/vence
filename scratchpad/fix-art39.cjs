require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');
const { pgConfig } = require('../lib/db/pgSsl.cjs');
(async () => {
  const c = new Client(pgConfig(process.env.DATABASE_URL));
  await c.connect();
  const QID = (await c.query(`SELECT question_id FROM question_disputes WHERE id='42b80516-9f43-4bb8-b8bc-5fda737221f9'`)).rows[0].question_id;
  console.log('QID:', QID);
  const antes = (await c.query('SELECT option_a, option_c, correct_option FROM questions WHERE id=$1',[QID])).rows[0];
  console.log('ANTES:', JSON.stringify(antes, null, 1));
  if (!process.argv.includes('--apply')) { await c.end(); return; }
  await c.query(`UPDATE questions SET
      option_a='Los actos de las Administraciones Públicas sujetos al Derecho Administrativo producirán efectos desde la fecha en que se dicten, salvo que en ellos se disponga otra cosa.',
      option_c='La eficacia de los actos de las Administraciones Públicas no podrá quedar demorada por su notificación o publicación.',
      updated_at=now() WHERE id=$1`, [QID]);
  const d = (await c.query('SELECT option_a, option_b, option_c, option_d, correct_option FROM questions WHERE id=$1',[QID])).rows[0];
  console.log('\nDESPUÉS:', JSON.stringify(d, null, 1));
  await c.end();
})();
