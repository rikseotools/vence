require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

function normalize(text) {
  return (text || '').toLowerCase().replace(/[áàâä]/g,'a').replace(/[éèêë]/g,'e').replace(/[íìîï]/g,'i').replace(/[óòôö]/g,'o').replace(/[úùûü]/g,'u').replace(/ñ/g,'n').replace(/[^a-z0-9]/g,' ').replace(/\s+/g,' ').trim();
}
function contentHash(q, a, b, c, d) {
  return crypto.createHash('sha256').update(normalize(q) + '||' + normalize(a) + '||' + normalize(b) + '||' + normalize(c) + '||' + normalize(d)).digest('hex');
}

(async () => {
  const questions = JSON.parse(fs.readFileSync('t17_galicia_new_questions.json'));
  const mapping = JSON.parse(fs.readFileSync('t17_galicia_mapping.json'));

  // Build law+art → article_id map
  const laws = ['LibreOffice Writer','LibreOffice Calc','LibreOffice Impress','Correo electrónico','Intranet'];
  const artMaps = {};
  for (const ln of laws) {
    const { data: l } = await s.from('laws').select('id').eq('short_name', ln).single();
    const { data: arts } = await s.from('articles').select('id, article_number').eq('law_id', l.id);
    artMaps[ln] = new Map(arts.map(a => [a.article_number, a.id]));
  }

  const rows = [];
  const skipped = [];
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    const m = mapping[i];
    if (!m || m.unresolvable) { skipped.push({ i, reason: m?.reason || 'no mapping' }); continue; }

    const artMap = artMaps[m.law];
    const artId = artMap?.get(m.article_number);
    if (!artId) { skipped.push({ i, reason: 'article not found: ' + m.law + ' art ' + m.article_number }); continue; }

    const opts = { A: null, B: null, C: null, D: null };
    for (const o of q.options) opts[o.letter] = o.text;
    const correctOption = ['A','B','C','D'].indexOf(q.correctAnswer);
    if (correctOption < 0) { skipped.push({ i, reason: 'invalid correct: ' + q.correctAnswer }); continue; }

    const tags = ['Tema 17', 'LibreOffice', 'Xunta Galicia'];
    if (m.outdated) tags.push('possibly-outdated');

    rows.push({
      question_text: q.question,
      option_a: opts.A, option_b: opts.B, option_c: opts.C, option_d: opts.D,
      correct_option: correctOption,
      explanation: q.explanation || 'Pendiente de redacción (se revisará con agente).',
      primary_article_id: artId,
      is_active: false,
      deactivation_reason: 'Pendiente de revisión post-importación',
      topic_review_status: 'pending',
      question_type: 'single',
      difficulty: 'medium',
      content_hash: contentHash(q.question, opts.A, opts.B, opts.C, opts.D),
      is_official_exam: false,
      tags,
    });
  }

  console.log('Para insertar:', rows.length, '| Skipped:', skipped.length);
  if (skipped.length) for (const s of skipped) console.log('  SKIP idx=' + s.i + ':', s.reason);

  let inserted = 0;
  const insertedIds = [];
  for (let i = 0; i < rows.length; i += 50) {
    const chunk = rows.slice(i, i + 50);
    const { data, error } = await s.from('questions').insert(chunk).select('id');
    if (error) {
      console.error('chunk error, retrying:', error.message);
      for (const row of chunk) {
        const { data: d2, error: e2 } = await s.from('questions').insert([row]).select('id');
        if (e2) console.error('  ❌', e2.message.slice(0, 100));
        else { inserted++; insertedIds.push(d2[0].id); }
      }
    } else { inserted += data.length; insertedIds.push(...data.map(r => r.id)); }
  }
  console.log('\n✅ Insertadas:', inserted, '/', rows.length);
  fs.writeFileSync('t17_galicia_imported_ids.json', JSON.stringify(insertedIds, null, 2));
  console.log('IDs → t17_galicia_imported_ids.json');
})();
