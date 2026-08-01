const { Client } = require('pg');
const { pgConfig } = require('../../lib/db/pgSsl.cjs');
const L = ['A','B','C','D'];
(async () => {
  const c = new Client(pgConfig()); await c.connect();
  const r = await c.query(`
    SELECT q.id, a.article_number, q.question_text, q.option_a, q.option_b, q.option_c, q.option_d,
           q.correct_option, q.explanation
      FROM questions q JOIN articles a ON a.id=q.primary_article_id
     WHERE 'gen_lig_and_2026-08-01_t146' = ANY(q.tags)
     ORDER BY a.article_number::int, q.created_at`);
  let i = 0;
  for (const q of r.rows) {
    i++;
    const opts = [q.option_a, q.option_b, q.option_c, q.option_d];
    console.log('\n' + '━'.repeat(100));
    console.log(`Q${i} · art ${q.article_number} · clave = ${L[q.correct_option]}`);
    for (let k = 0; k < 4; k++) {
      const esClave = k === q.correct_option;
      const bullet = (q.explanation.match(new RegExp(`- \\*\\*${L[k]}\\)\\*\\* ([^\\n]+)`)) || [])[1];
      console.log(`\n  ${L[k]}${esClave ? ' ✅CLAVE' : ''} [${opts[k].length}ch]: ${opts[k]}`);
      if (esClave) {
        const cab = (q.explanation.match(/\*\*Por qué ([A-D]) es correcta:\*\* ([^\n]+)/) || []);
        console.log(`     ↳ cabecera dice "${cab[1]}": ${cab[2]}`);
      } else {
        console.log(`     ↳ viñeta ${L[k]}): ${bullet || '⚠️ SIN VIÑETA'}`);
      }
    }
  }
  await c.end();
})().catch(e => { console.error('ERROR', e.message); process.exit(1); });
