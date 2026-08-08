require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');
const { pgConfig } = require('../lib/db/pgSsl.cjs');
(async () => {
  const c = new Client(pgConfig(process.env.DATABASE_URL));
  await c.connect();
  const QID = '18e6a9b3-fb4d-4c03-ac1b-d8ee61c3013e';
  const cols = await c.query(`SELECT column_name FROM information_schema.columns WHERE table_name='topic_scope'`);
  console.log('cols topic_scope:', cols.rows.map(r=>r.column_name).join(', '));
  const srv = await c.query(`SELECT count(*)::int n, count(DISTINCT user_id)::int usuarios, max(created_at) ultima FROM test_questions WHERE question_id=$1`, [QID]);
  console.log('servida:', JSON.stringify(srv.rows[0]));
  // lote Aula Plus autonómica: ¿cuántas activas y cuántas nombran una CCAA concreta?
  const lote = await c.query(`SELECT count(*)::int total,
      count(*) FILTER (WHERE question_text ~* '(Aragon|Aragón|Aragonés|Zaragoza|Huesca|Teruel)')::int aragon
    FROM questions WHERE is_active AND exam_source = 'Aula Plus - Legislación autonómica'`);
  console.log('lote Aula Plus autonómica:', JSON.stringify(lote.rows[0]));
  // de ese lote, las que cuelgan de ley NACIONAL (=> se sirven a todas las oposiciones)
  const nac = await c.query(`SELECT count(*)::int n FROM questions q JOIN articles a ON a.id=q.primary_article_id JOIN laws l ON l.id=a.law_id
     WHERE q.is_active AND q.exam_source='Aula Plus - Legislación autonómica' AND coalesce(l.scope,'national')='national'
       AND q.question_text ~* '(Aragonés|Zaragoza|Gerente del Sector|Servicio Andaluz|Xunta|Generalitat|Junta de Castilla)'`);
  console.log('del lote, regionales colgadas de ley NACIONAL:', nac.rows[0].n);
  const ej = await c.query(`SELECT q.id, l.short_name, left(regexp_replace(q.question_text,'\\s+',' ','g'),110) txt
     FROM questions q JOIN articles a ON a.id=q.primary_article_id JOIN laws l ON l.id=a.law_id
     WHERE q.is_active AND q.exam_source='Aula Plus - Legislación autonómica' AND coalesce(l.scope,'national')='national'
       AND q.question_text ~* '(Aragonés|Zaragoza|Gerente del Sector|Servicio Andaluz|Xunta|Generalitat|Junta de Castilla)' LIMIT 15`);
  for (const r of ej.rows) console.log('  ' + r.id.slice(0,8) + ' | ' + r.short_name + ' | ' + r.txt);
  await c.end();
})();
