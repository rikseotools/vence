#!/usr/bin/env node
// Valida que TODO blockquote de las explicaciones nuevas sea cita literal del art_content.
// LECCIÓN CUBO 2 (16/07): los chequeos deterministas dieron 68→13→1 falsos positivos por
// normalización ASIMÉTRICA. Aquí se normalizan AMBOS lados exactamente igual.
const fs=require('fs'),path=require('path');
const DIR=path.join(__dirname,'lote-shards');

function norm(s){
  return (s||'')
    .replace(/\*\*/g,'')                    // negritas markdown (en cita Y en artículo)

    .replace(/^#{1,6}\s+/gm,'')             // encabezados markdown
    .replace(/^[\t ]*\|/gm,'')               // bordes de tabla markdown
    .replace(/[«»""''"]/g,'')            // comillas (envolventes o anidadas)
    .replace(/^[\t ]*[•·▪‣*\-–—]\s+/gm,'')   // viñetas (DESPUÉS de comillas: «• no matchea ^)
    .replace(/\[\.\.\.\]|\.\.\.|…/g,'|')    // marcador de elisión → separador
    .replace(/[ \s]+/g,' ')            // espacios/nbsp
    .replace(/[–—]/g,'-')
    .trim().toLowerCase();
}
function extraeCitas(expl){
  return (expl.match(/^>.*$/gm)||[]).map(l=>l.replace(/^>\s?/,'').trim()).filter(Boolean);
}
// quita el sufijo de referencia "(art. 5 CE)" que añadimos fuera de la cita
// El sufijo de referencia que añadimos fuera de la cita —«(art. 5 CE)», «(estructura de la CE)»—
// NO está en el artículo. Probamos la cita con y sin su último paréntesis: basta que UNA valide.
function variantes(c){
  // el sufijo puede llevar paréntesis ANIDADOS: «(art. 32 LO 1/2018 (EA Canarias))».
  // Recortamos desde el ÚLTIMO '(' que abre un paréntesis que llega hasta el final.
  const out=[c];
  for(let i=c.length-1;i>=0;i--) if(c[i]==='('){ const t=c.slice(0,i).trim(); if(t) out.push(t); }
  return out;
}

const arts={};
for(const f of fs.readdirSync(DIR).filter(f=>/^shard-\d+\.json$/.test(f)))
  for(const q of JSON.parse(fs.readFileSync(path.join(DIR,f),'utf8'))) arts[q.id]={art:q.art_content,ley:q.ley,n:q.art};

let ok=0,malas=[],flags=[],sinBQ=[];
for(const f of fs.readdirSync(DIR).filter(f=>/^out-\d+\.json$/.test(f))){
  for(const r of JSON.parse(fs.readFileSync(path.join(DIR,f),'utf8'))){
    if(r.flag){flags.push({id:r.id.slice(0,8),motivo:r.flag,shard:f});continue;}
    const A=norm(arts[r.id]?.art); const citas=extraeCitas(r.nueva_explicacion);
    if(!citas.length){sinBQ.push(r.id.slice(0,8));continue;}
    let todasOk=true;
    for(const c of citas)
      {
        const okVar = variantes(c).some(v =>
          norm(v).split('|').map(s=>s.trim()).filter(s=>s.length>12).every(fr=>A.includes(fr)));
        if(!okVar){todasOk=false;
          malas.push({id:r.id.slice(0,8),shard:f,frag:norm(variantes(c)[1]).slice(0,90)});}
      }
    if(todasOk)ok++;
  }
}
console.log(`✅ citas literales verificadas: ${ok}`);
console.log(`🚩 flagged por el agente:      ${flags.length}`);
console.log(`⚠️  sin blockquote:            ${sinBQ.length}`, sinBQ.join(' '));
console.log(`❌ citas NO literales:         ${malas.length}`);
for(const m of malas.slice(0,25)) console.log(`   ${m.id} [${m.shard}] «${m.frag}…»`);
if(flags.length){console.log('\n— FLAGS (a decisión humana, NUNCA auto-flip de clave) —');
  for(const f of flags) console.log(`   ${f.id}: ${f.motivo}`);}
fs.writeFileSync(path.join(__dirname,'validacion-citas.json'),JSON.stringify({ok,malas,flags,sinBQ},null,1));
