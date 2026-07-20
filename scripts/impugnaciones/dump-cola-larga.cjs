#!/usr/bin/env node
// Vuelca el 2º tramo de la cola B: explicaciones flojas VISIBLES con 1-9 respuestas.
// (el tramo >=10 se drenó el 20/07; las 0-respuestas NO se tocan: no le llegan a nadie)
const fs=require('fs'),path=require('path');
const pg=require(path.join(__dirname,'..','..','backend','node_modules','postgres'));
const url=fs.readFileSync(path.join(__dirname,'..','..','.env.local'),'utf8').match(/^DATABASE_URL=(.*)$/m)[1].trim();
const sql=pg(url,{ssl:{rejectUnauthorized:false},max:2});
const OUT=path.join(__dirname,'cola-larga-shards'); fs.mkdirSync(OUT,{recursive:true});
(async()=>{
  const rows=await sql`
    WITH flojas AS (
      SELECT DISTINCT r.question_id FROM ai_verification_results r JOIN questions q ON q.id=r.question_id
      WHERE r.explanation_ok=false AND r.article_ok IS DISTINCT FROM false
        AND r.answer_ok IS DISTINCT FROM false AND q.is_active
        AND NOT EXISTS (SELECT 1 FROM ai_verification_results x WHERE x.question_id=r.question_id
                        AND x.ai_provider IN ('claude_code_expl_traffic_v1','claude_code_expl_traffic_relink')
                        AND x.fix_applied)),
    t AS (SELECT f.question_id, count(tq.id)::int n FROM flojas f
          LEFT JOIN test_questions tq ON tq.question_id=f.question_id GROUP BY 1)
    SELECT q.id, q.question_text, q.option_a,q.option_b,q.option_c,q.option_d, q.correct_option,
           q.explanation, a.article_number AS art, a.content AS art_content,
           l.short_name AS ley, t.n AS respuestas
    FROM t JOIN questions q ON q.id=t.question_id
    LEFT JOIN articles a ON a.id=q.primary_article_id LEFT JOIN laws l ON l.id=a.law_id
    WHERE t.n BETWEEN 1 AND 9 ORDER BY t.n DESC`;
  const enr=rows.map(q=>({...q, clave:'ABCD'[q.correct_option]}));
  const sinArt=enr.filter(q=>!q.art_content);
  const con=enr.filter(q=>q.art_content);
  const SHARD=25; let n=0;
  for(let i=0;i<con.length;i+=SHARD){ n++;
    fs.writeFileSync(path.join(OUT,`shard-${String(n).padStart(2,'0')}.json`),
      JSON.stringify(con.slice(i,i+SHARD),null,1)); }
  console.log(`${enr.length} en el tramo 1-9 | ${con.length} con artículo → ${n} shards de ${SHARD}`);
  console.log(`sin artículo vinculado (NO se reescriben, no hay fuente): ${sinArt.length}`);
  if(sinArt.length) fs.writeFileSync(path.join(__dirname,'cola-larga-sin-articulo.json'),
    JSON.stringify(sinArt.map(q=>({id:q.id,ley:q.ley,resp:q.respuestas,q:q.question_text.slice(0,80)})),null,1));
  await sql.end();
})().catch(e=>{console.error('❌',e.message);process.exit(1)});
