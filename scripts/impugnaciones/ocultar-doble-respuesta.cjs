#!/usr/bin/env node
// Oculta las 2 preguntas con DOBLE RESPUESTA CORRECTA detectadas en la revisión del 20/07.
//
// Por qué no requiere criterio editorial: una pregunta con dos opciones literalmente ciertas
// PUNTÚA MAL al opositor independientemente de cuál se considere "la buena". Reconocer que está
// rota es una decisión técnica; decidir cuál debe ser la clave sí sería editorial, y NO se hace
// aquí (la clave se deja intacta).
//
// Reversible: transition_question_state deja el motivo en el audit trail y hay backup.
const fs=require('fs'),path=require('path');
const pg=require(path.join(__dirname,'..','..','backend','node_modules','postgres'));
const url=fs.readFileSync(path.join(__dirname,'..','..','.env.local'),'utf8').match(/^DATABASE_URL=(.*)$/m)[1].trim();
const sql=pg(url,{ssl:{rejectUnauthorized:false},max:2});
const DRY=!process.argv.includes('--apply');

const CASOS=[
  { pfx:'f81a7b99', clave:'A',
    nota:'Doble respuesta correcta (Manual de Identidad Corporativa JA, sobres tipo bolsa): el articulo dice LITERALMENTE "Tipografia para los datos de contacto: Noto Sans HK Regular 7 pt" (opcion A) Y "El formato principal sera 250 x 300 mm, aunque los sobres podran ser de diversos tamanyos manteniendo la proporcion" (opcion B). Ambas ciertas palabra por palabra. Revision 20/07.' },
  { pfx:'ac1da0f0', clave:'D',
    nota:'La pregunta pide un valor unico ("cuantos grados") pero NUESTRA PROPIA teoria da un rango: "Fowler alta: ~60-90". Las opciones A (60), B (70) y C (80) caen las tres dentro, asi que el opositor que estudie nuestro material respondera una de ellas y se le contara mal frente a la clave D ("ninguna"). Defecto de la pregunta contra su propio temario. Arreglo: alinear pregunta y teoria, no voltear la clave. Revision 20/07.' },
];

(async()=>{
  console.log(DRY?'— DRY RUN (usa --apply) —':'— APLICANDO —');
  const backup=[];
  for(const c of CASOS){
    const q=(await sql`SELECT id, correct_option, lifecycle_state, is_active FROM questions WHERE left(id::text,8)=${c.pfx}`)[0];
    if(!q) throw new Error(`${c.pfx}: no encontrada`);
    const clave='ABCD'[q.correct_option];
    if(clave!==c.clave) throw new Error(`${c.pfx}: clave en BD ${clave}, esperaba ${c.clave} — ABORTA`);
    if(q.lifecycle_state==='needs_human'){console.log(`  ${c.pfx} ya oculta, salto`);continue;}
    console.log(`  ${c.pfx} ${q.lifecycle_state} → needs_human (clave ${clave} INTACTA)`);
    backup.push({pfx:c.pfx, id:q.id, estado_anterior:q.lifecycle_state, correct_option:q.correct_option});
    if(DRY) continue;
    await sql`SELECT public.transition_question_state(${q.id}::uuid, ${q.lifecycle_state}::text,
      'needs_human'::text, 'admin_marked_problem'::text, NULL::uuid, NULL::uuid, ${c.nota}::text)`;
  }
  if(!DRY){
    fs.writeFileSync(path.join(__dirname,'backup-doble-respuesta.json'),JSON.stringify(backup,null,1));
    const chk=await sql`SELECT left(id::text,8) qid, lifecycle_state, is_active, correct_option
      FROM questions WHERE left(id::text,8)=ANY(${CASOS.map(c=>c.pfx)}) ORDER BY 1`;
    console.table(chk.map(r=>({...r, clave:'ABCD'[r.correct_option]})));
  }
  await sql.end();
})().catch(e=>{console.error('❌',e.message);process.exit(1)});
