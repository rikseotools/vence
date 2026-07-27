#!/usr/bin/env node
'use strict'
// sim-programa-url-vigilable.cjs — SIMULACIÓN on-demand (solo lectura, no escribe ni pinga
// ningún badge): ¿cuántos `programa_url` de oposiciones ACTIVAS son en realidad una página de
// error, un muro de login o un cascarón de SPA servido con HTTP 200?
//
// ## Por qué (27/07/2026, T-107)
//
// `programa_url` es el enlace más oficial de la landing ("Ver convocatoria en {diario}") Y la
// fuente que hashea el Sistema 2 de literalidad de epígrafe. Un 200 no prueba nada: el sitio de
// Correos responde 200 con su página de error para CUALQUIER ruta, y el BORM sirve un cascarón
// de SPA cuando la URL es de fragmento (`#/home/anuncio/...`). En los dos casos el usuario pincha
// "Ver convocatoria" y no ve la convocatoria, y ningún detector lo decía.
//
// REUTILIZA el núcleo de T-165 (`clasificarVigilancia`), que ya resuelve exactamente esta
// pregunta para `seguimiento_url` — mismo concepto, otra columna. No hay detector nuevo.
//
// ## Gotcha que invalidó la primera pasada
//
// Los boletines sirven PDF SIN extensión (`/services/anuncio/.../pdf`, `verAnuncioAction.do`,
// `BRSCGI?CMD=VEROBJ`). Sin extraer su texto, TODOS parecen "shell sin contenido": la primera
// simulación dio 17 falsos positivos. Con `pdftotext` (y su maxBuffer subido) quedan 3 reales.
//
// Uso:  node scripts/convocatoria/sim-programa-url-vigilable.cjs
//
require('dotenv').config({path:'.env.local'});
const {Client}=require('pg');
const {execFileSync}=require('child_process');
const fs=require('fs');
const {clasificarVigilancia}=require('../../lib/convocatoria/seguimientoVigilable.cjs');
function fetchTexto(url){
  const tmp=`/tmp/_pu_${Math.abs(url.length*7919)%99999}.bin`;
  try{ execFileSync('curl',['-sL','--max-time','35','-A','Mozilla/5.0 (X11; Linux x86_64) Chrome/126','-o',tmp,'-w','%{http_code}',url],{encoding:'utf8'});
  }catch{ return {status:0,texto:''} }
  if(!fs.existsSync(tmp)) return {status:0,texto:''};
  const buf=fs.readFileSync(tmp); try{fs.unlinkSync(tmp)}catch{}
  if(buf.subarray(0,4).toString('latin1')==='%PDF'){
    // Los boletines sirven PDF sin extensión (.../anuncio/.../pdf, verAnuncioAction.do,
    // BRSCGI?CMD=VEROBJ). Si no se extrae el texto, TODOS parecen "shell sin contenido":
    // 17 falsos positivos en la primera pasada de esta simulación.
    const t2=tmp+'.p'; fs.writeFileSync(t2,buf);
    try{ const t=execFileSync('pdftotext',['-layout',t2,'-'],{maxBuffer:256*1024*1024}).toString('utf8');
         try{fs.unlinkSync(t2)}catch{}; return {status:200,texto:t.replace(/\s+/g,' ')} }
    catch{ try{fs.unlinkSync(t2)}catch{}; return {status:200,texto:''} }
  }
  let raw=buf.toString('utf8').replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi,' ')
    .replace(/<[^>]+>/g,' ').replace(/&[a-z]+;/gi,' ').replace(/\s+/g,' ');
  return {status:200,texto:raw};
}
(async()=>{
const c=new Client({connectionString:process.env.DATABASE_URL.split('?')[0],ssl:{rejectUnauthorized:false}});await c.connect();
const r=await c.query(`SELECT o.slug, cv.programa_url url,
  (SELECT count(*) FROM user_profiles up WHERE up.target_oposicion=replace(o.slug,'-','_')) usuarios
 FROM oposiciones o JOIN convocatorias cv ON cv.oposicion_id=o.id AND cv.is_current
 WHERE o.is_active AND cv.programa_url IS NOT NULL ORDER BY 3 DESC`);
await c.end();
console.log('programa_url a comprobar:', r.rows.length);
const malos=[];
for(const x of r.rows){
  if(/\.pdf(\?|$)/i.test(x.url)){ continue }              // PDF directo: no aplica
  const f=fetchTexto(x.url);
  const v=clasificarVigilancia({httpStatus:f.status, texto:f.texto});
  if(!v.vigilable && v.nivel!=='fetch_error'){ malos.push({...x, ...v}); console.log(`  🔴 ${x.slug} (${x.usuarios}u) [${v.nivel}] ${x.url.slice(0,70)}`); }
}
console.log(`\nRESULTADO: ${malos.length} programa_url que son página de error/login/ficha servida con 200`);
})().catch(e=>console.error('ERR',e.message));
