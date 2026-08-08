require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');
const { pgConfig } = require('../lib/db/pgSsl.cjs');
(async () => {
  const c = new Client(pgConfig(process.env.DATABASE_URL));
  await c.connect();
  const d = await c.query(`SELECT question_id, user_id, created_at FROM question_disputes WHERE id='31f60a80-1deb-4331-be1b-354717957d20'`);
  const QID = d.rows[0].question_id;
  console.log('QID impugnada:', QID);
  // hermanas del art. 85 que preguntan lo MISMO (art 85.1 potestativo)
  const { rows } = await c.query(`SELECT q.id, q.correct_option, q.option_a, q.option_b, q.option_c, q.option_d,
      left(regexp_replace(q.question_text,'\\s+',' ','g'),120) txt,
      (SELECT count(*)::int FROM test_questions t WHERE t.question_id=q.id) servida
    FROM questions q JOIN articles a ON a.id=q.primary_article_id
    WHERE q.is_active AND a.id=(SELECT primary_article_id FROM questions WHERE id=$1)
      AND q.question_text || q.option_a || q.option_b || coalesce(q.option_c,'') || coalesce(q.option_d,'') ILIKE '%reconoce su responsabilidad%'
    ORDER BY servida DESC`, [QID]);
  console.log('\nHermanas del art. 85 sobre "reconoce su responsabilidad": ' + rows.length);
  for (const r of rows) {
    const clave = [r.option_a,r.option_b,r.option_c,r.option_d][r.correct_option];
    console.log(`\n  ${r.id.slice(0,8)}${r.id===QID?' ← LA IMPUGNADA':''} | ${r.servida}x`);
    console.log(`     Q: ${r.txt}`);
    console.log(`     clave: ${(clave||'').slice(0,120)}`);
  }
  // ¿le salió dos veces a Laura en el mismo test?
  const t = await c.query(`SELECT tq.test_id, tq.question_id, tq.created_at FROM test_questions tq
     WHERE tq.user_id=$1 AND tq.created_at > now() - interval '3 days' ORDER BY tq.created_at DESC LIMIT 60`, [d.rows[0].user_id]);
  const porTest = {};
  for (const r of t.rows) { (porTest[r.test_id] ||= []).push(r.question_id); }
  for (const [test, qs] of Object.entries(porTest)) {
    const dup = qs.filter((q,i) => qs.indexOf(q) !== i);
    if (dup.length) console.log(`\n⚠️ test ${test.slice(0,8)} repitió ${dup.length} pregunta(s): ${[...new Set(dup)].map(x=>x.slice(0,8)).join(', ')}`);
  }
  console.log('\ntests recientes de Laura: ' + Object.keys(porTest).length);
  await c.end();
})();
