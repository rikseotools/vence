#!/usr/bin/env node
// DIAGNÓSTICO T-047: ¿qué hace que el hash de una página cambie entre dos fetches seguidos?
// Replica extractRelevantText + normalizeForHash de backend/src/check-seguimiento/seguimiento-fetch.ts
// y diffea dos descargas de la MISMA url. Lo que salga es ruido que el normalizador no captura.
const https=require('https'), crypto=require('crypto');
const extract = h => h
  .replace(/<script[\s\S]*?<\/script>/gi,'').replace(/<style[\s\S]*?<\/style>/gi,'')
  .replace(/<noscript[\s\S]*?<\/noscript>/gi,'').replace(/<!--[\s\S]*?-->/g,'')
  .replace(/<[^>]+>/g,' ').replace(/&[a-z]+;/gi,' ').replace(/&#\d+;/g,' ')
  .replace(/\s+/g,' ').trim();
const norm = t => t.toLowerCase()
  .replace(/\b\d{1,2}:\d{2}(:\d{2})?\b/g,' ')
  .replace(/\b\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4}\b/g,' ')
  .replace(/\b\d{4}-\d{2}-\d{2}\b/g,' ')
  .replace(/\b\d{1,2}\s+de\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)(\s+de\s+\d{4})?\b/g,' ')
  .replace(/\b[0-9a-f]{16,}\b/g,' ').replace(/\b\d{8,}\b/g,' ')
  .replace(/(aceptar(\s+todas)?\s+(las\s+)?cookies|pol[ií]tica de cookies|uso de cookies|gestionar cookies|fecha y hora oficial|[uú]ltima actualizaci[oó]n|hora oficial)/g,' ')
  .replace(/\s+/g,' ').trim();
const get = url => new Promise((res,rej)=>{
  https.get(url,{headers:{'User-Agent':'Mozilla/5.0 (compatible; VenceBot/1.0)'},rejectUnauthorized:false},r=>{
    if(r.statusCode>=300&&r.statusCode<400&&r.headers.location) return get(new URL(r.headers.location,url).href).then(res,rej);
    let d='';r.on('data',c=>d+=c);r.on('end',()=>res(d));}).on('error',rej);});

(async()=>{
  const url=process.argv[2];
  if(!url){console.error('uso: diag-seguimiento-ruido.cjs <url>');process.exit(2);}
  const a=await get(url); await new Promise(r=>setTimeout(r,2500)); const b=await get(url);
  const na=norm(extract(a)), nb=norm(extract(b));
  const ha=crypto.createHash('sha256').update(na).digest('hex').slice(0,12);
  const hb=crypto.createHash('sha256').update(nb).digest('hex').slice(0,12);
  console.log(`html:  ${a.length} vs ${b.length} bytes`);
  console.log(`norm:  ${na.length} vs ${nb.length} chars`);
  console.log(`hash:  ${ha} vs ${hb}  → ${ha===hb?'✅ ESTABLE':'❌ CAMBIA entre dos fetches seguidos'}`);
  if(ha===hb) return;
  // localizar los tramos que difieren
  const wa=na.split(' '), wb=nb.split(' ');
  let i=0; while(i<wa.length&&i<wb.length&&wa[i]===wb[i]) i++;
  let j=0; while(j<wa.length-i&&j<wb.length-i&&wa[wa.length-1-j]===wb[wb.length-1-j]) j++;
  console.log(`\nprefijo común: ${i} palabras | sufijo común: ${j}`);
  console.log('\n--- solo en el fetch A ---\n'+wa.slice(i,wa.length-j).join(' ').slice(0,700));
  console.log('\n--- solo en el fetch B ---\n'+wb.slice(i,wb.length-j).join(' ').slice(0,700));
})();
