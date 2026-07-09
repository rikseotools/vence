// Aplicador Cubo C (sin explicación). Lee wave{W}_ledger.json + wave{W}_deep_{1..8}.json.
// key_ok=true + new_explanation válida (tiene blockquote '>' y 'Por qué <clave> es correcta')
//   -> UPDATE explanation + AVR claude_code_recheck (explanation_ok/answer_ok/article_ok=true, new_explanation).
//      NO transiciona (ya es approved/tech_approved). Solo mejora la explicación.
// key_ok=false -> NO se toca aquí (se listan para adjudicación Opus manual antes de needs_human).
// DRY_RUN=1 para simular.
const fs = require('fs');
const base = '/home/manuel/Documentos/github/vence/';
require(base + 'node_modules/dotenv').config({ path: base + '.env.local' });
const postgres = require(base + 'node_modules/postgres');
const sql = postgres(process.env.DATABASE_URL, { ssl: 'require', max: 4 });
const W = process.env.WAVE;
const DRY = process.env.DRY_RUN === '1';
if (!W) { console.error('falta WAVE'); process.exit(1); }

(async () => {
  const led = {};
  for (const q of JSON.parse(fs.readFileSync(`/tmp/wave${W}_ledger.json`)))
    led[q.id] = { m: ['A','B','C','D','E'][q.correct_option], state: q.lifecycle_state };
  let all = [];
  for (let i = 1; i <= 8; i++) { try { all = all.concat(JSON.parse(fs.readFileSync(`/tmp/wave${W}_deep_${i}.json`))); } catch (_) {} }

  const write = [], hold = [];
  for (const r of all) {
    const l = led[r.id]; if (!l) continue; // UUID corrupto -> ignorar
    const e = (r.new_explanation || '').trim();
    const okFmt = r.key_ok === true && e.length >= 60 && e.includes('>') && new RegExp(`Por qué ${l.m}.{0,40} es correcta`, 'i').test(e);
    if (okFmt) write.push({ id: r.id, expl: e });
    else hold.push({ id: r.id, key_ok: r.key_ok, real: r.real_correct_letter, reason: r.reason, marked: l.m, badfmt: r.key_ok === true });
  }
  console.log(`Ola ${W}: deep=${all.length} | escribir_expl=${write.length} | hold(key_ok=false o formato malo)=${hold.length}`);
  if (hold.length) console.log('HOLD:', JSON.stringify(hold.slice(0, 40), null, 1));
  if (DRY) { console.log('(dry-run)'); await sql.end(); return; }

  let done = 0;
  for (const w of write) {
    await sql`UPDATE questions SET explanation=${w.expl} WHERE id=${w.id}`;
    await sql`INSERT INTO ai_verification_results
        (question_id, ai_provider, ai_model, is_correct, answer_ok, article_ok, options_ok, explanation_ok, new_explanation, fix_applied, review_method_version, discarded)
      VALUES (${w.id},'claude_code_recheck','opus-4.8',true,true,true,true,true,${w.expl},true,'v2.1-expl',false)
      ON CONFLICT (question_id, ai_provider) DO UPDATE SET explanation_ok=true, new_explanation=EXCLUDED.new_explanation, fix_applied=true, discarded=false`;
    done++;
  }
  console.log(`explicaciones escritas=${done}`);
  try { const rv = await fetch('https://www.vence.es/api/admin/revalidate', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-cron-secret': process.env.CRON_SECRET }, body: JSON.stringify({ tag: 'questions' }) }); console.log('revalidate:', rv.status); } catch (e) { console.log('revalidate fallo:', e.message); }
  await sql.end();
})().catch(async e => { console.error('ERROR', e.message); try { await sql.end(); } catch (_) {} process.exit(1); });
