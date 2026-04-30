// T6 Galicia Ley 16/2010 — unify + clean + dedupe + map + import
require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const SRC = '/home/manuel/Documentos/github/vence/preguntas-para-subir/tutestdigital/';

const KEEP_PATTERNS = [
  /indica.*respuesta/i, /indica.*opci/i, /marca.*incorrecta/i, /marca.*correcta/i,
  /señala.*incorrecta/i, /señala.*correcta/i, /elige.*correcta/i, /elige.*incorrecta/i,
  /todas son/i, /ninguna es/i, /cuál es correcta/i, /cuál es incorrecta/i,
  /cuál no es/i, /cuál sí es/i, /es falsa/i, /es verdadera/i, /es incorrecta/i, /es correcta/i,
  /^#/, /fecha actual/i, /número total de/i,
];

function cleanQuestion(text) {
  if (!text) return text;
  const m = text.match(/^([\s\S]*?)\s*\(([^)]+)\)\s*$/);
  if (!m) return text.trim();
  if (KEEP_PATTERNS.some(p => p.test(m[2]))) return text.trim();
  return cleanQuestion(m[1].trim());
}

function parseQuestion(raw) {
  const m = raw.match(/^([\s\S]*?)\s*\(([^)]+)\)\s*$/);
  if (!m) return { question: raw.trim(), lawHint: null, articleHint: null };
  const inside = m[2];
  if (KEEP_PATTERNS.some(p => p.test(inside))) return { question: raw.trim(), lawHint: null, articleHint: null };
  const isLaw = /ley|decreto|real decreto|orgánica|\d+\/\d{4}/i.test(inside);
  const isArt = /art[íi]culos?\s+\d+|^art\.?\s+\d+/i.test(inside);
  return {
    question: cleanQuestion(raw),
    lawHint: isLaw ? inside : null,
    articleHint: isArt ? inside : null,
  };
}

function normalize(text) {
  return (text || '').toLowerCase()
    .replace(/[áàâä]/g,'a').replace(/[éèêë]/g,'e').replace(/[íìîï]/g,'i')
    .replace(/[óòôö]/g,'o').replace(/[úùûü]/g,'u').replace(/ñ/g,'n')
    .replace(/[^a-z0-9]/g,' ').replace(/\s+/g,' ').trim();
}

function shuffleKey(q, opts) {
  return normalize(q) + '###' + opts.map(o => normalize(o.text)).sort().join('|||');
}

function contentHash(q, oa, ob, oc, od) {
  const input = normalize(q) + '||' + normalize(oa) + '||' + normalize(ob) + '||' + normalize(oc) + '||' + normalize(od);
  return crypto.createHash('sha256').update(input).digest('hex');
}

function extractArticleFromText(text) {
  if (!text) return null;
  const patterns = [/art[íi]culos?\s+(\d+)/i, /^art\.?\s+(\d+)/i, /\bart\.\s*(\d+)/i];
  for (const p of patterns) { const m = text.match(p); if (m) return m[1]; }
  return null;
}

