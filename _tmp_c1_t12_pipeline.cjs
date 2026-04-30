require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const LEY_9_2007_GALICIA = 'c5bdb593-cf8c-4f24-936d-7e2381ba5b22';
const SRC = '/home/manuel/Documentos/github/vence/preguntas-para-subir/tutestdigital/libro-72-test-interactivo-74-administrativo-c1-xunta-de-galicia-ed-20/Tema_12.-_Tema5.-_Ley_9_2007,_de_13_de_junio,_de_subvenciones_de_Galicia__títulos_preliminar_y_I..json';

function normalize(text) {
  return (text || '').toLowerCase().replace(/[áàâä]/g,'a').replace(/[éèêë]/g,'e').replace(/[íìîï]/g,'i').replace(/[óòôö]/g,'o').replace(/[úùûü]/g,'u').replace(/ñ/g,'n').replace(/[^a-z0-9]/g,' ').replace(/\s+/g,' ').trim();
}
function shuffleKey(q, opts) { return normalize(q) + '###' + opts.map(o => normalize(o.text || '')).sort().join('|||'); }
function contentHash(q, a, b, c, d) { return crypto.createHash('sha256').update(normalize(q)+'||'+normalize(a)+'||'+normalize(b)+'||'+normalize(c)+'||'+normalize(d)).digest('hex'); }

function extractArt(text) {
  if (!text) return null;
  const m = text.match(/[aA]rt[íi]culos?\s+(\d+)/);
  return m ? m[1] : null;
}

(async () => {
  // === 1) Leer fuente ===
  const src = JSON.parse(fs.readFileSync(SRC));
  console.log('Fuente:', src.questions.length, 'preguntas');

  // === 2) Dedup intra-batch ===
  const seen = new Map();
  const uniques = [];
  for (const q of src.questions) {
    if (!q.options || !q.correctAnswer) continue;
    const key = shuffleKey(q.question, q.options);
    if (!seen.has(key)) { seen.set(key, q); uniques.push(q); }
  }
  console.log('Únicas:', uniques.length);

  // === 3) Dedup vs BD ===
  let dbQs = [];
  for (let from = 0;; from += 1000) {
    const { data } = await s.from('questions').select('question_text,option_a,option_b,option_c,option_d').eq('is_active', true).range(from, from + 999);
    if (!data || data.length === 0) break;
    dbQs.push(...data);
    if (data.length < 1000) break;
  }
  const dbShuffle = new Set();
  const dbNorm = new Set();
  for (const q of dbQs) {
    dbShuffle.add(shuffleKey(q.question_text, [{text:q.option_a},{text:q.option_b},{text:q.option_c},{text:q.option_d}]));
    dbNorm.add(normalize(q.question_text));
  }
  const nuevas = uniques.filter(q => {
    const k = shuffleKey(q.question, q.options);
    const n = normalize(q.question);
    return !dbShuffle.has(k) && !dbNorm.has(n);
  });
  console.log('Nuevas vs BD:', nuevas.length);

  // === 4) Mapeo a artículo ===
  const { data: arts } = await s.from('articles').select('id, article_number').eq('law_id', LEY_9_2007_GALICIA);
  const artMap = new Map(arts.map(a => [a.article_number, a.id]));
  console.log('Artículos Ley 9/2007:', arts.length);

  const rows = [];
  const unmapped = [];
  for (const q of nuevas) {
    const text = (q.question || '') + ' ' + (q.explanation || '');
    const artNum = extractArt(text);
    let articleId = artNum ? artMap.get(artNum) : null;
    // Fallback: art 1 (Objeto) si no se puede mapear
    if (!articleId) articleId = artMap.get('1');

    const opts = { A: null, B: null, C: null, D: null };
    for (const o of q.options) opts[o.letter] = o.text;
    const correctOption = ['A','B','C','D'].indexOf(q.correctAnswer);
    if (correctOption < 0) { unmapped.push({ q: q.question, reason: 'correct invalido' }); continue; }

    rows.push({
      question_text: q.question,
      option_a: opts.A, option_b: opts.B, option_c: opts.C, option_d: opts.D,
      correct_option: correctOption,
      explanation: q.explanation || 'Pendiente de redacción (se revisará con agente).',
      primary_article_id: articleId,
      is_active: false,
      deactivation_reason: 'Pendiente de revisión post-importación',
      topic_review_status: 'pending',
      question_type: 'single',
      difficulty: 'medium',
      content_hash: contentHash(q.question, opts.A, opts.B, opts.C, opts.D),
      is_official_exam: false,
      tags: ['Tema 12', 'Subvenciones Galicia', 'Ley 9/2007', 'Administrativo C1 Galicia'],
    });
  }

  console.log('\\nA insertar:', rows.length, '| Skipped:', unmapped.length);

  // === 5) Insertar ===
  const insertedIds = [];
  let inserted = 0;
  for (let i = 0; i < rows.length; i += 50) {
    const chunk = rows.slice(i, i + 50);
    const { data, error } = await s.from('questions').insert(chunk).select('id');
    if (error) {
      console.error('chunk error:', error.message);
      for (const row of chunk) {
        const { data: d2, error: e2 } = await s.from('questions').insert([row]).select('id');
        if (e2) console.error('  ❌', e2.message.slice(0, 100));
        else { inserted++; insertedIds.push(d2[0].id); }
      }
    } else { inserted += data.length; insertedIds.push(...data.map(r => r.id)); }
  }
  console.log('✅ Importadas:', inserted, '/', rows.length);
  fs.writeFileSync('c1_t12_imported_ids.json', JSON.stringify(insertedIds, null, 2));
})();
