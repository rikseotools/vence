// Uso: node gen_transition.js <ids.json> <law_id> <batch_tag> <nota>
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '/home/manuel/Documentos/github/vence/.env.local' });
const fs = require('fs');
const c = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const [,, IDS, LAW, BATCH, NOTE] = process.argv;

(async () => {
  const ids = JSON.parse(fs.readFileSync(IDS, 'utf8'));
  const { data: qs } = await c.from('questions').select('id, primary_article_id, lifecycle_state').in('id', ids);
  let ok = 0, err = 0, skip = 0;
  for (const q of qs) {
    if (q.lifecycle_state !== 'draft') { skip++; continue; }
    await c.from('ai_verification_results').upsert({
      question_id: q.id, article_id: q.primary_article_id, law_id: LAW,
      article_ok: true, answer_ok: true, options_ok: true, explanation_ok: true, confidence: 'alta',
      explanation: 'IA-generada (Claude Opus 4.8). Auditoría doble PRE: auto-audit + Sonnet ciego. ' + (NOTE || ''),
      ai_provider: 'claude_code', ai_model: 'claude-opus-4-8', verified_at: new Date().toISOString(),
    }, { onConflict: 'question_id,ai_provider' });
    const t = await c.rpc('transition_question_state', {
      p_question_id: q.id, p_expected_state: 'draft', p_new_state: 'approved',
      p_reason_code: 'ai_verified_perfect', p_changed_by: null, p_ai_verification_id: null,
      p_notes: 'Batch ' + BATCH + ' — ' + (NOTE || 'auditoría doble'),
    });
    if (t.error) { console.error('TRANS', q.id, t.error.message); err++; continue; }
    await c.from('questions').update({ topic_review_status: 'perfect', verification_status: 'ok', verified_at: new Date().toISOString() }).eq('id', q.id);
    ok++;
  }
  const { data: chk } = await c.from('questions').select('lifecycle_state, is_active').in('id', ids);
  const appr = chk.filter(x => x.lifecycle_state === 'approved' && x.is_active).length;
  console.log('approved:', ok, '| skip(no draft):', skip, '| err:', err, '| verif approved+active:', appr + '/' + ids.length);
})();
