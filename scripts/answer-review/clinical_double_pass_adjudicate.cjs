// Adjudicación Ola 20 clínica doble-pasada. p1=wave20_deep, p2=wave20_audit. DRY_RUN=1 imprime.
const fs=require('fs');
const B='/home/manuel/Documentos/github/vence/node_modules/';
require(B+'dotenv').config({path:'/home/manuel/Documentos/github/vence/.env.local'});
const postgres=require(B+'postgres'); const sql=postgres(process.env.DATABASE_URL,{ssl:'require',max:4});
const DRY=process.env.DRY_RUN==='1';

const ledger=JSON.parse(fs.readFileSync('/tmp/wave20_ledger.json','utf8'));
const byId=Object.fromEntries(ledger.map(q=>[q.id,q]));
const load=(pfx)=>{const o={};for(let n=1;n<=8;n++){try{for(const x of JSON.parse(fs.readFileSync(`/tmp/${pfx}_${n}.json`,'utf8'))) if(byId[x.id]) o[x.id]=x;}catch(_){}}return o;};
const p1=load('wave20_deep'), p2=load('wave20_audit');

const Q=new Set(['answer_wrong','bad_option','ambiguous_unresolvable','needs_other_law']); // cuestiona la respuesta
const OK=new Set(['marked_is_fine','wrong_article']);
const nh=[],reseal=[],leave=[],nop2=[];
for(const id in p1){
  const a=p1[id], b=p2[id];
  if(!b){ nop2.push(id); continue; }
  const d1=Q.has(a.root_cause), d2=Q.has(b.root_cause), ok1=OK.has(a.root_cause), ok2=OK.has(b.root_cause);
  if(d1&&d2) nh.push({id,p1:a.root_cause,p2:b.root_cause,p1r:a.real_correct_letter,p2r:b.real_correct_letter,law:byId[id].law});
  else if(ok1&&ok2) reseal.push({id,wa:a.root_cause==='wrong_article'||b.root_cause==='wrong_article'});
  else leave.push({id,why:`${a.root_cause}/${b.root_cause}`});
}
const sameLetter=nh.filter(x=>x.p1==='answer_wrong'&&x.p2==='answer_wrong'&&x.p1r&&x.p1r===x.p2r).length;
console.log(`p1=${Object.keys(p1).length} p2=${Object.keys(p2).length} | needs_human=${nh.length} reseal=${reseal.length} leave=${leave.length} sin_p2=${nop2.length}`);
console.log(`  (de needs_human, answer_wrong con MISMA letra en ambas: ${sameLetter})`);
if(DRY){ console.log('(dry-run)'); sql.end(); return; }
(async()=>{
  let hum=0,rs=0,disc=0;
  for(const x of nh){
    const [cur]=await sql`SELECT lifecycle_state FROM questions WHERE id=${x.id}`;
    if(!['approved','tech_approved'].includes(cur.lifecycle_state)) continue;
    const note=`doble-pasada clinica ola20: p1=${x.p1} p2=${x.p2}`+(x.p1r?` p1->${x.p1r}`:'')+(x.p2r?` p2->${x.p2r}`:'')+' (clave contradice articulo-fuente)';
    try{ await sql`SELECT public.transition_question_state(${x.id}::uuid,${cur.lifecycle_state}::text,'needs_human'::text,'admin_marked_problem'::text,NULL::uuid,NULL::uuid,${note.slice(0,250)}::text)`; hum++; }catch(e){console.log('nh err',x.id.slice(0,8),e.message);}
  }
  for(const x of reseal){
    const [art]=await sql`SELECT q.primary_article_id, a.law_id FROM questions q JOIN articles a ON a.id=q.primary_article_id WHERE q.id=${x.id}`;
    await sql`INSERT INTO ai_verification_results (question_id,article_id,law_id,ai_provider,ai_model,review_method_version,answer_ok,article_ok,options_ok,explanation,confidence,verified_at)
      VALUES (${x.id},${art.primary_article_id},${art.law_id},'claude_code_audit','claude-sonnet-4-6','v2.1',true,${!x.wa},true,'doble-pasada clinica: ambas confirman clave correcta','alta',now())
      ON CONFLICT (question_id,ai_provider) DO UPDATE SET answer_ok=true,article_ok=${!x.wa},explanation=excluded.explanation,verified_at=now()`;
    const u=await sql`UPDATE ai_verification_results SET discarded=true,discarded_at=now() WHERE question_id=${x.id} AND answer_ok=false AND COALESCE(discarded,false)=false`;
    disc+=u.count; rs++;
  }
  console.log(`needs_human=${hum} reseal=${rs} flags_descartados=${disc} activas(desacuerdo)=${leave.length}`);
  const rv=await fetch('https://www.vence.es/api/admin/revalidate',{method:'POST',headers:{'Content-Type':'application/json','x-cron-secret':process.env.CRON_SECRET},body:JSON.stringify({tag:'questions'})});
  console.log('revalidate:',rv.status);
  await sql.end();
})().catch(e=>{console.error(e.message);process.exit(1)});
