#!/usr/bin/env node
// Vuelca el lote de reescritura (>=10 respuestas, menos las 5 del piloto) en shards por cluster,
// con el ARTÍCULO ENTERO (nunca truncado — gotcha del cubo 1: left(content,4200) generó falsos positivos).
const fs=require('fs'),path=require('path');
const pg=require(path.join(__dirname,'..','..','backend','node_modules','postgres'));
const url=fs.readFileSync(path.join(__dirname,'..','..','.env.local'),'utf8').match(/^DATABASE_URL=(.*)$/m)[1].trim();
const sql=pg(url,{ssl:{rejectUnauthorized:false},max:2});
const HECHAS=['27b39247','57fe32ee','5fae34ce','7239a7bb','e52e863d'];
const OUT=path.join(__dirname,'lote-shards'); fs.mkdirSync(OUT,{recursive:true});
(async()=>{
  const lote=JSON.parse(fs.readFileSync(path.join(__dirname,'lote-trafico.json'),'utf8'))
    .filter(r=>!HECHAS.includes(r.question_id.slice(0,8)));
  const ids=lote.map(r=>r.question_id);
  const qs=await sql`
    SELECT q.id, q.question_text, q.option_a, q.option_b, q.option_c, q.option_d,
           q.correct_option, q.explanation, a.article_number AS art, a.title AS art_title,
           a.content AS art_content, l.short_name AS ley, l.name AS ley_nombre
    FROM questions q LEFT JOIN articles a ON a.id=q.primary_article_id
    LEFT JOIN laws l ON l.id=a.law_id WHERE q.id = ANY(${ids})`;
  const resp=Object.fromEntries(lote.map(r=>[r.question_id,r.respuestas]));
  const enriched=qs.map(q=>({...q, respuestas:resp[q.id]||0, clave:'ABCD'[q.correct_option]}))
                   .sort((a,b)=>b.respuestas-a.respuestas);
  const SHARD=20; let n=0;
  for(let i=0;i<enriched.length;i+=SHARD){
    n++; fs.writeFileSync(path.join(OUT,`shard-${String(n).padStart(2,'0')}.json`),
      JSON.stringify(enriched.slice(i,i+SHARD),null,1));
  }
  console.log(`${enriched.length} preguntas → ${n} shards de ${SHARD}`);
  console.log('sin artículo vinculado:', enriched.filter(q=>!q.art_content).length);
  await sql.end();
})().catch(e=>{console.error('❌',e.message);process.exit(1)});
