require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const LEY_7_2014 = '1893180f-a842-4990-9661-d23d63958ff4';
const LEY_4_2019 = '3a3bb3d5-cf43-43b8-9137-ffd805dfcbd2';

function normalize(text) {
  return (text || '').toLowerCase().replace(/[áàâä]/g,'a').replace(/[éèêë]/g,'e').replace(/[íìîï]/g,'i').replace(/[óòôö]/g,'o').replace(/[úùûü]/g,'u').replace(/ñ/g,'n').replace(/[^a-z0-9]/g,' ').replace(/\s+/g,' ').trim();
}
function contentHash(q, a, b, c, d) { return crypto.createHash('sha256').update(normalize(q)+'||'+normalize(a)+'||'+normalize(b)+'||'+normalize(c)+'||'+normalize(d)).digest('hex'); }

(async () => {
  const unmapped = JSON.parse(fs.readFileSync('t14_galicia_unmapped.json'));
  const manual = JSON.parse(fs.readFileSync('t14_galicia_manual_mapping.json'));

  // Load article IDs for both laws
  const { data: ley7Arts } = await supabase.from('articles').select('id, article_number').eq('law_id', LEY_7_2014);
  const { data: ley4Arts } = await supabase.from('articles').select('id, article_number').eq('law_id', LEY_4_2019);
  const ley7Map = new Map(ley7Arts.map(a => [a.article_number, a.id]));
  const ley4Map = new Map(ley4Arts.map(a => [a.article_number, a.id]));
  const lawMap = { LEY_7_2014: ley7Map, LEY_4_2019: ley4Map };

  // Build idx → mapping
  const idxToMapping = new Map();
  for (const m of manual) idxToMapping.set(m.idx, m);

  const rows = [];
  const skipped = [];
  for (const q of unmapped) {
    const m = idxToMapping.get(q.idx);
    if (!m || m.unresolvable) { skipped.push({ ...q, reason: m?.reason || 'no mapping' }); continue; }
    const artMap = lawMap[m.law];
    const articleId = artMap?.get(m.article_number);
    if (!articleId) { skipped.push({ ...q, reason: 'article not found: ' + m.law + ' art ' + m.article_number }); continue; }

    const opts = { A: null, B: null, C: null, D: null };
    for (const o of q.options) opts[o.letter] = o.text;
    const correctOption = ['A','B','C','D'].indexOf(q.correctAnswer);
    if (correctOption < 0) { skipped.push({ ...q, reason: 'invalid correct answer: ' + q.correctAnswer }); continue; }

    rows.push({
      question_text: q.cleaned,
      option_a: opts.A, option_b: opts.B, option_c: opts.C, option_d: opts.D,
      correct_option: correctOption,
      explanation: q.explanation || 'Pendiente de redacción (se revisará con agente).',
      primary_article_id: articleId,
      is_active: false,
      deactivation_reason: 'Pendiente de revisión post-importación',
      topic_review_status: 'pending',
      question_type: 'single',
      difficulty: 'medium',
      content_hash: contentHash(q.cleaned, opts.A, opts.B, opts.C, opts.D),
      is_official_exam: false,
      tags: ['Tema 14', 'Gestión Documental', 'Xunta Galicia'],
    });
  }

  console.log('Para insertar:', rows.length, '| Skipped:', skipped.length);
  if (skipped.length) for (const s of skipped) console.log('  SKIP idx=' + s.idx, '|', s.reason);

  // Insert
  const existingIds = JSON.parse(fs.readFileSync('t14_galicia_imported_ids.json'));
  let inserted = 0;
  const newIds = [];
  for (let i = 0; i < rows.length; i += 50) {
    const chunk = rows.slice(i, i + 50);
    const { data, error } = await supabase.from('questions').insert(chunk).select('id');
    if (error) {
      console.error('chunk error, retrying one by one:', error.message);
      for (const row of chunk) {
        const { data: d2, error: e2 } = await supabase.from('questions').insert([row]).select('id');
        if (e2) console.error('  ❌', e2.message.slice(0, 100));
        else { inserted++; newIds.push(d2[0].id); }
      }
    } else { inserted += data.length; newIds.push(...data.map(r => r.id)); }
  }
  console.log('\n✅ Insertadas adicionales:', inserted, '/', rows.length);

  const allIds = [...existingIds, ...newIds];
  fs.writeFileSync('t14_galicia_imported_ids.json', JSON.stringify(allIds, null, 2));
  console.log('Total T14 importadas:', allIds.length);
})();
