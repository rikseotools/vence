// Step 4: import 46 questions as inactive (pending review)
require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function normalize(text) {
  return (text || '').toLowerCase()
    .replace(/[áàâä]/g,'a').replace(/[éèêë]/g,'e').replace(/[íìîï]/g,'i')
    .replace(/[óòôö]/g,'o').replace(/[úùûü]/g,'u').replace(/ñ/g,'n')
    .replace(/[^a-z0-9]/g,' ').replace(/\s+/g,' ').trim();
}

function contentHash(q, oa, ob, oc, od) {
  const input = normalize(q) + '||' + normalize(oa) + '||' + normalize(ob) + '||' + normalize(oc) + '||' + normalize(od);
  return crypto.createHash('sha256').update(input).digest('hex');
}

(async () => {
  const mapped = JSON.parse(fs.readFileSync('t2_galicia_step3_final_mapped.json', 'utf8'));
  console.log('Preparando', mapped.length, 'preguntas para importar...');

  const rows = [];
  for (const q of mapped) {
    const opts = { A: null, B: null, C: null, D: null };
    for (const o of q.options) opts[o.letter] = o.text;
    const correctIdx = ['A','B','C','D'].indexOf(q.correctAnswer);
    if (correctIdx < 0) { console.warn('Sin correctAnswer válido:', q.cleaned.slice(0, 60)); continue; }

    rows.push({
      question_text: q.cleaned,
      option_a: opts.A,
      option_b: opts.B,
      option_c: opts.C,
      option_d: opts.D,
      correct_option: correctIdx,
      explanation: q.explanation,
      primary_article_id: q.primary_article_id,
      is_active: false,
      deactivation_reason: 'Pendiente de revisión post-importación',
      topic_review_status: 'pending',
      question_type: 'single',
      difficulty: 'medium',
      content_hash: contentHash(q.cleaned, opts.A, opts.B, opts.C, opts.D),
      is_official_exam: false,
    });
  }

  console.log('Rows preparadas:', rows.length);

  // Insert in chunks
  let inserted = 0;
  const insertedIds = [];
  for (let i = 0; i < rows.length; i += 50) {
    const chunk = rows.slice(i, i + 50);
    const { data, error } = await supabase.from('questions').insert(chunk).select('id');
    if (error) {
      console.error('❌ chunk', i/50 + 1, error.message);
      // Try one by one
      for (const row of chunk) {
        const { data: d2, error: e2 } = await supabase.from('questions').insert([row]).select('id');
        if (e2) console.error('  fila fallida:', row.question_text.slice(0, 60), e2.message);
        else { inserted++; insertedIds.push(d2[0].id); }
      }
    } else {
      inserted += data.length;
      insertedIds.push(...data.map(r => r.id));
    }
  }
  console.log('\n✅ Insertadas:', inserted, '/', rows.length);

  fs.writeFileSync('t2_galicia_imported_ids.json', JSON.stringify(insertedIds, null, 2));
  console.log('IDs guardados en t2_galicia_imported_ids.json');
})();
