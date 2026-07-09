// Aplica la adjudicación Opus (paso 4-6 del manual) sobre la pila aparcada.
// Lee /tmp/iadj_ledger.json + /tmp/iadj_deep_1..8.json. DRY_RUN=1 simula.
//  - reactivate: AVR(ok) + UPDATE explanation + transition cur->approved/tech_approved.
//  - relink: resuelve "Art N short_name" -> article_id; UPDATE primary_article_id;
//            añade (law,art) al topic_scope del tema si falta; AVR + explanation + approved.
//  - flip: UPDATE correct_option=real_letter; AVR + explanation + approved.
//  - keep_human: deja en needs_human (si está en needs_review, lo mueve).
const fs = require('fs');
const B = '/home/manuel/Documentos/github/vence/node_modules/';
require(B + 'dotenv').config({ path: '/home/manuel/Documentos/github/vence/.env.local' });
const sql = require(B + 'postgres')(process.env.DATABASE_URL, { ssl: 'require', max: 4 });
const DRY = process.env.DRY_RUN === '1';
const VER = 'iipp-estudio-adj-v1';
const L = ['A','B','C','D'];

const ledger = JSON.parse(fs.readFileSync('/tmp/iadj_ledger.json', 'utf8'));
const byId = Object.fromEntries(ledger.map(q => [q.id, q]));

async function resolveArticle(suggestion) {
  // "Art 13 RP" / "Art 302.2 Conducta humana" / "Art 257 TFUE"
  const m = (suggestion || '').match(/Art[íi.]*\s*([\d]+(?:\.[\d]+)*(?:\s*bis|\s*ter)?)\s+(.+)/i);
  if (!m) return null;
  const num = m[1].replace(/\s+/g, ' ').trim();
  const lawName = m[2].trim();
  const laws = await sql`SELECT id, short_name FROM laws WHERE short_name ILIKE ${'%' + lawName + '%'} ORDER BY length(short_name) LIMIT 3`;
  for (const law of laws) {
    const arts = await sql`SELECT id, law_id, article_number FROM articles WHERE law_id=${law.id} AND article_number=${num}`;
    if (arts.length) return { articleId: arts[0].id, lawId: law.id, num };
  }
  return null;
}

(async () => {
  const deep = {};
  for (let n = 1; n <= 8; n++) {
    let d; try { d = JSON.parse(fs.readFileSync(`/tmp/iadj_deep_${n}.json`, 'utf8')); } catch (_) { continue; }
    for (const x of d) if (byId[x.id]) deep[x.id] = x;
  }
  const stats = { reactivate: 0, relink: 0, flip: 0, keep_human: 0, relink_fail: 0, err: 0 };
  const counts = {}; for (const id in deep) counts[deep[id].verdict] = (counts[deep[id].verdict] || 0) + 1;
  console.log('Veredictos:', JSON.stringify(counts), '| total adjudicadas:', Object.keys(deep).length);
  if (DRY) { console.log('(dry-run)'); await sql.end(); return; }

  for (const id in deep) {
    const d = deep[id];
    try {
      const [cur] = await sql`SELECT lifecycle_state, primary_article_id, correct_option, (SELECT t FROM unnest(tags) t WHERE t LIKE 'T%') tema FROM questions q WHERE id=${id}`;
      if (d.verdict === 'keep_human') { if (cur.lifecycle_state === 'needs_review') await sql`SELECT public.transition_question_state(${id}::uuid,'needs_review','needs_human','admin_marked_problem',NULL,NULL,'adj: irresoluble')`; stats.keep_human++; continue; }
      let artId = cur.primary_article_id, lawId = null;
      // relink: cambiar artículo + scope
      if (d.verdict === 'relink') {
        const r = await resolveArticle(d.correct_article_suggestion);
        if (!r) { stats.relink_fail++; console.log('  relink NO resuelto', id.slice(0,8), '|', d.correct_article_suggestion); continue; }
        await sql`UPDATE questions SET primary_article_id=${r.articleId} WHERE id=${id}`;
        artId = r.articleId; lawId = r.lawId;
        // topic_scope: añadir el art al tema si falta
        const [top] = await sql`SELECT id FROM topics WHERE position_type='ayudante_instituciones_penitenciarias' AND topic_number=${+cur.tema.slice(1)}`;
        const ex = await sql`SELECT id, article_numbers FROM topic_scope WHERE topic_id=${top.id} AND law_id=${r.lawId}`;
        if (ex.length) { if (!(ex[0].article_numbers || []).includes(r.num)) await sql`UPDATE topic_scope SET article_numbers=${[...(ex[0].article_numbers||[]), r.num]} WHERE id=${ex[0].id}`; }
        else await sql`INSERT INTO topic_scope (topic_id, law_id, article_numbers, weight) VALUES (${top.id}, ${r.lawId}, ${[r.num]}, 1.0)`;
        stats.relink++;
      }
      // flip: cambiar clave
      if (d.verdict === 'flip') {
        const ci = L.indexOf((d.real_correct_letter || '').toUpperCase());
        if (ci < 0) { stats.err++; continue; }
        await sql`UPDATE questions SET correct_option=${ci} WHERE id=${id}`;
        stats.flip++;
      }
      if (d.verdict === 'reactivate') stats.reactivate++;
      const [art] = await sql`SELECT a.law_id, l.is_virtual FROM articles a JOIN laws l ON l.id=a.law_id WHERE a.id=${artId}`;
      const target = art.is_virtual ? 'tech_approved' : 'approved';
      const reason = art.is_virtual ? 'ai_verified_tech_perfect' : 'ai_verified_perfect';
      const [avr] = await sql`INSERT INTO ai_verification_results (question_id, article_id, law_id, ai_provider, ai_model, review_method_version, answer_ok, article_ok, options_ok, explanation_ok, explanation, confidence, verified_at)
        VALUES (${id}, ${artId}, ${art.law_id}, 'claude_code_adjudicate', 'claude-opus-4', ${VER}, true, true, true, true, ${('adj '+d.verdict+': '+(d.controlling_clause||'')).slice(0,290)}, ${d.confidence||'alta'}, now())
        ON CONFLICT (question_id, ai_provider) DO UPDATE SET answer_ok=true, article_ok=true, options_ok=true, explanation_ok=true, explanation=excluded.explanation, verified_at=now() RETURNING id`;
      if (d.new_explanation && d.new_explanation.length > 40) await sql`UPDATE questions SET explanation=${d.new_explanation} WHERE id=${id}`;
      await sql`SELECT public.transition_question_state(${id}::uuid, ${cur.lifecycle_state}::text, ${target}::text, ${reason}::text, NULL::uuid, ${avr.id}::uuid, ${('adj-opus '+d.verdict).slice(0,200)}::text)`;
    } catch (e) { stats.err++; if (stats.err <= 8) console.log('  err', id.slice(0,8), e.message.slice(0,90)); }
  }
  console.log('APLICADO:', JSON.stringify(stats));
  await sql.end();
})().catch(async e => { console.error('FATAL', e.message); try { await sql.end(); } catch (_) {} process.exit(1); });
