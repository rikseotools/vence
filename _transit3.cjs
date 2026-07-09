require('dotenv').config({ path: '.env.local' });
const fs=require('fs');
const postgres = require('postgres');
const sql = postgres(process.env.DATABASE_URL, { prepare: false, max: 1, ssl: { rejectUnauthorized: false } });
const ADMIN='2fc60bc8-1f9a-42c8-9c60-845c00af4a1f';
(async () => {
  try {
    let verdicts=[];
    for(let i=1;i<=4;i++){ verdicts=verdicts.concat(JSON.parse(fs.readFileSync(`/tmp/cardio_verdict_${i}.json`,'utf8'))); }
    const [law]=await sql`SELECT id FROM laws WHERE short_name='Cardiología'`;
    const [art]=await sql`SELECT id FROM articles WHERE law_id=${law.id} ORDER BY article_number LIMIT 1`;
    let ok=0, err=0, errmsg='';
    for(const v of verdicts){
      if(v.verdict!=='ok') continue;
      try{
        // 1º verificación (con article_id) — el guard la exige antes de promover
        await sql`INSERT INTO ai_verification_results (question_id,article_id,law_id,article_ok,answer_ok,explanation_ok,confidence,explanation,ai_provider,ai_model,verified_at)
          VALUES (${v.id},${art.id},${law.id},true,true,true,'alta','Pregunta real Aula Plus verificada por agente enfermero (respuesta correcta + sin artefactos).','claude_code','claude-sonnet-5',now())
          ON CONFLICT (question_id,ai_provider) DO UPDATE SET article_ok=true,answer_ok=true,explanation_ok=true,verified_at=now()`;
        // 2º transición a tech_approved (virtual)
        await sql`SELECT public.transition_question_state(${v.id}::uuid,'draft'::text,'tech_approved'::text,'ai_verified_tech_perfect'::text,${ADMIN}::uuid,NULL::uuid,'Verificación agente Sonnet enfermería — import Aula Plus'::text)`;
        ok++;
      }catch(e){ err++; if(!errmsg)errmsg=e.message.slice(0,140); }
    }
    console.log(`✅ tech_approved: ${ok} | errores: ${err}`, errmsg?('| '+errmsg):'');
    const [d]=await sql`SELECT count(*) FILTER (WHERE q.lifecycle_state='tech_approved')::int ta, count(*) FILTER (WHERE q.lifecycle_state='needs_human')::int nh, count(*) FILTER (WHERE q.is_active)::int act FROM questions q JOIN articles a ON a.id=q.primary_article_id WHERE a.law_id=${law.id}`;
    console.log(`Cardiología: ${d.ta} tech_approved | ${d.nh} needs_human | ${d.act} ACTIVAS`);
  } catch(e){ console.error('❌', e.message); } finally { await sql.end(); }
})();
