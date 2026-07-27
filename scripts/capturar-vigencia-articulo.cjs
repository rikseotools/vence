#!/usr/bin/env node
// T-048 — captura las NOTAS DE VIGENCIA del BOE para un artículo ya importado y las persiste en
// articles.vigencia_notes. NO toca `content` (las explicaciones lo citan literalmente).
//
//   node scripts/capturar-vigencia-articulo.cjs --boe BOE-A-2000-544 --art 58 [--apply]
//
// Es la pieza de "capa 1" del diseño: de aquí sale lo que los importadores deben empezar a llamar.
const fs=require('fs'),path=require('path');
// La conexión se abre PEREZOSAMENTE, no al importar el módulo. Este fichero también se importa
// desde `__tests__/scripts/capturarVigenciaBloque.test.js` para probar sus funciones PURAS
// (seleccionarBloque/esDelArticulo); creándola arriba, el simple import arrastraba
// `backend/node_modules/postgres` y `.env.local` — que en el runner de CI no existen. Resultado:
// "Cannot find module …/backend/node_modules/postgres" y la suite entera en rojo, bloqueando un
// deploy el 27/07. Un módulo que se importa no debe abrir conexiones ni leer secretos.
let _sql=null;
const sql=()=>{
  if(!_sql){
    const pg=require(path.join(__dirname,'..','backend','node_modules','postgres'));
    const url=fs.readFileSync(path.join(__dirname,'..','.env.local'),'utf8').match(/^DATABASE_URL=(.*)$/m)[1].trim();
    _sql=pg(url,{ssl:{rejectUnauthorized:false},max:2});
  }
  return _sql;
};
const arg=n=>{const i=process.argv.indexOf(n);return i>0?process.argv[i+1]:null};
const APPLY=process.argv.includes('--apply');
const API='https://www.boe.es/datosabiertos/api/legislacion-consolidada/id';

// ── selección del BLOQUE del artículo (pura y testeable) ────────────────────────────────
// El MAPA manda; `a<N>` es el ÚLTIMO recurso. Estaba al revés y en el Código Civil eso lee
// otro precepto: su bloque `a9` es el «Artículo 94 bis» (el CC rotula «Art 9» → id `art9`).
const norm = (s) => String(s || '').replace(/\s+/g, '').toLowerCase()
const esDelArticulo = (bloque, art) =>
  new RegExp(`^art(?:[íi]culo)?\\.?${norm(art)}(?:[.\\s]|$)`, 'i').test(norm(bloque && bloque.tit))
// Devuelve TAMBIÉN por qué vía se resolvió: la guarda de rúbrica solo debe aplicarse a las
// vías DÉBILES. El mapa (`mapaBloquesPorArticulo`) ya convierte los ordinales en letra —la
// LOREG rotula «Artículo ciento noventa y siete» y la LOFCS «Artículo octavo»—, así que
// exigirle además que la rúbrica contenga el dígito abortaba capturas correctas: 8 de 42 en
// el primer barrido, entre ellas LOFCS art. 8 (24 preguntas activas) y LOREG art. 197.
function seleccionarBloque(bloques, mapa, art) {
  const porMapa = (mapa && mapa[String(art)]) ? bloques.find((x) => x.id === mapa[String(art)]) : null
  if (porMapa) return { bloque: porMapa, via: 'mapa' }
  const porRubrica = bloques.find((x) => esDelArticulo(x, art))
  if (porRubrica) return { bloque: porRubrica, via: 'rubrica' }
  const porId = bloques.find((x) => x.id === `a${art}`)
  if (porId) return { bloque: porId, via: 'id' }
  return { bloque: null, via: null }
}



