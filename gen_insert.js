// Uso: node gen_insert.js <borrador.json> <batch_tag> <ids_out.json> <audit_out.json>
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '/home/manuel/Documentos/github/vence/.env.local' });
const fs = require('fs');
const c = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const [,, BORR, BATCH, IDS_OUT, AUDIT_OUT] = process.argv;

(async () => {
  const draft = JSON.parse(fs.readFileSync(BORR, 'utf8'));
  // dedup content_hash exacto: insertamos y la BD calcula hash; comprobamos colisión por question_text contra arts
  const artIds = [...new Set(draft.map(d => d.primary_article_id))];
  const { data: existing } = await c.from('questions').select('question_text').in('primary_article_id', artIds);
  const existingTexts = new Set((existing||[]).map(q => q.question_text.trim().toLowerCase()));
  const ids = [];
  let dupSkipped = 0;
  for (let i = 0; i < draft.length; i++) {
    const d = draft[i];
    if (existingTexts.has(d.question_text.trim().toLowerCase())) { console.log('DUP skip:', d.question_text.slice(0,60)); dupSkipped++; continue; }
    const row = {
      question_text: d.question_text,
      option_a: d.option_a, option_b: d.option_b, option_c: d.option_c, option_d: d.option_d,
      correct_option: d.correct_option, explanation: d.explanation,
      primary_article_id: d.primary_article_id,
      question_type: 'single', difficulty: 'medium', is_official_exam: false,
      lifecycle_state: 'draft', topic_review_status: 'pending',
      deactivation_reason: 'Pendiente de revisión post-generación IA',
      tags: ['ia_generada', BATCH],
    };
    const r = await c.from('questions').insert(row).select('id, lifecycle_state, is_active, content_hash').single();
    if (r.error) { console.error('INSERT q'+(i+1)+' ERROR:', r.error.message); process.exit(1); }
    ids.push(r.data.id);
    if (i === 0) console.log('inv 1ª:', r.data.lifecycle_state, '| is_active', r.data.is_active, '| hash', r.data.content_hash ? r.data.content_hash.length : 'NULL');
  }
  fs.writeFileSync(IDS_OUT, JSON.stringify(ids));
  // audit input desde BD
  const { data } = await c.from('questions').select('id, question_text, option_a, option_b, option_c, option_d, correct_option, explanation, articles!inner(article_number, title, content)').in('id', ids);
  const out = data.map(q => ({ id: q.id, question_text: q.question_text, options: { A: q.option_a, B: q.option_b, C: q.option_c, D: q.option_d }, correct_letter: ['A','B','C','D'][q.correct_option], explanation: q.explanation, article_number: q.articles.article_number, article_content: q.articles.content }));
  fs.writeFileSync(AUDIT_OUT, JSON.stringify(out, null, 2));
  console.log('Insertadas', ids.length, '| dup skip', dupSkipped, '| audit input ->', AUDIT_OUT);
})();
