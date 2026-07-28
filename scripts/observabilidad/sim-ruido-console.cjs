#!/usr/bin/env node
'use strict'
// sim-ruido-console.cjs — mide qué parte de los `console_error` de cliente es RUIDO y qué
// parte es DAÑO, y deja una PREDICCIÓN falsable del efecto de la regla de `consoleNoise.ts`.
//
// ## Por qué (T-210, 28/07/2026)
//
// Los `console_error` eran el 95% del ruido de error del sistema (4.840/24 h) y nadie podía
// actuar sobre ellos: el mensaje dominante, `Failed to fetch`, mezcla al usuario que pierde
// funcionalidad con el que simplemente cambió de página. La regla nueva baja a `debug` el
// fallo de RED **solo** cuando la página se está yendo — pero eso no se puede simular hacia
// atrás, porque ese dato no se guardaba. Lo que sí se puede es acotar el efecto:
//   · ya-ruido      → GSI/FedCM/401, que ya bajaban a debug
//   · CANDIDATOS    → mensaje de red: bajarán solo si la pestaña se estaba yendo
//   · APLICACIÓN    → la regla no los toca NUNCA (frontera fijada por tests)
//
// Y de ahí sale el número con el que se juzga el despliegue: si tras desplegar los errores
// se quedan cerca de la cota ALTA, es que ocurren con la pestaña visible y hay daño real.
// Correrlo ANTES y DESPUÉS del deploy es la verificación; sin él, "el ruido bajó" no se
// puede distinguir de "se silenció señal".
//
// Uso:  node scripts/observabilidad/sim-ruido-console.cjs [--dias N]
// Solo lectura.
require('dotenv').config({path:'.env.local'});
const {Client}=require('pg');
// SIMULACIÓN: aplicar la nueva regla a los console_error YA registrados.
// No se puede saber retroactivamente si la página se estaba yendo (el dato no se guardaba),
// así que se mide la COTA: cuántos son candidatos (mensaje de red) y cuántos son errores de
// aplicación que la regla NO tocará nunca. Eso acota el efecto esperado del despliegue.
const RE_RUIDO_SIEMPRE=/\[GSI_LOGGER\]|FedCM|\b401\b|HTTP 401/i;
const RE_RED=/failed to fetch|networkerror|load failed|aborterror|operation was aborted|err_network|err_internet_disconnected/i;
const i=process.argv.indexOf('--dias');
const DIAS=i>0&&process.argv[i+1]?parseInt(process.argv[i+1],10):3;
(async()=>{const c=new Client({connectionString:process.env.DATABASE_URL.split('?')[0],ssl:{rejectUnauthorized:false}});await c.connect();
const r=await c.query(`SELECT coalesce(error_message,'') m, severity, count(*)::int n
 FROM observable_events WHERE event_type='console_error' AND created_at >= NOW()-INTERVAL '${DIAS} days'
 GROUP BY 1,2`);
let total=0,yaRuido=0,candidato=0,app=0;
for(const x of r.rows){ total+=x.n;
  if(RE_RUIDO_SIEMPRE.test(x.m)) yaRuido+=x.n;
  else if(RE_RED.test(x.m)) candidato+=x.n;
  else app+=x.n; }
const pct=v=>((v/total)*100).toFixed(1)+'%';
console.log(`console_error en ${DIAS} días: ${total}`);
console.log(`  ya eran ruido (GSI/FedCM/401):        ${String(yaRuido).padStart(5)}  ${pct(yaRuido)}`);
console.log(`  CANDIDATOS (mensaje de red):          ${String(candidato).padStart(5)}  ${pct(candidato)}  ← bajarán a debug SOLO si la pestaña se estaba yendo`);
console.log(`  errores de APLICACIÓN (nunca tocados):${String(app).padStart(5)}  ${pct(app)}`);
console.log(`\nPREDICCIÓN tras desplegar: los errores a severidad 'error' caen a un valor entre ${app} (si TODOS los de red eran abortos) y ${app+candidato} (si ninguno lo era).`);
console.log(`Si el número real se queda cerca de ${app+candidato}, es que ocurren con la pestaña VISIBLE → daño real, no ruido.`);
await c.end();})().catch(e=>console.error('ERR',e.message));
