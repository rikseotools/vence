require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');
const { pgConfig } = require('../lib/db/pgSsl.cjs');
(async () => {
  const c = new Client(pgConfig(process.env.DATABASE_URL));
  await c.connect();
  const d = await c.query(`SELECT question_id, user_id FROM question_disputes WHERE id=$1`, ['78eba495-b0ed-4126-a04d-5aa008368b0c']);
  const qid = d.rows[0].question_id;
  const q = await c.query(`SELECT id, exam_position, exam_source, tags, is_official_exam, lifecycle_state, created_at, primary_article_id FROM questions WHERE id=$1`, [qid]);
  console.log('PREGUNTA:', JSON.stringify(q.rows[0], null, 1));
  const u = await c.query(`SELECT target_oposicion, plan_type FROM user_profiles WHERE id=$1`, [d.rows[0].user_id]);
  console.log('USUARIA:', JSON.stringify(u.rows[0]));

  // ¿en qué temas/oposiciones se sirve el artículo 52?
  const sc = await c.query(`SELECT DISTINCT ts.position_type FROM topic_scope ts JOIN laws l ON l.id=ts.law_id
     JOIN articles a ON a.law_id=l.id AND a.id=$1
     WHERE '52' = ANY(ts.article_numbers) OR ts.article_numbers IS NULL AND ts.law_id=a.law_id`, [q.rows[0].primary_article_id]);
  console.log('oposiciones que escopan ese artículo:', sc.rows.length);

  // ¿cuántas veces se le ha servido a usuarios de otras oposiciones?
  const srv = await c.query(`SELECT count(*)::int AS n, count(DISTINCT tq.user_id)::int AS usuarios
     FROM test_questions tq WHERE tq.question_id=$1`, [qid]).catch(e => ({rows:[{err:e.message}]}));
  console.log('servida:', JSON.stringify(srv.rows[0]));

  // HERMANAS regionales de Aragón colgadas de leyes NACIONALES
  const reg = await c.query(`SELECT q.id, q.exam_position, left(q.question_text, 95) AS txt, l.short_name
     FROM questions q JOIN articles a ON a.id=q.primary_article_id JOIN laws l ON l.id=a.law_id
     WHERE q.is_active AND l.scope = 'national'
       AND (q.question_text ILIKE '%Servicio Aragonés de Salud%' OR q.question_text ILIKE '%Gerente del Sector%' OR q.question_text ILIKE '%Zaragoza I%')
     ORDER BY l.short_name LIMIT 30`).catch(e => ({rows:[{err:e.message}]}));
  console.log('\nREGIONALES ARAGÓN colgadas de ley nacional: ' + reg.rows.length);
  for (const r of reg.rows) console.log('  ' + (r.id||'').slice(0,8) + ' | pos=' + r.exam_position + ' | ' + r.short_name + ' | ' + (r.txt||r.err||'').replace(/\n/g,' '));
  await c.end();
})();
