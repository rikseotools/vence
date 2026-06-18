// Generic rule-based apply. WAVE=N. DRY_RUN=1 imprime.
// Reglas: answer-correct -> reseal ; answer_wrong/ambiguous/real!=marcada -> needs_human (NUNCA flip).
const fs = require('fs');
const B = '/home/manuel/Documentos/github/vence/node_modules/';
require(B + 'dotenv').config({ path: '/home/manuel/Documentos/github/vence/.env.local' });
const postgres = require(B + 'postgres');
const sql = postgres(process.env.DATABASE_URL, { ssl: 'require', max: 4 });
const W = process.env.WAVE, DRY = process.env.DRY_RUN === '1';
if (!W) { console.error('falta WAVE'); process.exit(1); }

const ledger = JSON.parse(fs.readFileSync(`/tmp/wave${W}_ledger.json`,'utf8'));
const byId = Object.fromEntries(ledger.map(q=>[q.id,q]));

(async () => {
  // Cargar deep válidos
  const deep = {}; let skipped = [];
  for (let n=1;n<=8;n++){
    let d; try{ d=JSON.parse(fs.readFileSync(`/tmp/wave${W}_deep_${n}.json`,'utf8')); }catch(_){ skipped.push(`f${n}:missing`); continue; }
    const ids=new Set(d.map(x=>x.id));
    const withClause=d.filter(x=>(x.controlling_clause||'').length>10).length;
    if (ids.size < Math.min(24, d.length) || withClause < 0.7*d.length){ skipped.push(`f${n}:n=${d.length}/uniq=${ids.size}/clause=${withClause}`); continue; }
    for(const x of d) if(byId[x.id]) deep[x.id]=x;
  }
  if (skipped.length) console.log('FICHEROS OMITIDOS (degenerados, vuelven al pool):', skipped.join(' | '));

  const RESEAL=[], NH=[];
  for (const id in deep){
    const d=deep[id], q=byId[id];
    const marked=['A','B','C','D','E'][q.correct_option];
    const real=d.real_correct_letter;
    let disp;
    if (d.root_cause==='marked_is_fine') disp={t:'reseal',ao:true,oo:true,sugg:null};
    else if (d.root_cause==='answer_wrong'||d.root_cause==='outdated_by_reform'||d.root_cause==='ambiguous_unresolvable') disp={t:'nh'};
    else if (['wrong_article','needs_other_law','bad_option'].includes(d.root_cause)){
      // re-sellar SOLO si el agente afirma explícitamente que la clave marcada es correcta
      if (d.marked_answer_is_correct===true && (!real || real===marked)){
        disp={t:'reseal', ao: !['wrong_article','needs_other_law'].includes(d.root_cause), oo: d.root_cause!=='bad_option', sugg: d.root_cause!=='bad_option'?(d.reason||'').slice(0,200):null};
      } else disp={t:'nh'};
    } else disp={t:'nh'};
    if (disp.t==='reseal') RESEAL.push({id,...disp,reason:(d.reason||'').slice(0,200),conf:d.confidence||'alta'});
    else NH.push({id, note:(d.root_cause+': '+(d.reason||'')).slice(0,250)});
  }
  console.log(`Ola ${W}: deep válidos=${Object.keys(deep).length} | reseal=${RESEAL.length} needs_human=${NH.length}`);
  if (DRY){ console.log('(dry-run)'); await sql.end(); return; }

  let rs=0,disc=0,hum=0;
  for (const r of RESEAL){
    const [art]=await sql`SELECT q.primary_article_id, a.law_id FROM questions q JOIN articles a ON a.id=q.primary_article_id WHERE q.id=${r.id}`;
    await sql`INSERT INTO ai_verification_results (question_id,article_id,law_id,ai_provider,ai_model,review_method_version,answer_ok,article_ok,options_ok,explanation,correct_article_suggestion,confidence,verified_at)
      VALUES (${r.id},${art.primary_article_id},${art.law_id},'claude_code_recheck','claude-sonnet-4-6','v2.1',true,${r.ao},${r.oo},${('v2.1 ola'+W+': '+r.reason).slice(0,290)},${r.sugg},${r.conf},now())
      ON CONFLICT (question_id,ai_provider) DO UPDATE SET answer_ok=true,article_ok=${r.ao},options_ok=${r.oo},explanation=excluded.explanation,correct_article_suggestion=${r.sugg},review_method_version='v2.1',verified_at=now()`;
    rs++;
    const u=await sql`UPDATE ai_verification_results SET discarded=true,discarded_at=now() WHERE question_id=${r.id} AND answer_ok=false AND COALESCE(discarded,false)=false`;
    disc+=u.count;
  }
  for (const x of NH){
    const [cur]=await sql`SELECT lifecycle_state FROM questions WHERE id=${x.id}`;
    if (!['approved','tech_approved'].includes(cur.lifecycle_state)){ continue; }
    try{ await sql`SELECT public.transition_question_state(${x.id}::uuid,${cur.lifecycle_state}::text,'needs_human'::text,'admin_marked_problem'::text,NULL::uuid,NULL::uuid,${('v2.1 ola'+W+' '+x.note).slice(0,250)}::text)`; hum++; }
    catch(e){ console.log('  nh err',x.id.slice(0,8),e.message); }
  }
  console.log(`re-sellados=${rs} flags_descartados=${disc} needs_human=${hum}`);
  try{ const rv=await fetch('https://www.vence.es/api/admin/revalidate',{method:'POST',headers:{'Content-Type':'application/json','x-cron-secret':process.env.CRON_SECRET},body:JSON.stringify({tag:'questions'})}); console.log('revalidate:',rv.status);}catch(e){console.log('revalidate fallo:',e.message);}
  await sql.end();
})().catch(async e=>{console.error('ERROR',e.message);try{await sql.end();}catch(_){}process.exit(1);});
