#!/usr/bin/env node
'use strict'
// plan-paso2-tras-literal.cjs — construye el plan de re-verificación del Paso 2 DESPUÉS de
// reescribir los epígrafes al literal, usando la medición de `sim-materias-ganadas.cjs`.
//
// El problema que resuelve: reescribir a literal invalida el Paso 2 de golpe (el trigger deja
// todo `stale`), y las dos salidas obvias son malas — re-sellar en bloque declara una cobertura
// que nadie midió, y dejarlo en `stale` esconde el trabajo. Con la medición delante, cada tema
// se decide por lo suyo: el que ganó materia Y la sirve recupera su veredicto; el que tiene un
// hueco va a `issues` CON EL BLOQUE CONCRETO escrito en `findings`, listo para la cola de
// generación ([T-115]) sin volver a investigar cuál era.
//
// Uso:
//   node scripts/temario/sim-materias-ganadas.cjs <pt> --json /tmp/<pt>_ganadas.json
//   node scripts/temario/plan-paso2-tras-literal.cjs <pt> /tmp/<pt>_ganadas.json /tmp/<pt>_p2.json [BOLETIN]
//   npm run verify:scope -- record <pt> /tmp/<pt>_p2.json
//
// Solo LEE de BD (los veredictos previos); no escribe: el registro lo hace `verify:scope record`.
// Medido el 27/07/2026: tcae_murcia 37/6, tcae_galicia 19/3, auxiliar_administrativo_clm 12/9.
require('dotenv').config({path:'.env.local'});
const {Client}=require('pg');const fs=require('fs');
const PT=process.argv[2], G=require(process.argv[3]), OUT=process.argv[4], FUENTE=process.argv[5]||'boletín';
(async()=>{const c=new Client({connectionString:process.env.DATABASE_URL.split('?')[0],ssl:{rejectUnauthorized:false}});await c.connect();
const prev=(await c.query(`SELECT t.topic_number n, v.state, v.verdict, left(coalesce(v.findings->>'note',''),80) nota
 FROM topics t JOIN topic_scope_verification v ON v.topic_id=t.id WHERE t.position_type=$1 AND t.is_active`,[PT])).rows;
const by={};prev.forEach(x=>by[x.n]=x);
const plan={};let ok=0,iss=0,sin=0;
for(const [n,info] of Object.entries(G)){
  const p=by[n]; if(!p){sin++;continue}
  if(info.huecos.length){ plan[n]={verdict:'issues',note:`Re-Paso 2 tras reescribir el epigrafe al literal (${FUENTE}). El epigrafe GANO materia y hay ${info.huecos.length} bloque(s) sin preguntas servidas: ${info.huecos.map(h=>'"'+h.segmento.slice(0,55)+'"').join(' · ')}. El veredicto previo se emitio contra el epigrafe anterior, que no pedia esa materia.`,findings:{origen:'sim-materias-ganadas',huecos:info.huecos}}; iss++; }
  else { plan[n]={verdict:p.verdict==='issues'?'issues':'correct',note:`Re-Paso 2 tras reescribir el epigrafe al literal (${FUENTE}): gano ${info.gano} segmento(s) y TODOS tienen preguntas servidas en el propio tema (sim-materias-ganadas).`,findings:{origen:'sim-materias-ganadas',gano:info.gano,huecos:0}}; ok++; }
}
fs.writeFileSync(OUT,JSON.stringify(plan,null,1));
console.log(`${PT}: ${ok} correct · ${iss} issues${sin?' · '+sin+' sin veredicto previo':''}`);
await c.end();})().catch(e=>console.error('ERR',e.message));
