#!/usr/bin/env node
/**
 * apply-ce-relink.cjs — aplica un batch de revínculos "otra ley (mismo nº art) → CE".
 *
 * Causa raíz que ataca: preguntas de la Constitución vinculadas por nº de artículo
 * al artículo del mismo número de OTRA ley (típicamente Código Penal), sin cruzar law_id.
 *
 * Uso:  node scripts/impugnaciones/apply-ce-relink.cjs <cand.json> <out.json>
 *   cand.json: candidatos (incluye ce_art_id, ce_content, co, cur_law, an, primary_article_id)
 *   out.json:  salida del agente verificador (id, ce_answers, correct_letter, explanation, confidence, notes)
 *
 * Guardarraíl (segunda pasada adversarial, no se fía del agente):
 *   - blockquote debe ser substring LITERAL de ce_content (tras normalizar espacios)
 *   - línea 1 con formato §5.1 exacto y la letra correcta
 *   - la letra del agente debe coincidir con correct_option (co); si no → NO aprueba
 * Solo si pasa las 3: relink primary_article_id + question_articles, INSERT verificación
 * (answer/explanation/article/options _ok=true), transición needs_human→approved.
 * ce_answers=false o fallo de guardarraíl → queda needs_human, documentado en audit trail.
 */
require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const sql = require('postgres')(process.env.DATABASE_URL, { ssl: { rejectUnauthorized: false }, max: 1 });
const PROVIDER = 'claude_code_ce_relink_2026_07';
const norm = s => (s || '').toLowerCase().replace(/\s+/g, ' ').trim();

(async () => {
  const [candPath, outPath] = process.argv.slice(2);
  if (!candPath || !outPath) { console.error('uso: apply-ce-relink.cjs <cand.json> <out.json>'); process.exit(1); }
  const cand = JSON.parse(fs.readFileSync(candPath, 'utf8'));
  const out = JSON.parse(fs.readFileSync(outPath, 'utf8'));
  const byId = Object.fromEntries(cand.map(c => [c.id, c]));
  const ceLaw = (await sql`SELECT id FROM laws WHERE short_name='CE'`)[0].id;

  let approved = 0; const failed = []; const parked = [];
  for (const r of out) {
    const c = byId[r.id];
    if (!c) { failed.push({ id: r.id, why: 'no_cand' }); continue; }
    const conf = r.confidence || 'media';

    if (!r.ce_answers) {
      parked.push({ id: r.id.slice(0, 8), why: (r.notes || '').slice(0, 55) });
      const pexpl = 'No relinkable a CE mismo número: ' + (r.notes || 'artículo CE ajeno');
      await sql`INSERT INTO ai_verification_results (question_id,article_id,law_id,article_ok,answer_ok,explanation_ok,options_ok,is_correct,confidence,explanation,ai_provider,ai_model,verified_at)
        VALUES (${c.id},${c.primary_article_id || c.ce_art_id},${ceLaw},false,false,false,false,false,${conf},${pexpl},${PROVIDER},'claude-sonnet-5',now())
        ON CONFLICT (question_id,ai_provider) DO UPDATE SET explanation=EXCLUDED.explanation,answer_ok=false,verified_at=now()`;
      continue;
    }

    const e = r.explanation || '';
    const letter = r.correct_letter;
    const bq = (e.match(/^> (.+)$/m) || [])[1] || '';
    const bqOk = bq.length > 20 && norm(c.ce_content).includes(norm(bq));
    const fmtOk = e.startsWith('La respuesta correcta es **' + letter + ')');
    const claveOk = letter === 'ABCD'[c.co];

    if (bqOk && fmtOk && claveOk) {
      const vexpl = `Relink ${c.cur_law} art${c.an} → CE art${c.an} + explicación §5.1 (blockquote literal verificado).`;
      await sql`UPDATE questions SET primary_article_id=${c.ce_art_id}, explanation=${e}, topic_review_status='perfect', verified_at=now() WHERE id=${c.id}`;
      await sql`DELETE FROM question_articles WHERE question_id=${c.id}`;
      await sql`INSERT INTO question_articles (question_id,article_id) VALUES (${c.id},${c.ce_art_id}) ON CONFLICT DO NOTHING`;
      await sql`INSERT INTO ai_verification_results (question_id,article_id,law_id,article_ok,answer_ok,explanation_ok,options_ok,is_correct,confidence,explanation,ai_provider,ai_model,verified_at)
        VALUES (${c.id},${c.ce_art_id},${ceLaw},true,true,true,true,true,${conf},${vexpl},${PROVIDER},'claude-sonnet-5',now())
        ON CONFLICT (question_id,ai_provider) DO UPDATE SET article_id=EXCLUDED.article_id,answer_ok=true,article_ok=true,explanation_ok=true,options_ok=true,verified_at=now()`;
      const cur = (await sql`SELECT lifecycle_state ls FROM questions WHERE id=${c.id}`)[0].ls;
      if (cur === 'needs_human') {
        await sql`SELECT public.transition_question_state(${c.id}::uuid,'needs_human'::text,'approved'::text,'ai_verified_perfect'::text,NULL::uuid,NULL::uuid,'relink otra-ley→CE'::text)`;
      }
      approved++;
    } else {
      failed.push({ id: r.id.slice(0, 8), bqOk, fmtOk, claveOk });
    }
  }

  console.log(`APROBADAS: ${approved} | FALLARON guardarraíl: ${failed.length} | PARKED (ce_answers=false): ${parked.length}`);
  if (failed.length) console.log('fails:', JSON.stringify(failed));
  if (parked.length) console.log('parked:', JSON.stringify(parked));
  await sql.end();
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