(async () => {
  // === STEP 1: Load and unify ===
  const f67dir = fs.readdirSync(SRC).find(d => d.startsWith('libro-67-'));
  const f72dir = fs.readdirSync(SRC).find(d => d.startsWith('libro-72-'));
  const f67 = fs.readdirSync(SRC + f67dir).find(x => x.startsWith('Tema_6.') && x.toLowerCase().includes('16_2010'));
  const f72 = fs.readdirSync(SRC + f72dir).find(x => x.startsWith('Tema_10.') && x.toLowerCase().includes('16_2010'));

  const d67 = JSON.parse(fs.readFileSync(SRC + f67dir + '/' + f67));
  const d72 = JSON.parse(fs.readFileSync(SRC + f72dir + '/' + f72));

  let all = [];
  for (const [lib, d] of [['67', d67], ['72', d72]]) {
    for (const q of d.questions) {
      // Filter: exclude explicit LPRL / Ley 31/1995 contamination
      const txt = ((q.question || '') + ' ' + (q.explanation || '')).toLowerCase();
      if (txt.includes('31/1995') || txt.includes('lprl') || txt.includes('prevención de riesgos')) continue;
      const parsed = parseQuestion(q.question);
      all.push({
        original: q.question,
        cleaned: parsed.question,
        lawHint: parsed.lawHint,
        articleHint: parsed.articleHint,
        options: q.options,
        correctAnswer: q.correctAnswer,
        explanation: q.explanation || null,
        source_book: 'libro-' + lib,
      });
    }
  }
  console.log('libro-67 T6: ' + d67.questions.length + ' → filtradas: ' + all.filter(q => q.source_book === 'libro-67').length);
  console.log('libro-72 T10: ' + d72.questions.length + ' → filtradas: ' + all.filter(q => q.source_book === 'libro-72').length);
  console.log('Total tras filtro LPRL:', all.length);

  // === STEP 2: Dedupe intra-batch ===
  const seen = new Map();
  const uniques = [];
  for (const q of all) {
    const key = shuffleKey(q.cleaned, q.options);
    if (!seen.has(key)) { seen.set(key, q); uniques.push(q); }
  }
  console.log('Tras dedup intra-batch:', uniques.length);

  // === STEP 3: Dedupe vs DB ===
  let dbQuestions = [];
  let from = 0;
  while (true) {
    const { data } = await supabase.from('questions')
      .select('id, question_text, option_a, option_b, option_c, option_d')
      .eq('is_active', true).range(from, from + 999);
    if (!data || data.length === 0) break;
    dbQuestions.push(...data);
    if (data.length < 1000) break;
    from += 1000;
  }
  console.log('Preguntas activas en BD:', dbQuestions.length);

  const dbByShuffle = new Set();
  const dbByNorm = new Set();
  for (const q of dbQuestions) {
    dbByShuffle.add(shuffleKey(q.question_text, [
      { text: q.option_a }, { text: q.option_b }, { text: q.option_c }, { text: q.option_d },
    ]));
    dbByNorm.add(normalize(q.question_text));
  }

  const newQs = uniques.filter(q => {
    if (dbByShuffle.has(shuffleKey(q.cleaned, q.options))) return false;
    if (dbByNorm.has(normalize(q.cleaned))) return false;
    return true;
  });
  console.log('Nuevas vs BD:', newQs.length);

  // === STEP 4: Map to articles of Ley 16/2010 ===
  const { data: law } = await supabase.from('laws').select('id').eq('short_name', 'Ley 16/2010').single();
  const { data: arts } = await supabase.from('articles').select('id, article_number').eq('law_id', law.id);
  const artMap = new Map(arts.map(a => [a.article_number, a.id]));

  const mapped = [];
  const unmapped = [];
  for (const q of newQs) {
    let art = null;
    if (q.articleHint) art = extractArticleFromText(q.articleHint);
    if (!art && q.explanation) art = extractArticleFromText(q.explanation);
    if (!art) art = extractArticleFromText(q.cleaned);

    if (!art || !artMap.has(art)) {
      unmapped.push({ ...q, _art: art });
      continue;
    }
    mapped.push({ ...q, primary_article_id: artMap.get(art), article_number: art });
  }
  console.log('Mapeadas:', mapped.length);
  console.log('Sin mapear:', unmapped.length);
  if (unmapped.length > 0) {
    console.log('\nSample unmapped:');
    unmapped.slice(0, 5).forEach((q, i) => console.log(`  [${i+1}] art=${q._art || '—'} | ${q.cleaned.slice(0, 100)}`));
  }

  // === STEP 5: Import ===
  const rows = mapped.map(q => {
    const opts = { A: null, B: null, C: null, D: null };
    for (const o of q.options) opts[o.letter] = o.text;
    const correctIdx = ['A','B','C','D'].indexOf(q.correctAnswer);
    return {
      question_text: q.cleaned,
      option_a: opts.A, option_b: opts.B, option_c: opts.C, option_d: opts.D,
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
    };
  }).filter(r => r.correct_option >= 0);

  console.log('\nRows listas para importar:', rows.length);
  let inserted = 0;
  const insertedIds = [];
  for (let i = 0; i < rows.length; i += 50) {
    const chunk = rows.slice(i, i + 50);
    const { data, error } = await supabase.from('questions').insert(chunk).select('id');
    if (error) {
      console.error('chunk error:', error.message);
      for (const row of chunk) {
        const { data: d2, error: e2 } = await supabase.from('questions').insert([row]).select('id');
        if (!e2) { inserted++; insertedIds.push(d2[0].id); }
      }
    } else {
      inserted += data.length;
      insertedIds.push(...data.map(r => r.id));
    }
  }
  console.log('Insertadas:', inserted, '/', rows.length);

  fs.writeFileSync('t6_galicia_imported_ids.json', JSON.stringify(insertedIds, null, 2));
  fs.writeFileSync('t6_galicia_unmapped.json', JSON.stringify(unmapped, null, 2));
  console.log('Escritos: t6_galicia_imported_ids.json, t6_galicia_unmapped.json');
})();
