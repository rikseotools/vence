#!/usr/bin/env node
// Aplica el lote de reescritura de explicaciones (tramo tráfico >=10 respuestas).
// GUARDARRAÍLES: no escribe nada si valida-citas.cjs no está limpio; nunca toca clave ni artículo;
// transacción por pregunta; trazado en AVR con proveedor propio de campaña.
const fs=require('fs'),path=require('path');
const pg=require(path.join(__dirname,'..','..','backend','node_modules','postgres'));
const url=fs.readFileSync(path.join(__dirname,'..','..','.env.local'),'utf8').match(/^DATABASE_URL=(.*)$/m)[1].trim();
const sql=pg(url,{ssl:{rejectUnauthorized:false},max:3});
const PROVIDER='claude_code_expl_traffic_v1';
const DIR=path.join(__dirname,'lote-shards');
const DRY=!process.argv.includes('--apply');

(async()=>{
  const val=JSON.parse(fs.readFileSync(path.join(__dirname,'validacion-citas.json'),'utf8'));
  if(val.malas.length){console.error(`❌ ${val.malas.length} citas NO literales — corrige antes de aplicar`);process.exit(1);}
  if(val.sinBQ.length){console.error(`❌ ${val.sinBQ.length} sin blockquote — corrige antes de aplicar`);process.exit(1);}

  const items=[];
  for(const f of fs.readdirSync(DIR).filter(f=>/^out-\d+\.json$/.test(f)))
    for(const r of JSON.parse(fs.readFileSync(path.join(DIR,f),'utf8')))
      if(r.nueva_explicacion) items.push(r);

  const before=await sql`SELECT id, correct_option, primary_article_id FROM questions
                         WHERE id = ANY(${items.map(i=>i.id)})`;
  const snap=Object.fromEntries(before.map(r=>[r.id,r]));
  console.log(`${items.length} a aplicar | ${val.flags.length} flagged (se dejan intactas)`);
  if(DRY){console.log('— DRY RUN — (usa --apply)');await sql.end();return;}

  let n=0;
  for(const it of items){
    const s=snap[it.id]; if(!s){console.warn('  ⚠️ no encontrada',it.id.slice(0,8));continue;}
    await sql.begin(async tx=>{
      await tx`UPDATE questions SET explanation=${it.nueva_explicacion}, updated_at=now() WHERE id=${it.id}`;
      await tx`INSERT INTO ai_verification_results
                 (question_id, article_id, ai_provider, ai_model, is_correct,
                  article_ok, answer_ok, explanation_ok, fix_applied, fix_applied_at,
                  new_explanation, review_method_version, verified_at, explanation)
               VALUES (${it.id}, ${s.primary_article_id}, ${PROVIDER}, 'claude-opus-4-8', true,
                  true, true, true, true, now(), ${it.nueva_explicacion}, 'v2.1', now(),
                  'Reescritura de formato didáctico (blockquote literal + análisis A/B/C/D). Clave y artículo NO tocados.')
               ON CONFLICT (question_id, ai_provider) DO UPDATE
                 SET new_explanation=EXCLUDED.new_explanation, explanation_ok=true,
                     fix_applied=true, fix_applied_at=now(), verified_at=now()`;
    });
    n++;
  }
  // INVARIANTE: ninguna clave ni artículo puede haber cambiado
  const after=await sql`SELECT id, correct_option, primary_article_id FROM questions
                        WHERE id = ANY(${items.map(i=>i.id)})`;
  const drift=after.filter(r=>r.correct_option!==snap[r.id].correct_option
                            || r.primary_article_id!==snap[r.id].primary_article_id);
  console.log(`✅ ${n} aplicadas | drift de clave/artículo: ${drift.length}`);
  if(drift.length){console.error('❌ DRIFT DETECTADO',drift.map(d=>d.id));process.exit(1);}
  await sql.end();
})().catch(e=>{console.error('❌',e.message);process.exit(1)});
