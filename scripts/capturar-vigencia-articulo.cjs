#!/usr/bin/env node
// T-048 — captura las NOTAS DE VIGENCIA del BOE para un artículo ya importado y las persiste en
// articles.vigencia_notes. NO toca `content` (las explicaciones lo citan literalmente).
//
//   node scripts/capturar-vigencia-articulo.cjs --boe BOE-A-2000-544 --art 58 [--apply]
//
// Es la pieza de "capa 1" del diseño: de aquí sale lo que los importadores deben empezar a llamar.
const fs=require('fs'),path=require('path');
const pg=require(path.join(__dirname,'..','backend','node_modules','postgres'));
const url=fs.readFileSync(path.join(__dirname,'..','.env.local'),'utf8').match(/^DATABASE_URL=(.*)$/m)[1].trim();
const sql=pg(url,{ssl:{rejectUnauthorized:false},max:2});
const arg=n=>{const i=process.argv.indexOf(n);return i>0?process.argv[i+1]:null};
const APPLY=process.argv.includes('--apply');
const API='https://www.boe.es/datosabiertos/api/legislacion-consolidada/id';

// Espejo en CJS de lib/laws/boeVigencia.ts (testeado). Si divergen, manda el .ts.
const ANUL=/\b(inconstitucional|nulidad|nulos?|nulas?|se anula)\b/i;
const named={aacute:'á',eacute:'é',iacute:'í',oacute:'ó',uacute:'ú',ntilde:'ñ',uuml:'ü',Aacute:'Á',Eacute:'É',Iacute:'Í',Oacute:'Ó',Uacute:'Ú',Ntilde:'Ñ',laquo:'«',raquo:'»',nbsp:' ',amp:'&',lt:'<',gt:'>',quot:'"',ordm:'º',ordf:'ª'};
const dec=s=>s.replace(/&([a-zA-Z]+);/g,(m,n)=>named[n]??m).replace(/&#(\d+);/g,(_,d)=>String.fromCodePoint(+d));
const strip=s=>dec(s.replace(/<[^>]+>/g,' ')).replace(/[ \t]+/g,' ').trim();
function parseBoeBlock(raw){
  const notes=[];
  for(const bq of raw.match(/<blockquote>[\s\S]*?<\/blockquote>/gi)??[])
    for(const p of bq.match(/<p\s+class="(nota[^"]*)"[^>]*>([\s\S]*?)<\/p>/gi)??[]){
      const clase=(p.match(/class="([^"]+)"/i)??[])[1]??'nota';
      const ref=(p.match(/Ref\.\s*(BOE-[A-Z]-\d{4}-\d+)/i)??[])[1]??null;
      const texto=strip(p); if(texto&&!notes.some(n=>n.texto===texto)) notes.push({clase,texto,ref,esAnulacion:ANUL.test(texto)});
    }
  const sin=raw.replace(/<blockquote>[\s\S]*?<\/blockquote>/gi,' ');
  const frags=[...new Set((sin.match(/<strong>([\s\S]*?)<\/strong>/gi)??[]).map(strip).filter(Boolean))];
  return {notes, frags};
}
(async()=>{
  const boe=arg('--boe'), art=arg('--art');
  if(!boe||!art){console.error('uso: --boe BOE-A-.... --art 58 [--apply]');process.exit(2);}
  const idx=await (await fetch(`${API}/${boe}/texto/indice`,{headers:{Accept:'application/xml'}})).text();
  const bloques=[...idx.matchAll(/<bloque>([\s\S]*?)<\/bloque>/g)].map(m=>({
    id:(m[1].match(/<id>([^<]*)<\/id>/)||[])[1],
    tit:(m[1].match(/<titulo>([\s\S]*?)<\/titulo>/)||[])[1]||''}));
  const b=bloques.find(x=>x.id===`a${art}`)||bloques.find(x=>new RegExp(`art[íi]culo\\s+${art}\\b`,'i').test(x.tit));
  if(!b){console.error(`bloque del art.${art} no encontrado`);process.exit(1);}
  const raw=await (await fetch(`${API}/${boe}/texto/bloque/${b.id}`,{headers:{Accept:'application/xml'}})).text();
  const {notes,frags}=parseBoeBlock(raw);
  const anuladas=notes.filter(n=>n.esAnulacion);
  console.log(`${boe} art.${art} (bloque ${b.id}) → ${notes.length} nota(s), ${anuladas.length} de anulación, ${frags.length} fragmento(s) destacado(s)`);
  for(const n of notes) console.log(`  ${n.esAnulacion?'⚠️ ':'   '}[${n.clase}] ${n.texto.slice(0,120)}`);
  const payload={notes, annulledFragments: anuladas.length?frags:[], capturedAt:new Date().toISOString(), sourceBlock:b.id};
  if(!APPLY){console.log('\n— DRY RUN (usa --apply) —');await sql.end();return;}
  // OJO: JSON.stringify(...)::jsonb guarda un STRING json, no un objeto (el driver ya serializa
  // el parámetro). Hay que pasar el objeto con sql.json() o jsonb_typeof devuelve 'string'.
  const r=await sql`UPDATE articles a SET vigencia_notes=${sql.json(payload)}
    FROM laws l WHERE l.id=a.law_id AND l.boe_url LIKE ${'%'+boe+'%'} AND a.article_number=${String(art)}
    RETURNING a.id`;
  console.log(`\n✅ ${r.length} artículo(s) actualizados (content NO tocado)`);
  await sql.end();
})().catch(e=>{console.error('❌',e.message);process.exit(1)});
