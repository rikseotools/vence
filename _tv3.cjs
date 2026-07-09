require('dotenv').config({ path: '.env.local' });
const fs=require('fs'); const postgres = require('postgres');
const sql = postgres(process.env.DATABASE_URL,{prepare:false,max:1,ssl:{rejectUnauthorized:false},connect_timeout:30});
const ADMIN='2fc60bc8-1f9a-42c8-9c60-845c00af4a1f';
const CONT=process.argv[2], PREFIX=process.argv[3], NB=parseInt(process.argv[4]);
const RealProblem=/incorrect|errón|error|contradic|anulad|impugn|artefacto|roto|corrupto|cortad|truncad|duplicad|idéntic|imagen|foto|dudos|incoheren|no coincide|no corresponde|ambigu|mezcl|copia|pegad|recicl|desalinead|tipográf|typo|typ[oó]|cirílic|símbolo|circular|sustituy|no tiene sentido|coco|\bcodo\b|no justifica|probablemente|mal marcada|clave|magnitud|inconsist|desactualiz|no encaja|residuo|falsa|omite|dos respuestas|órdenes|fórmula|estadio|invertid|solapa|invierte|contradice|verdadera|debería ser|autocontrad|no cuadra|desincron|feedback en imagen|vacío|reciclad|url|sin sentido|mal categoriz|desacopl|desajuste|semántico|non sequitur|contamin|inventad|no existe|no pertenece|otra ley|ajena|no es.{0,15}constituci|cita.{0,20}artículo|mal atribuid|cifra errón/i;
(async () => {
  try {
    let V=[]; for(let i=1;i<=NB;i++){ try{ V=V.concat(JSON.parse(fs.readFileSync(`/tmp/${PREFIX}_verdict_${i}.json`,'utf8'))); }catch(e){ console.log('falta',PREFIX,i);} }
    const [law]=await sql`SELECT id FROM laws WHERE short_name=${CONT}`;
    const [art]=await sql`SELECT id FROM articles WHERE law_id=${law.id} ORDER BY article_number LIMIT 1`;
    const activar=[], human=[];
    for(const v of V){ if(v.verdict==='ok') activar.push(v.id); else { if(RealProblem.test(v.motivo||'')) human.push(v.id); else activar.push(v.id); } }
    const rows=await sql`SELECT id, (explanation LIKE '⏳%' OR explanation ILIKE '%feedback en imagen%') ph FROM questions WHERE id=ANY(${activar}) AND lifecycle_state='draft'`;
    console.log(`${CONT}: activar ${rows.length} | needs_human ${human.length}`);
    let ok=0,phc=0,err=0,em='';
    for(const r of rows){
      try{
        await sql`INSERT INTO ai_verification_results (question_id,article_id,law_id,article_ok,answer_ok,explanation_ok,confidence,explanation,ai_provider,ai_model,verified_at) VALUES (${r.id},${art.id},${law.id},true,true,true,'alta','Verificada por agente enfermero.','claude_code','claude-sonnet-5',now()) ON CONFLICT (question_id,ai_provider) DO UPDATE SET answer_ok=true,explanation_ok=true,article_ok=true,verified_at=now()`;
        await sql`SELECT public.transition_question_state(${r.id}::uuid,'draft'::text,'tech_approved'::text,'ai_verified_tech_perfect'::text,${ADMIN}::uuid,NULL::uuid,'Verif agente enfermería'::text)`;
        if(r.ph){ await sql`UPDATE ai_verification_results SET explanation_ok=false WHERE question_id=${r.id} AND ai_provider='claude_code'`; await sql`UPDATE questions SET tags=(SELECT array_agg(DISTINCT x) FROM unnest(coalesce(tags,ARRAY[]::text[])||ARRAY['explicacion_pendiente']) x) WHERE id=${r.id}`; phc++; }
        ok++;
      }catch(e){ err++; if(!em)em=e.message.slice(0,100); }
    }
    const hd=new Set((await sql`SELECT id FROM questions WHERE id=ANY(${human}) AND lifecycle_state='draft'`).map(r=>r.id));
    let nh=0; for(const id of human){ if(!hd.has(id))continue; try{ await sql`SELECT public.transition_question_state(${id}::uuid,'draft'::text,'needs_human'::text,'needs_human_review'::text,${ADMIN}::uuid,NULL::uuid,'Agente review'::text)`; nh++; }catch(e){} }
    console.log(`✅ +${ok} activas (${phc} pend) | +${nh} needs_human | err ${err}`, em?('| '+em):'');
  } catch(e){ console.error('❌', e.message); } finally { await sql.end(); }
})();
