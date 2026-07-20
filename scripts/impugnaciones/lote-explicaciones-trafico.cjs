#!/usr/bin/env node
// READ-ONLY: extrae el lote de explicaciones flojas VISIBLES con >=10 respuestas (el 89% del daño),
// agrupado por ley/artículo para reescribir por cluster.
const fs=require('fs'),path=require('path');
const pg=require(path.join(__dirname,'..','..','backend','node_modules','postgres'));
const url=fs.readFileSync(path.join(__dirname,'..','..','.env.local'),'utf8').match(/^DATABASE_URL=(.*)$/m)[1].trim();
const sql=pg(url,{ssl:{rejectUnauthorized:false},max:2});
(async()=>{
  const rows = await sql`
    WITH flojas AS (
      SELECT DISTINCT r.question_id FROM ai_verification_results r JOIN questions q ON q.id=r.question_id
      WHERE r.explanation_ok=false AND r.article_ok IS DISTINCT FROM false
        AND r.answer_ok IS DISTINCT FROM false AND q.is_active),
    t AS (SELECT f.question_id, count(tq.id)::int n FROM flojas f
          LEFT JOIN test_questions tq ON tq.question_id=f.question_id GROUP BY 1)
    SELECT t.question_id, t.n AS respuestas, l.short_name AS ley, a.article_number AS art,
           length(q.explanation) AS expl_len,
           (q.explanation LIKE '%>%') AS tiene_blockquote
    FROM t JOIN questions q ON q.id=t.question_id
    LEFT JOIN articles a ON a.id=q.primary_article_id
    LEFT JOIN laws l ON l.id=a.law_id
    WHERE t.n >= 10 ORDER BY t.n DESC`;
  console.log('LOTE (>=10 respuestas):', rows.length, 'preguntas |', rows.reduce((s,r)=>s+r.respuestas,0), 'respuestas');
  const by={};
  for(const r of rows){const k=`${r.ley||'?'} art.${r.art||'?'}`; (by[k]=by[k]||{n:0,resp:0}); by[k].n++; by[k].resp+=r.respuestas;}
  const top=Object.entries(by).sort((a,b)=>b[1].resp-a[1].resp).slice(0,25);
  console.log('\n=== CLUSTERS por ley/artículo (top 25 por respuestas) ===');
  console.table(top.map(([k,v])=>({cluster:k,preguntas:v.n,respuestas:v.resp})));
  console.log('\nSin blockquote:', rows.filter(r=>!r.tiene_blockquote).length, '/', rows.length);
  fs.writeFileSync(path.join(__dirname,'lote-trafico.json'), JSON.stringify(rows,null,1));
  console.log('→ lote-trafico.json escrito');
  await sql.end();
})().catch(e=>{console.error('❌',e.message);process.exit(1)});
