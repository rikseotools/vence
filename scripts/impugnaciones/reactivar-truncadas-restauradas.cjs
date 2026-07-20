#!/usr/bin/env node
// Reactiva las 5 preguntas que se ocultaron por "enunciado truncado irresoluble" y cuyo texto
// ÍNTEGRO se ha recuperado después desde el JSON de origen. Ya no son irresolubles.
// Vuelven al estado que tenían antes de ocultarlas (backup-truncadas-ocultadas.json del paso previo).
const fs=require('fs'),path=require('path');
const pg=require(path.join(__dirname,'..','..','backend','node_modules','postgres'));
const url=fs.readFileSync(path.join(__dirname,'..','..','.env.local'),'utf8').match(/^DATABASE_URL=(.*)$/m)[1].trim();
const sql=pg(url,{ssl:{rejectUnauthorized:false},max:2});
const DRY=!process.argv.includes('--apply');
const PFX=['190d8bf6','d7af3b87','bf5c3dfa','f742636f','8ff3dea5'];
const LONGITUD_TRUNCADA=[80,100,120];
(async()=>{
  console.log(DRY?'— DRY RUN —':'— REACTIVANDO —');
  for(const p of PFX){
    const q=(await sql`SELECT id, lifecycle_state, question_text, correct_option FROM questions WHERE left(id::text,8)=${p}`)[0];
    if(!q) throw new Error(`${p}: no encontrada`);
    // GUARDARRAÍL: no reactivar si el enunciado sigue truncado
    if(LONGITUD_TRUNCADA.includes(q.question_text.length) && /[a-záéíóúñ ]$/.test(q.question_text))
      throw new Error(`${p}: SIGUE truncada (${q.question_text.length} chars) — no se reactiva`);
    if(q.lifecycle_state!=='needs_human'){console.log(`  ${p} no está en needs_human (${q.lifecycle_state}), salto`);continue;}
    console.log(`  ${p} needs_human → approved | enunciado ${q.question_text.length} chars | clave ${'ABCD'[q.correct_option]} intacta`);
    if(DRY) continue;
    await sql`SELECT public.transition_question_state(${q.id}::uuid,'needs_human'::text,'approved'::text,
      'admin_repaired_quarantine'::text, NULL::uuid, NULL::uuid,
      ${'Reactivada: el enunciado truncado se restauro integro desde el JSON scrapeado de origen, asi que ya no es irresoluble. Clave no tocada.'}::text)`;
  }
  if(!DRY){
    const chk=await sql`SELECT left(id::text,8) qid, lifecycle_state, is_active, length(question_text) len
      FROM questions WHERE left(id::text,8)=ANY(${PFX}) ORDER BY 1`;
    console.table(chk);
  }
  await sql.end();
})().catch(e=>{console.error('❌',e.message);process.exit(1)});
