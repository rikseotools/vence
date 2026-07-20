#!/usr/bin/env node
const fs=require('fs'),path=require('path');
const pg=(()=>{try{return require('postgres')}catch{return require(path.join(__dirname,'..','..','backend','node_modules','postgres'))}})();
const url=process.env.DATABASE_URL||fs.readFileSync(path.join(__dirname,'..','..','.env.local'),'utf8').match(/^DATABASE_URL=(.*)$/m)[1].trim();
const sql=pg(url,{ssl:{rejectUnauthorized:false},max:2});
(async()=>{
  console.log('=== A) needs_human: ¿cuántas tienen sugerencia RESOLUBLE (norma ya en BD)? ===');
  console.table(await sql`
    WITH nh AS (
      SELECT DISTINCT ON (q.id) q.id, r.correct_article_suggestion AS sug
      FROM questions q JOIN ai_verification_results r ON r.question_id=q.id
      WHERE q.lifecycle_state='needs_human'
      ORDER BY q.id, (r.correct_article_suggestion IS NOT NULL) DESC, r.verified_at DESC NULLS LAST)
    SELECT count(*)::int total,
           count(*) FILTER (WHERE sug IS NOT NULL)::int con_sugerencia,
           count(*) FILTER (WHERE sug IS NULL)::int sin_sugerencia FROM nh`);

  console.log('\n=== B) explicaciones flojas VISIBLES: reparto por tráfico (respuestas reales) ===');
  console.table(await sql`
    WITH flojas AS (
      SELECT DISTINCT r.question_id FROM ai_verification_results r JOIN questions q ON q.id=r.question_id
      WHERE r.explanation_ok=false AND r.article_ok IS DISTINCT FROM false
        AND r.answer_ok IS DISTINCT FROM false AND q.is_active),
    t AS (SELECT f.question_id, count(da.id)::int n FROM flojas f
          LEFT JOIN test_questions da ON da.question_id=f.question_id GROUP BY 1)
    SELECT CASE WHEN n=0 THEN '0 (nunca servida)' WHEN n<10 THEN '1-9'
                WHEN n<50 THEN '10-49' WHEN n<200 THEN '50-199' ELSE '200+' END AS tramo_respuestas,
           count(*)::int preguntas, sum(n)::int respuestas_totales
    FROM t GROUP BY 1 ORDER BY 3 DESC`);

  console.log('\n=== B2) TOP 15 explicaciones flojas por tráfico (donde duele) ===');
  console.table(await sql`
    WITH flojas AS (
      SELECT DISTINCT r.question_id FROM ai_verification_results r JOIN questions q ON q.id=r.question_id
      WHERE r.explanation_ok=false AND r.article_ok IS DISTINCT FROM false
        AND r.answer_ok IS DISTINCT FROM false AND q.is_active)
    SELECT left(f.question_id::text,8) qid, count(da.id)::int respuestas,
           left(q.question_text,60) enunciado
    FROM flojas f JOIN questions q ON q.id=f.question_id
    LEFT JOIN test_questions da ON da.question_id=f.question_id
    GROUP BY 1,3 ORDER BY 2 DESC LIMIT 15`);
  await sql.end();
})().catch(e=>{console.error('❌',e.message);process.exit(1)});
