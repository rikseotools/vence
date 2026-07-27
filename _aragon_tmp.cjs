const {Client}=require('pg');const fs=require('fs');
const url=fs.readFileSync('.env.local','utf8').match(/^DATABASE_URL=(.*)$/m)[1].trim().replace(/[?&]sslmode=[a-z-]+/,'');
(async()=>{const c=new Client({connectionString:url,ssl:{rejectUnauthorized:false}});await c.connect();
const cv=(await c.query(`select cv.id, cv.plazas_libres, cv.plazas_totales, cv."año", cv.boe_reference, cv.estado_proceso
  from convocatorias cv join oposiciones o on o.id=cv.oposicion_id where o.slug='administrativo-aragon' and cv.is_current`)).rows[0];
console.log('plazas_libres:', cv.plazas_libres, '| totales:', cv.plazas_totales, '| ciclo:', cv.año, '| estado:', cv.estado_proceso);
console.log('boe_reference:', cv.boe_reference);
const d=await c.query(`select tipo, left(titulo,60) t, length(extracted_text) len, left(url,75) u from convocatoria_documentos where convocatoria_id=$1 order by created_at`,[cv.id]);
console.log('\ndocumentos ('+d.rowCount+'):');
for(const x of d.rows) console.log(' ·['+x.tipo+'] '+x.t+' | '+x.len+'ch | '+x.u);
await c.end();})().catch(e=>console.error('ERR',e.message));
