#!/usr/bin/env node
// Aplica la reconciliación de las preguntas que quedaron OTRO al partir los mega-chunks: no
// encajaban en los bloques de SU artículo pero sí en otro artículo de la misma ley (destino que
// el primer pase no ofrecía). Mismo guardarraíl: si algún tema pierde preguntas, revierte.
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
  return Object.fromEntries(r.map(x=>[x.ley+'|'+x.topic_id,x.n]));
}
(async()=>{
  const rec=JSON.parse(fs.readFileSync(path.join(__dirname,'reconciliacion-otro.json'),'utf8'))
    .filter(x=>x.destino!=='SIN_CASA');
  console.log(`con casa: ${rec.length} | SIN_CASA (se quedan donde están): ${79-rec.length}`);
  const arts=Object.fromEntries((await sql`SELECT l.short_name ley, a.article_number n, a.id
    FROM articles a JOIN laws l ON l.id=a.law_id WHERE l.short_name = ANY(${LEYES})`).map(r=>[r.ley+'|'+r.n,r.id]));
  const antes=await porTema(sql); const tA=Object.values(antes).reduce((a,b)=>a+b,0);
  console.log('servidas antes:',tA);
  if(DRY){console.log('— DRY RUN —');await sql.end();return;}
  const snap=await sql`SELECT id, primary_article_id FROM questions WHERE id = ANY(${rec.map(r=>r.id)})`;
  fs.writeFileSync(path.join(__dirname,'backup-reconciliacion.json'),JSON.stringify(snap,null,1));
  let n=0;
  for(const r of rec){
    const d=arts[r.ley+'|'+r.destino]; if(!d) throw new Error(`sin destino ${r.ley} ${r.destino}`);
    await sql`UPDATE questions SET primary_article_id=${d}, updated_at=now() WHERE id=${r.id}`; n++;
  }
  const desp=await porTema(sql); const tD=Object.values(desp).reduce((a,b)=>a+b,0);
  const perd=Object.entries(antes).filter(([k,v])=>(desp[k]||0)<v);
  console.log(`${n} reconciliadas | servidas ANTES ${tA} · DESPUES ${tD}`);
  if(perd.length){console.error('❌ REGRESION — revirtiendo');
    for(const s of snap) await sql`UPDATE questions SET primary_article_id=${s.primary_article_id} WHERE id=${s.id}`;
    process.exit(1);}
  console.log('✅ sin regresión');
  await sql.end();
})().catch(e=>{console.error('❌',e.message);process.exit(1)});