// Los patrones vienen del NÚCLEO compartido (lib/laws/notaVigenciaTc.js), no de una copia:
// esto era el cuarto duplicado del regex de anulación y ninguno conocía la fórmula
// competencial del TC (T-132, 26/07/2026).
const {RE_NULIDAD:ANUL, RE_COMPETENCIAL:COMPET}=require(path.join(__dirname,'..','lib','laws','notaVigenciaTc'));
const {mapaBloquesPorArticulo}=require(path.join(__dirname,'..','lib','laws','boeBloqueVigente'));
const named={aacute:'á',eacute:'é',iacute:'í',oacute:'ó',uacute:'ú',ntilde:'ñ',uuml:'ü',Aacute:'Á',Eacute:'É',Iacute:'Í',Oacute:'Ó',Uacute:'Ú',Ntilde:'Ñ',laquo:'«',raquo:'»',nbsp:' ',amp:'&',lt:'<',gt:'>',quot:'"',ordm:'º',ordf:'ª'};
const dec=s=>s.replace(/&([a-zA-Z]+);/g,(m,n)=>named[n]??m).replace(/&#(\d+);/g,(_,d)=>String.fromCodePoint(+d));
const strip=s=>dec(s.replace(/<[^>]+>/g,' ')).replace(/[ \t]+/g,' ').trim();
// ESPEJO de `lib/laws/boeVigencia.parseBoeBlock` — MANTENER EN SYNC (lo fija el guardarraíl
// `__tests__/backend/annulledVigenciaMirror.test.ts`, que corre las tres copias sobre los
// mismos textos). El <blockquote> puede llevar atributos (`class="siempreSeVe"`) y el texto
// puede colgar directamente de él, sin <p class="nota_pie"> — así está la nota de la STC
// 1/2011 en el art. 35 de la LOPS, que por eso no había forma de capturar (T-169).
function parseBoeBlock(raw){
  const notes=[];
  const push=(texto,clase,ref)=>{ if(texto&&!notes.some(n=>n.texto===texto)) notes.push({clase,texto,ref,esAnulacion:ANUL.test(texto), esCompetencial:COMPET.test(texto)}); };
  for(const bq of raw.match(/<blockquote[^>]*>[\s\S]*?<\/blockquote>/gi)??[]){
    const parrafos=bq.match(/<p\s+class="(nota[^"]*)"[^>]*>([\s\S]*?)<\/p>/gi)??[];
    if(parrafos.length){
      for(const p of parrafos){
        const clase=(p.match(/class="([^"]+)"/i)??[])[1]??'nota';
        const ref=(p.match(/Ref\.\s*(BOE-[A-Z]-\d{4}-\d+)/i)??[])[1]??null;
        push(strip(p),clase,ref);
      }
      continue;
    }
    const clase=(bq.match(/<blockquote[^>]*class="([^"]+)"/i)??[])[1]??'nota_blockquote';
    const ref=(bq.match(/Ref\.\s*(BOE-[A-Z]-\d{4}-\d+)/i)??[])[1]??null;
    push(strip(bq),clase,ref);
  }
  const sin=raw.replace(/<blockquote[^>]*>[\s\S]*?<\/blockquote>/gi,' ');
  const frags=[...new Set((sin.match(/<strong>([\s\S]*?)<\/strong>/gi)??[]).map(strip).filter(Boolean))];
  return {notes, frags};
}
async function main(){
  const boe=arg('--boe'), art=arg('--art');
  if(!boe||!art){console.error('uso: --boe BOE-A-.... --art 58 [--apply]');process.exit(2);}
  const idx=await (await fetch(`${API}/${boe}/texto/indice`,{headers:{Accept:'application/xml'}})).text();
  const bloques=[...idx.matchAll(/<bloque>([\s\S]*?)<\/bloque>/g)].map(m=>({
    id:(m[1].match(/<id>([^<]*)<\/id>/)||[])[1],
    tit:(m[1].match(/<titulo>([\s\S]*?)<\/titulo>/)||[])[1]||''}));
  // El mapeo por rúbrica se delega al núcleo COMPARTIDO: su versión entiende además los
  // artículos escritos en letra ("Artículo doscientos noventa y cuatro"), que es como
  // numeran las leyes antiguas — la LOPJ tiene 713 así y aquí fallaban todos (T-132).
  const mapa=mapaBloquesPorArticulo(idx);
  // ORDEN DE PREFERENCIA — el MAPA manda, `a<N>` es el ÚLTIMO recurso (T-169, 27/07/2026).
  // Estaba al revés, y en el Código Civil eso lee el artículo EQUIVOCADO con apariencia de
  // éxito: su bloque `a9` es el «Artículo 94 bis», no el 9 (el CC rotula «Art 9» y su id es
  // `art9`). Capturar así habría escrito en `vigencia_notes` del art. 9 las notas de otro
  // precepto — un dato falso que nadie volvería a mirar. El manual ya avisaba de que el id
  // no siempre es `a<N>`; aquí no se estaba respetando.
  const {bloque:b, via}=seleccionarBloque(bloques,mapa,art);
  if(!b){console.error(`bloque del art.${art} no encontrado`);process.exit(1);}
  // GUARDA: si el bloque NO viene del mapa, tiene que ANUNCIARSE como el artículo pedido.
  // Sin esto, el fallback `a<N>` escribe notas de otro artículo (el `a9` del Código Civil es
  // el «Artículo 94 bis») y el error es indetectable después.
  if(via!=='mapa' && !esDelArticulo(b,art)){
    console.error(`❌ el bloque ${b.id} se titula "${String(b.tit).trim().slice(0,60)}" y se pidió el art.${art}: abortado para no escribir la nota de otro artículo`);
    process.exit(1);
  }
  const raw=await (await fetch(`${API}/${boe}/texto/bloque/${b.id}`,{headers:{Accept:'application/xml'}})).text();
  const {notes,frags}=parseBoeBlock(raw);
  const anuladas=notes.filter(n=>n.esAnulacion);
  console.log(`${boe} art.${art} (bloque ${b.id}) → ${notes.length} nota(s), ${anuladas.length} de anulación, ${notes.filter(n=>n.esCompetencial).length} competencial(es), ${frags.length} fragmento(s) destacado(s)`);
  for(const n of notes) console.log(`  ${n.esAnulacion?'⚠️ ':'   '}[${n.clase}] ${n.texto.slice(0,120)}`);
  const payload={notes, annulledFragments: anuladas.length?frags:[], capturedAt:new Date().toISOString(), sourceBlock:b.id};
  if(!APPLY){console.log('\n— DRY RUN (usa --apply) —');await sql().end();return;}
  // OJO: JSON.stringify(...)::jsonb guarda un STRING json, no un objeto (el driver ya serializa
  // el parámetro). Hay que pasar el objeto con sql.json() o jsonb_typeof devuelve 'string'.
  const db=sql();
  const r=await db`UPDATE articles a SET vigencia_notes=${db.json(payload)}
    FROM laws l WHERE l.id=a.law_id AND l.boe_url LIKE ${'%'+boe+'%'} AND a.article_number=${String(art)}
    RETURNING a.id`;
  console.log(`\n✅ ${r.length} artículo(s) actualizados (content NO tocado)`);
  await db.end();
}

if (require.main === module) {
  main().catch(e=>{console.error('❌',e.message);process.exit(1)});
}

// Se exporta la selección de bloque para que el guardarraíl la pruebe con los índices reales
// (CC «Art 9» vs `a9` = art. 94 bis, LECrim «504 bis»…). Requerir este fichero NO abre la BD.
module.exports = { seleccionarBloque, esDelArticulo, parseBoeBlock };
