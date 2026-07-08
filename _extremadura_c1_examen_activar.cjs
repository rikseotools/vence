// Activa las preguntas del examen C1 confirmadas por la 2ª pasada (verificación ciega).
require('dotenv').config({ path: '.env.local' });
const postgres = require('postgres');
const { createClient } = require('@supabase/supabase-js');
const sql = postgres(process.env.DATABASE_URL, { prepare: false, max: 1 });
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const fs = require('fs');
const SP = '/tmp/claude-1000/-home-manuel-Documentos-github-vence/ab7731c9-92e7-4083-8aed-4aaceef7d2cb/scratchpad';
const ADMIN = '2fc60bc8-1f9a-42c8-9c60-845c00af4a1f';

(async () => {
  const verds = ['verd_0_11','verd_12_23','verd_24_35','verd_36_47']
    .flatMap(f => { const p=`${SP}/${f}.json`; if(!fs.existsSync(p)){console.error('FALTA',f);process.exit(1);} return JSON.parse(fs.readFileSync(p,'utf8')); });
  const confirmed = verds.filter(v => v.verdict === 'confirm');
  const rejected = verds.filter(v => v.verdict !== 'confirm');
  console.log(`Verdicts: ${verds.length} | confirmadas: ${confirmed.length} | rechazadas: ${rejected.length}`);
  if (rejected.length) console.log('Rechazadas (quedan draft):', rejected.map(r=>r.qid.slice(0,8)+':'+(r.notes||'').slice(0,40)).join(' | '));

  if (process.argv[2] !== '--apply') { console.log('DRY-RUN (--apply para activar)'); await sql.end(); return; }

  let ok=0, err=0;
  for (const v of confirmed) {
    try {
      // law_id del artículo
      const [q] = await sql`SELECT primary_article_id FROM questions WHERE id=${v.qid}`;
      const [art] = await sql`SELECT law_id FROM articles WHERE id=${q.primary_article_id}`;
      // 1. fila de verificación real (2ª pasada independiente)
      const [ver] = await sql`
        INSERT INTO ai_verification_results
          (question_id, article_id, law_id, is_correct, confidence, explanation,
           ai_provider, ai_model, verified_at, article_ok, answer_ok, explanation_ok, options_ok)
        VALUES (${v.qid}, ${q.primary_article_id}, ${art.law_id}, true, 'alta',
           'Verificación independiente doble pasada (solver + auditor ciego) contra artículo vigente. Examen oficial C1 Extremadura 2022.',
           'claude_code', 'claude-opus-4-8', now(), true, true, true, true)
        RETURNING id`;
      // 2. transición draft -> approved
      await sql`SELECT public.transition_question_state(
        ${v.qid}::uuid, 'draft'::text, 'approved'::text, 'ai_verified_perfect'::text,
        ${ADMIN}::uuid, ${ver.id}::uuid, 'Examen oficial C1 Extremadura 2022 verificado (2 pasadas)'::text)`;
      ok++;
    } catch (e) { console.error('❌', v.qid.slice(0,8), e.message); err++; }
  }
  // verificar activación
  const ids = confirmed.map(v=>v.qid);
  const active = await sql`SELECT count(*)::int AS n FROM questions WHERE id = ANY(${ids}) AND is_active=true`;
  console.log(`✅ Activadas: ${ok} | errores: ${err} | is_active=true verificadas: ${active[0].n}`);
  await sql.end();
})();
