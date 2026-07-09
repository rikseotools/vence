// Apply de verificación de drafts de estudio IIPP. WAVE=N. DRY_RUN=1 simula.
// Lee /tmp/iwave{N}_deep_1..8.json (salida de agentes Sonnet) + ledger.
// Reglas:
//  - perfect (article_ok && answer_ok && options_ok, marked correcto) + new_explanation
//      -> INSERT ai_verification_results(all true) + UPDATE explanation + transition draft->approved.
//  - answer_wrong / ambiguous / outdated  -> needs_human (NUNCA flip).
//  - wrong_article / needs_other_law      -> needs_review (+ correct_article_suggestion logueada).
//  - bad_option                           -> needs_review (estudio: se corrige a mano luego).
// Ficheros degenerados (n<min o sin controlling_clause) se omiten -> vuelven al pool.
const fs = require('fs');
const B = '/home/manuel/Documentos/github/vence/node_modules/';
require(B + 'dotenv').config({ path: '/home/manuel/Documentos/github/vence/.env.local' });
const sql = require(B + 'postgres')(process.env.DATABASE_URL, { ssl: 'require', max: 4 });
const W = process.env.WAVE, DRY = process.env.DRY_RUN === '1';
if (!W) { console.error('falta WAVE'); process.exit(1); }
const VER = 'iipp-estudio-v1';

const ledger = JSON.parse(fs.readFileSync(`/tmp/iwave${W}_ledger.json`, 'utf8'));
const byId = Object.fromEntries(ledger.map(q => [q.id, q]));

(async () => {
  const deep = {}; const skipped = [];
  for (let n = 1; n <= 8; n++) {
    let d; try { d = JSON.parse(fs.readFileSync(`/tmp/iwave${W}_deep_${n}.json`, 'utf8')); } catch (_) { continue; }
    const ids = new Set(d.map(x => x.id));
    const withClause = d.filter(x => (x.controlling_clause || '').length > 10).length;
    if (ids.size < Math.min(18, d.length) || withClause < 0.7 * d.length) { skipped.push(`f${n}:n=${d.length}/clause=${withClause}`); continue; }
    for (const x of d) if (byId[x.id]) deep[x.id] = x;
  }
  if (skipped.length) console.log('FICHEROS OMITIDOS (vuelven al pool):', skipped.join(' | '));

  const APP = [], NR = [], NH = [];
  for (const id in deep) {
    const d = deep[id], q = byId[id];
    const rc = d.root_cause || d.verdict;
    // señal REAL = los 3 flags _ok (no el string root_cause, que algún agente rellena con texto libre)
    const okAll = d.article_ok === true && d.answer_ok === true && d.options_ok === true;
    if (okAll && (d.new_explanation || '').length > 40) {
      APP.push({ id, expl: d.new_explanation, clause: (d.controlling_clause || '').slice(0, 290), conf: d.confidence || 'alta' });
    } else if (rc === 'answer_wrong' || rc === 'outdated_by_reform' || rc === 'ambiguous_unresolvable') {
      NH.push({ id, reason: 'ai_detected_all_wrong', note: (rc + ': ' + (d.reason || '')).slice(0, 250) });
    } else if (rc === 'wrong_article' || rc === 'needs_other_law') {
      NH.push({ id, reason: 'ai_detected_wrong_article', note: (rc + '→' + (d.correct_article_suggestion || '') + ': ' + (d.reason || '')).slice(0, 250) });
    } else if (rc === 'bad_option') {
      NR.push({ id, reason: 'ai_detected_bad_answer', note: ('bad_option: ' + (d.reason || '')).slice(0, 250) });
    } else if (rc === 'bad_explanation') {
      NR.push({ id, reason: 'ai_detected_bad_explanation', note: ('bad_explanation: ' + (d.reason || '')).slice(0, 250) });
    } else {
      NH.push({ id, reason: 'admin_marked_problem', note: ('unknown(' + rc + '): ' + (d.reason || '')).slice(0, 250) });
    }
  }
  console.log(`Ola ${W}: deep válidos=${Object.keys(deep).length} | approved=${APP.length} needs_review=${NR.length} needs_human=${NH.length}`);
  if (DRY) { console.log('(dry-run)'); await sql.end(); return; }

  let ap = 0, nr = 0, nh = 0, errs = 0;
  for (const r of APP) {
    try {
      const [cur] = await sql`SELECT lifecycle_state, primary_article_id FROM questions WHERE id=${r.id}`;
      if (!['draft','needs_human','needs_review'].includes(cur.lifecycle_state)) continue;
      const [art] = await sql`SELECT a.law_id, l.is_virtual FROM articles a JOIN laws l ON l.id=a.law_id WHERE a.id=${cur.primary_article_id}`;
      const target = art.is_virtual ? 'tech_approved' : 'approved';
      const reason = art.is_virtual ? 'ai_verified_tech_perfect' : 'ai_verified_perfect';
      const [avr] = await sql`INSERT INTO ai_verification_results
        (question_id, article_id, law_id, ai_provider, ai_model, review_method_version, answer_ok, article_ok, options_ok, explanation_ok, explanation, confidence, verified_at)
        VALUES (${r.id}, ${cur.primary_article_id}, ${art.law_id}, 'claude_code', 'claude-sonnet-4-6', ${VER}, true, true, true, true, ${('ola'+W+': '+r.clause).slice(0,290)}, ${r.conf}, now())
        ON CONFLICT (question_id, ai_provider) DO UPDATE SET answer_ok=true, article_ok=true, options_ok=true, explanation_ok=true, explanation=excluded.explanation, review_method_version=${VER}, verified_at=now()
        RETURNING id`;
      await sql`UPDATE questions SET explanation=${r.expl} WHERE id=${r.id}`;
      await sql`SELECT public.transition_question_state(${r.id}::uuid, ${cur.lifecycle_state}::text, ${target}::text, ${reason}::text, NULL::uuid, ${avr.id}::uuid, ${('ola'+W+' estudio').slice(0,200)}::text)`;
      ap++;
    } catch (e) { errs++; if (errs <= 5) console.log('  app err', r.id.slice(0,8), e.message.slice(0,80)); }
  }
  for (const x of NR) {
    try { await sql`SELECT public.transition_question_state(${x.id}::uuid, 'draft'::text, 'needs_review'::text, ${x.reason}::text, NULL::uuid, NULL::uuid, ${('ola'+W+' '+x.note).slice(0,250)}::text)`; nr++; }
    catch (e) { errs++; if (errs <= 8) console.log('  nr err', x.id.slice(0,8), e.message.slice(0,80)); }
  }
  for (const x of NH) {
    try { await sql`SELECT public.transition_question_state(${x.id}::uuid, 'draft'::text, 'needs_human'::text, ${x.reason}::text, NULL::uuid, NULL::uuid, ${('ola'+W+' '+x.note).slice(0,250)}::text)`; nh++; }
    catch (e) { errs++; if (errs <= 8) console.log('  nh err', x.id.slice(0,8), e.message.slice(0,80)); }
  }
  console.log(`approved=${ap} needs_review=${nr} needs_human=${nh} errores=${errs}`);
  await sql.end();
})().catch(async e => { console.error('ERROR', e.message); try { await sql.end(); } catch (_) {} process.exit(1); });
