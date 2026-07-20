#!/usr/bin/env node
// SPLIT GENÉRICO — FASE 2: repartir las preguntas entre los bloques creados en la fase 1.
// Guardarraíl: se cuenta POR TEMA lo servido de cada ley ANTES y DESPUÉS; si algún tema pierde
// una sola pregunta, revierte solo. Las OTRO no se mueven. No se toca ninguna clave.
const fs=require('fs'),path=require('path');
const pg=require(path.join(__dirname,'..','..','backend','node_modules','postgres'));
const url=fs.readFileSync(path.join(__dirname,'..','..','.env.local'),'utf8').match(/^DATABASE_URL=(.*)$/m)[1].trim();
const sql=pg(url,{ssl:{rejectUnauthorized:false},max:2});
const DRY=!process.argv.includes('--apply');
const LEYES=['Eliminacion y sondajes','Oxigenoterapia'];

async function porTema(s){
  const r=await s`SELECT ts.topic_id, l.short_name ley, count(DISTINCT q.id)::int n
    FROM topic_scope ts JOIN laws l ON l.id=ts.law_id
    JOIN articles a ON a.law_id=l.id AND (ts.article_numbers IS NULL OR a.article_number = ANY(ts.article_numbers))
    JOIN questions q ON q.primary_article_id=a.id AND q.is_active
    WHERE l.short_name = ANY(${LEYES}) GROUP BY 1,2`;
  return Object.fromEntries(r.map(x=>[x.ley+'|'+x.topic_id, x.n]));
}
(async()=>{
  const clas=JSON.parse(fs.readFileSync(path.join(__dirname,'clasif2.json'),'utf8'));
  const mueven=clas.filter(c=>c.bloque!=='OTRO' && c.bloque!==c.art);
  console.log(`clasificadas ${clas.length} | se mueven ${mueven.length} | OTRO (no se tocan) ${clas.filter(c=>c.bloque==='OTRO').length}`);

  const arts=Object.fromEntries((await sql`SELECT l.short_name ley, a.article_number n, a.id
    FROM articles a JOIN laws l ON l.id=a.law_id WHERE l.short_name = ANY(${LEYES})`)
    .map(r=>[r.ley+'|'+r.n, r.id]));

  const antes=await porTema(sql);
  const tAntes=Object.values(antes).reduce((a,b)=>a+b,0);
  console.log(`temas afectados ${Object.keys(antes).length} | preguntas servidas ${tAntes}`);
  if(DRY){console.log('— DRY RUN (usa --apply) —');await sql.end();return;}

  const snap=await sql`SELECT id, primary_article_id FROM questions WHERE id = ANY(${mueven.map(m=>m.id)})`;
  fs.writeFileSync(path.join(__dirname,'backup-fase2-generico.json'),JSON.stringify(snap,null,1));
  let n=0;
  for(const m of mueven){
    const dest=arts[m.ley+'|'+m.bloque];
    if(!dest) throw new Error(`sin destino: ${m.ley} ${m.bloque}`);
    await sql`UPDATE questions SET primary_article_id=${dest}, updated_at=now() WHERE id=${m.id}`; n++;
  }
  const despues=await porTema(sql);
  const perd=Object.entries(antes).filter(([k,v])=>(despues[k]||0)<v);
  console.log(`\n${n} re-vinculadas | servidas ANTES ${tAntes} · DESPUES ${Object.values(despues).reduce((a,b)=>a+b,0)}`);
  if(perd.length){
    console.error(`❌ REGRESION en ${perd.length} temas — REVIRTIENDO`);
    for(const s of snap) await sql`UPDATE questions SET primary_article_id=${s.primary_article_id} WHERE id=${s.id}`;
    process.exit(1);
  }
  console.log('✅ ningún tema pierde preguntas');
  console.table(await sql`SELECT l.short_name ley, a.article_number n, length(a.content) chars,
      count(q.id) FILTER (WHERE q.is_active)::int preg
    FROM articles a JOIN laws l ON l.id=a.law_id LEFT JOIN questions q ON q.primary_article_id=a.id
    WHERE l.short_name = ANY(${LEYES}) GROUP BY 1,2,3 ORDER BY 1, a.article_number::text`);
  await sql.end();
})().catch(e=>{console.error('❌',e.message);process.exit(1)});
