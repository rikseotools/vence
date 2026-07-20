#!/usr/bin/env node
/**
 * apply-ce-relink-dir.cjs — aplica en lote todos los pares cand_NN.json / out_NN.json
 * que existan en un directorio (drenaje CE-relink por chunks paralelos).
 *
 * Uso:  node scripts/impugnaciones/apply-ce-relink-dir.cjs <dir>
 * Reutiliza la MISMA lógica de guardarraíl que apply-ce-relink.cjs (blockquote literal,
 * formato §5.1, clave coherente). Idempotente: re-ejecutable; solo procesa chunks cuyo
 * out_NN.json ya existe. Registra por chunk cuántas aprueba / falla / aparca.
 */
require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const path = require('path');
const sql = require('postgres')(process.env.DATABASE_URL, { ssl: { rejectUnauthorized: false }, max: 1 });
const PROVIDER = 'claude_code_ce_relink_2026_07';
const norm = s => (s || '').toLowerCase().replace(/\s+/g, ' ').trim();

async function applyChunk(cand, out, ceLaw) {
  const byId = Object.fromEntries(cand.map(c => [c.id, c]));
  let approved = 0, parked = 0; const failed = [];
  for (const r of out) {
    const c = byId[r.id];
    if (!c) { failed.push({ id: r.id, why: 'no_cand' }); continue; }
    const conf = r.confidence || 'media';
    if (!r.ce_answers) {
      parked++;
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
  return { approved, parked, failed };
}

(async () => {
  const dir = process.argv[2];
  if (!dir) { console.error('uso: apply-ce-relink-dir.cjs <dir>'); process.exit(1); }
  const ceLaw = (await sql`SELECT id FROM laws WHERE short_name='CE'`)[0].id;
  const outs = fs.readdirSync(dir).filter(f => /^out_\d+\.json$/.test(f)).sort();
  let tA = 0, tP = 0, tF = 0;
  for (const of of outs) {
    const nn = of.match(/out_(\d+)\.json/)[1];
    const candPath = path.join(dir, `cand_${nn}.json`);
    if (!fs.existsSync(candPath)) { console.log(`chunk ${nn}: sin cand → skip`); continue; }
    let cand, out;
    try { cand = JSON.parse(fs.readFileSync(candPath, 'utf8')); out = JSON.parse(fs.readFileSync(path.join(dir, of), 'utf8')); }
    catch (e) { console.log(`chunk ${nn}: JSON inválido (${e.message}) → skip`); continue; }
    const r = await applyChunk(cand, out, ceLaw);
    tA += r.approved; tP += r.parked; tF += r.failed.length;
    console.log(`chunk ${nn}: aprobadas ${r.approved} | parked ${r.parked} | fallos ${r.failed.length}${r.failed.length ? ' ' + JSON.stringify(r.failed) : ''}`);
  }
  console.log(`\nTOTAL: aprobadas ${tA} | parked ${tP} | fallos ${tF}`);
  await sql.end();
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
