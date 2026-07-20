#!/usr/bin/env node
// Oculta (needs_human) las 5 preguntas cuyo enunciado, truncado por el bug de import de ancho fijo,
// pierde la premisa que decide la respuesta o directamente no llega a formular la pregunta.
// Las otras 105 truncadas se DEJAN VIVAS: el corte es cosmético y la clave sigue siendo identificable.
// NO se toca ninguna clave. Reversible con el backup.
const fs=require('fs'),path=require('path');
const pg=require(path.join(__dirname,'..','..','backend','node_modules','postgres'));
const url=fs.readFileSync(path.join(__dirname,'..','..','.env.local'),'utf8').match(/^DATABASE_URL=(.*)$/m)[1].trim();
const sql=pg(url,{ssl:{rejectUnauthorized:false},max:2});
const DRY=!process.argv.includes('--apply');
const IRR=JSON.parse(fs.readFileSync(path.join(__dirname,'truncadas-irresolubles.json'),'utf8'));
(async()=>{
  console.log(DRY?'— DRY RUN —':'— APLICANDO —', IRR.length, 'preguntas');
  const backup=[];
  for(const it of IRR){
    const q=(await sql`SELECT id, correct_option, lifecycle_state FROM questions WHERE id=${it.id}`)[0];
    if(!q) throw new Error(`${it.id}: no encontrada`);
    if(q.lifecycle_state==='needs_human'){console.log(`  ${it.id.slice(0,8)} ya oculta, salto`);continue;}
    console.log(`  ${it.id.slice(0,8)} ${q.lifecycle_state} → needs_human (clave ${'ABCD'[q.correct_option]} INTACTA)`);
    backup.push({id:q.id, estado_anterior:q.lifecycle_state, correct_option:q.correct_option});
    if(DRY) continue;
    const nota=`Enunciado truncado por el bug de import de ancho fijo (80/100/120 chars, lote LEC 2026-02-21): ${(it.razon||'').replace(/'/g,'').slice(0,150)}. Texto original no recuperable. Revision 20/07.`;
    await sql`SELECT public.transition_question_state(${q.id}::uuid, ${q.lifecycle_state}::text,
      'needs_human'::text, 'structural_invalid'::text, NULL::uuid, NULL::uuid, ${nota}::text)`;
  }
  if(!DRY){
    fs.writeFileSync(path.join(__dirname,'backup-truncadas-ocultadas.json'),JSON.stringify(backup,null,1));
    const chk=await sql`SELECT left(id::text,8) pfx, lifecycle_state, is_active, correct_option
      FROM questions WHERE id = ANY(${IRR.map(i=>i.id)}) ORDER BY 1`;
    console.table(chk.map(r=>({...r,clave:'ABCD'[r.correct_option]})));
  }
  await sql.end();
})().catch(e=>{console.error('❌',e.message);process.exit(1)});
