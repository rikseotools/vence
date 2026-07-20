#!/usr/bin/env node
// Vuelca los defectos de CORRECCIÓN (clave dudosa / doble clave / enunciado truncado)
// marcados en los dos barridos del 20/07, para adjudicación humana.
// Los ids salen de los FLAGS-*.md commiteados; el detalle se RE-DERIVA de RDS
// (no se reutiliza la nota del agente: el criterio es verificar, no fiarse).
const fs=require('fs'),path=require('path');
const pg=require(path.join(__dirname,'..','..','backend','node_modules','postgres'));
const url=fs.readFileSync(path.join(__dirname,'..','..','.env.local'),'utf8').match(/^DATABASE_URL=(.*)$/m)[1].trim();
const sql=pg(url,{ssl:{rejectUnauthorized:false},max:2});
const TIPOS=['clave dudosa','doble clave','enunciado roto'];
(async()=>{
  const ids=[];
  for(const f of ['FLAGS-cola-larga.md','FLAGS-lote-trafico.md']){
    const p=path.join(__dirname,f); if(!fs.existsSync(p)) continue;
    for(const line of fs.readFileSync(p,'utf8').split('\n')){
      const m=line.match(/^\|\s*`([0-9a-f]{8})`\s*\|([^|]*)\|([^|]*)\|([^|]*)\|([^|]*)\|/);
      if(m && TIPOS.some(t=>m[5].includes(t))) ids.push({pfx:m[1], tipo:m[5].trim(), resp:m[2].trim()});
    }
  }
  console.log('defectos de corrección a adjudicar:', ids.length);
  const out=[];
  for(const it of ids){
    const q=(await sql`SELECT q.id,q.question_text,q.option_a,q.option_b,q.option_c,q.option_d,
        q.correct_option,q.explanation,a.article_number art,a.content art_content,l.short_name ley
      FROM questions q LEFT JOIN articles a ON a.id=q.primary_article_id
      LEFT JOIN laws l ON l.id=a.law_id WHERE left(q.id::text,8)=${it.pfx}`)[0];
    if(q) out.push({...q, ...it, clave:'ABCD'[q.correct_option]});
  }
  fs.writeFileSync(path.join(__dirname,'defectos-correccion.json'),JSON.stringify(out,null,1));
  const g={}; for(const o of out) g[o.tipo]=(g[o.tipo]||0)+1;
  console.table(g);
  console.log('→ defectos-correccion.json');
  await sql.end();
})().catch(e=>{console.error('❌',e.message);process.exit(1)});
