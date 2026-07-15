const fs=require('fs');const pg=require('/home/manuel/Documentos/github/vence/backend/node_modules/postgres');
const u=fs.readFileSync('/home/manuel/Documentos/github/vence/.env.local','utf8').match(/^DATABASE_URL=(.*)$/m)[1].trim();
const DIR='/tmp/claude-1000/-home-manuel-Documentos-github-vence/15e44078-8c8b-48b5-bb40-da1e1e5ff1d5/scratchpad';
const pilot=JSON.parse(fs.readFileSync(DIR+'/pilot_ordenint.json','utf8'));
const artByNum=Object.fromEntries(pilot.articles.map(a=>[String(a.article_number),a]));
const norm=(s)=>(s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9ñ ]/g,' ').replace(/\s+/g,' ').trim();
const words=(s)=>new Set(norm(s).split(' ').filter(w=>w.length>3));
// recall de la opción correcta dentro del artículo (fracción de palabras significativas de la opción presentes en el art)
function recall(opt, art){ const O=words(opt), A=words(art); if(O.size===0) return 0; let hit=0; O.forEach(w=>{if(A.has(w))hit++}); return hit/O.size; }
// ¿la pregunta es "señale la incorrecta/falsa"? (patrón que rompe el pre-filtro)
const isNeg=(q)=>/incorrect|fals|no es cierto|no corresponde|excepto|salvo|no ser[aá]/i.test(q);
(async()=>{let s;for(let n=0;n<8;n++){try{s=pg(u,{ssl:{rejectUnauthorized:false},max:1,connect_timeout:30});await s`select 1`;break}catch(e){if(s)await s.end().catch(()=>{});await new Promise(r=>setTimeout(r,4000))}}
 try{
  // verdad-terreno: lifecycle actual (approved=recuperable, retired=descartada)
  const ids=pilot.questions.map(q=>q.id);
  const gt=Object.fromEntries((await s`SELECT id, lifecycle_state ls FROM questions WHERE id=ANY(${ids})`).map(r=>[r.id, r.ls]));
  let rows=[];
  for(const q of pilot.questions){
    const opt=q.options[q.correct];
    const art=artByNum[String(q.linked_article.number)];
    const r= art?recall(opt, art.content):0;
    const truth = gt[q.id]==='approved'?'RECUPERABLE':'DESCARTADA';
    rows.push({id:q.id.slice(0,8), r:+r.toFixed(2), neg:isNeg(q.question_text), truth, artnum:q.linked_article.number});
  }
  // umbral de "bien vinculada" (recall alto)
  const TH=0.7;
  // matriz: pre-filtro dice BIEN (r>=TH) vs NECESITA-JUICIO (r<TH), cruzado con verdad
  let m={bien_recup:0, bien_descart:0, juicio_recup:0, juicio_descart:0};
  rows.forEach(x=>{
    const pred = x.r>=TH?'BIEN':'JUICIO';
    if(pred==='BIEN'&&x.truth==='RECUPERABLE')m.bien_recup++;
    else if(pred==='BIEN'&&x.truth==='DESCARTADA')m.bien_descart++;
    else if(pred==='JUICIO'&&x.truth==='RECUPERABLE')m.juicio_recup++;
    else m.juicio_descart++;
  });
  console.log(`Pre-filtro determinista (recall opción→artículo original, umbral BIEN=${TH})\n`);
  console.log('Cruce con verdad-terreno (mi adjudicación de hoy):');
  console.log(`  dice BIEN-VINCULADA  →  era RECUPERABLE: ${m.bien_recup}  |  era DESCARTADA: ${m.bien_descart}  ← ⚠️ PELIGROSOS (colarían malas como buenas)`);
  console.log(`  dice NECESITA-JUICIO →  era RECUPERABLE: ${m.juicio_recup}  |  era DESCARTADA: ${m.juicio_descart}`);
  const total=rows.length;
  console.log(`\nSi auto-aceptáramos las "BIEN": ${m.bien_recup+m.bien_descart} preguntas (${Math.round((m.bien_recup+m.bien_descart)/total*100)}% del lote), de las cuales ${m.bien_descart} serían ERRORES.`);
  console.log(`Volumen que iría a Claude (JUICIO): ${m.juicio_recup+m.juicio_descart} (${Math.round((m.juicio_recup+m.juicio_descart)/total*100)}%)`);
  // efecto de las "señale la falsa"
  const negs=rows.filter(x=>x.neg);
  console.log(`\nPreguntas "señale la incorrecta/falsa" (rompen el pre-filtro por diseño): ${negs.length}`);
  // distribución de recall
  const buckets={'0.0-0.3':0,'0.3-0.5':0,'0.5-0.7':0,'0.7-1.0':0};
  rows.forEach(x=>{ if(x.r<0.3)buckets['0.0-0.3']++; else if(x.r<0.5)buckets['0.3-0.5']++; else if(x.r<0.7)buckets['0.5-0.7']++; else buckets['0.7-1.0']++; });
  console.log('Distribución de recall:', JSON.stringify(buckets));
  // detalle de los peligrosos (BIEN pero DESCARTADA)
  const peli=rows.filter(x=>x.r>=TH && x.truth==='DESCARTADA');
  if(peli.length){ console.log('\n⚠️ PELIGROSOS (recall alto pero se descartó):'); peli.forEach(x=>console.log(`  ${x.id} r=${x.r} neg=${x.neg} art=${x.artnum}`)); }
 } finally { await s.end(); }
})()
