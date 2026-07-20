#!/usr/bin/env node
/**
 * apply-ce-residuo.cjs — resuelve el residuo del drenaje CE-relink clasificado por agente.
 * Uso: node scripts/impugnaciones/apply-ce-residuo.cjs <dir_con_res_NN.json_y_res_NN_out.json>
 *
 * kinds:
 *  - ce_relink   → verifica blockquote literal contra el art CE `ce_article` + fmt §5.1 + clave==co → relink+approve.
 *  - inplace_ok  → verifica blockquote literal contra el art ACTUAL (texto completo de BD) + fmt + clave==co → update expl + approve.
 *  - broken      → NO auto-retira; se lista para autorización humana (decisión de clave).
 *  - structural / other_law / inplace_needsfull → deja needs_human, actualiza la nota, lista.
 * Todo lo que no pasa el guardarraíl (blockquote no literal, clave≠co) → se lista como fallo, NO aprueba.
 */
require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const path = require('path');
const sql = require('postgres')(process.env.DATABASE_URL, { ssl: { rejectUnauthorized: false }, max: 1 });
const P = 'claude_code_ce_relink_2026_07';
const norm = s => (s || '').toLowerCase().replace(/\s+/g, ' ').trim();

(async () => {
  const dir = process.argv[2];
  if (!dir) { console.error('uso: apply-ce-residuo.cjs <dir>'); process.exit(1); }
  const ceLaw = (await sql`SELECT id FROM laws WHERE short_name='CE'`)[0].id;
  const outs = fs.readdirSync(dir).filter(f => /^res_\d+_out\.json$/.test(f)).sort();
  const cand = {};
  for (const f of fs.readdirSync(dir).filter(f => /^res_\d+\.json$/.test(f))) {
    for (const c of JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'))) cand[c.id] = c;
  }

  let ceOk = 0, inOk = 0; const broken = [], structural = [], otherLaw = [], needsfull = [], failed = [];
  for (const of of outs) {
    for (const r of JSON.parse(fs.readFileSync(path.join(dir, of), 'utf8'))) {
      const c = cand[r.id]; if (!c) { failed.push({ id: r.id, why: 'no_cand' }); continue; }
      const conf = r.confidence || 'media';

      if (r.kind === 'ce_relink') {
        const art = (await sql`SELECT id, content, law_id FROM articles WHERE law_id=${ceLaw} AND article_number=${String(r.ce_article)} LIMIT 1`)[0];
        const letter = r.correct_letter, e = r.explanation || '';
        const bq = (e.match(/^> (.+)$/m) || [])[1] || r.blockquote || '';
        if (art && bq.length > 20 && norm(art.content).includes(norm(bq)) && e.startsWith('La respuesta correcta es **' + letter + ')') && letter === 'ABCD'[c.co]) {
          await sql`UPDATE questions SET primary_article_id=${art.id}, explanation=${e}, topic_review_status='perfect', verified_at=now() WHERE id=${c.id}`;
          await sql`DELETE FROM question_articles WHERE question_id=${c.id}`;
          await sql`INSERT INTO question_articles (question_id,article_id) VALUES (${c.id},${art.id}) ON CONFLICT DO NOTHING`;
          await sql`UPDATE ai_verification_results SET article_id=${art.id}, law_id=${ceLaw}, article_ok=true, answer_ok=true, explanation_ok=true, options_ok=true, is_correct=true, confidence=${conf}, explanation=${'Residuo→CE art ' + r.ce_article + ' (relink correcto) + §5.1 literal.'}, verified_at=now() WHERE question_id=${c.id} AND ai_provider=${P}`;
          const s = (await sql`SELECT lifecycle_state ls FROM questions WHERE id=${c.id}`)[0].ls;
          if (s === 'needs_human') await sql`SELECT public.transition_question_state(${c.id}::uuid,'needs_human'::text,'approved'::text,'ai_verified_perfect'::text,NULL::uuid,NULL::uuid,'residuo relink CE'::text)`;
          ceOk++;
        } else failed.push({ id: r.id.slice(0, 8), kind: 'ce_relink', art: r.ce_article });
        continue;
      }

      if (r.kind === 'inplace_ok') {
        const art = (await sql`SELECT content FROM articles WHERE id=${c.id ? (await sql`SELECT primary_article_id FROM questions WHERE id=${c.id}`)[0].primary_article_id : null}`)[0];
        const letter = r.correct_letter, e = r.explanation || '';
        const bq = (e.match(/^> (.+)$/m) || [])[1] || r.blockquote || '';
        if (art && bq.length > 20 && norm(art.content).includes(norm(bq)) && e.startsWith('La respuesta correcta es **' + letter + ')') && letter === 'ABCD'[c.co]) {
          await sql`UPDATE questions SET explanation=${e}, topic_review_status='perfect', verified_at=now() WHERE id=${c.id}`;
          await sql`UPDATE ai_verification_results SET answer_ok=true, article_ok=true, explanation_ok=true, options_ok=true, is_correct=true, confidence=${conf}, explanation=${'Residuo: bien vinculada a ' + c.cur_law + ' art' + c.cur_an + ' (verificada en sitio) + §5.1 literal.'}, verified_at=now() WHERE question_id=${c.id} AND ai_provider=${P}`;
          const s = (await sql`SELECT lifecycle_state ls FROM questions WHERE id=${c.id}`)[0].ls;
          if (s === 'needs_human') await sql`SELECT public.transition_question_state(${c.id}::uuid,'needs_human'::text,'approved'::text,'ai_verified_perfect'::text,NULL::uuid,NULL::uuid,'residuo verif in-place'::text)`;
          inOk++;
        } else failed.push({ id: r.id.slice(0, 8), kind: 'inplace_ok', law: c.cur_law });
        continue;
      }

      if (r.kind === 'broken') broken.push({ id: r.id.slice(0, 8), qt: (c.qt || '').slice(0, 70), notes: (r.notes || '').slice(0, 140) });
      else if (r.kind === 'structural') structural.push({ id: r.id.slice(0, 8), notes: (r.notes || '').slice(0, 90) });
      else if (r.kind === 'other_law') otherLaw.push({ id: r.id.slice(0, 8), target: r.target_law, notes: (r.notes || '').slice(0, 90) });
      else if (r.kind === 'inplace_needsfull') needsfull.push({ id: r.id.slice(0, 8), letter: r.correct_letter, law: c.cur_law, an: c.cur_an });
      else failed.push({ id: r.id.slice(0, 8), kind: r.kind || 'unknown' });

      // actualizar nota documentando el diagnóstico (sin cambiar estado)
      if (['structural', 'other_law', 'inplace_needsfull'].includes(r.kind)) {
        await sql`UPDATE ai_verification_results SET explanation=${(r.kind + ': ' + (r.notes || r.target_law || '')).slice(0, 400)}, verified_at=now() WHERE question_id=${c.id} AND ai_provider=${P}`;
      }
    }
  }

  console.log(`ce_relink aprobadas: ${ceOk} | inplace_ok aprobadas: ${inOk}`);
  console.log(`broken (autorización): ${broken.length} | structural: ${structural.length} | other_law: ${otherLaw.length} | inplace_needsfull: ${needsfull.length} | fallos guardarraíl: ${failed.length}`);
  fs.writeFileSync(path.join(dir, '_resumen.json'), JSON.stringify({ ceOk, inOk, broken, structural, otherLaw, needsfull, failed }, null, 1));
  if (broken.length) console.log('\nBROKEN:', JSON.stringify(broken, null, 1));
  if (failed.length) console.log('\nFALLOS:', JSON.stringify(failed));
  await sql.end();
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
