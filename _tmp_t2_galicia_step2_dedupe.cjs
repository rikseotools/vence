// Step 2: Detect duplicates (intra-batch + vs whole DB)
require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
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

function jaccard(a, b) {
  const wa = new Set(a.split(' ').filter(w => w.length > 2));
  const wb = new Set(b.split(' ').filter(w => w.length > 2));
  let intersection = 0;
  for (const w of wa) if (wb.has(w)) intersection++;
  const union = new Set([...wa, ...wb]).size;
  return union === 0 ? 0 : intersection / union;
}

function normalizeOptions(opts) {
  return opts.map(o => normalize(o.text)).sort().join('|||');
}

function shuffleKey(q, opts) {
  return normalize(q) + '###' + normalizeOptions(opts);
}

(async () => {
  const all = JSON.parse(fs.readFileSync('t2_galicia_step1_unified.json', 'utf8'));
  console.log('Total entradas:', all.length);

  // Step 2a: intra-batch dedup (nivel 0 — opciones barajadas)
  const seen = new Map();
  const uniques = [];
  const intraBatchDuplicates = [];
  for (const q of all) {
    const key = shuffleKey(q.cleaned, q.options);
    if (seen.has(key)) {
      intraBatchDuplicates.push({ kept: seen.get(key).cleaned, dropped: q.cleaned, book: q.source_book });
    } else {
      seen.set(key, q);
      uniques.push(q);
    }
  }
  console.log('\nTras dedup intra-batch (nivel 0 barajadas):', uniques.length);
  console.log('Duplicados intra-batch eliminados:', intraBatchDuplicates.length);

  // Step 2b: fetch all active questions from DB
  console.log('\nCargando preguntas activas de BD...');
  let dbQuestions = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase.from('questions')
      .select('id, question_text, option_a, option_b, option_c, option_d')
      .eq('is_active', true)
      .range(from, from + 999);
    if (error) { console.error(error); break; }
    if (!data || data.length === 0) break;
    dbQuestions.push(...data);
    if (data.length < 1000) break;
    from += 1000;
  }
  console.log('Preguntas activas en BD:', dbQuestions.length);

  // Index by normalized question text + shuffle key
  const dbByNorm = new Map();
  const dbByShuffle = new Map();
  for (const q of dbQuestions) {
    const norm = normalize(q.question_text);
    if (!dbByNorm.has(norm)) dbByNorm.set(norm, []);
    dbByNorm.get(norm).push(q);
    const key = shuffleKey(q.question_text, [
      { text: q.option_a }, { text: q.option_b }, { text: q.option_c }, { text: q.option_d },
    ]);
    if (!dbByShuffle.has(key)) dbByShuffle.set(key, []);
    dbByShuffle.get(key).push(q);
  }

  // Step 2c: check each unique against DB
  const results = { exact_shuffle: [], exact_norm: [], high_jaccard: [], new: [] };
  for (const q of uniques) {
    const key = shuffleKey(q.cleaned, q.options);
    if (dbByShuffle.has(key)) { results.exact_shuffle.push(q); continue; }
    const norm = normalize(q.cleaned);
    if (dbByNorm.has(norm)) { results.exact_norm.push(q); continue; }
    // Jaccard scan (only on questions with >=60% word overlap)
    let bestSim = 0, bestQ = null;
    for (const dbq of dbQuestions) {
      const sim = jaccard(norm, normalize(dbq.question_text));
      if (sim > bestSim) { bestSim = sim; bestQ = dbq; if (sim >= 0.95) break; }
    }
    if (bestSim >= 0.80) {
      q._jaccardSim = bestSim;
      q._jaccardMatch = bestQ?.question_text?.slice(0, 80);
      results.high_jaccard.push(q);
    } else {
      results.new.push(q);
    }
  }

  console.log('\n=== Resultado dedup contra BD ===');
  console.log('Exacto barajado:', results.exact_shuffle.length);
  console.log('Exacto normalizado:', results.exact_norm.length);
  console.log('Jaccard alta (>=80%):', results.high_jaccard.length);
  console.log('Nuevas (<80%):', results.new.length);

  fs.writeFileSync('t2_galicia_step2_dedupe.json', JSON.stringify(results, null, 2));
  fs.writeFileSync('t2_galicia_step2_new.json', JSON.stringify(results.new, null, 2));
  console.log('\nEscritos: t2_galicia_step2_dedupe.json, t2_galicia_step2_new.json');
})();
