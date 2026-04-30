require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const SRC = '/home/manuel/Documentos/github/vence/preguntas-para-subir/tutestdigital/';
const LAW_SHORT = 'Ley 2/2015 Galicia';

const KEEP_PATTERNS = [/indica.*respuesta/i,/indica.*opci/i,/marca.*incorrecta/i,/marca.*correcta/i,/señala.*incorrecta/i,/señala.*correcta/i,/elige.*correcta/i,/elige.*incorrecta/i,/todas son/i,/ninguna es/i,/cuál es correcta/i,/cuál es incorrecta/i,/cuál no es/i,/cuál sí es/i,/es falsa/i,/es verdadera/i,/es incorrecta/i,/es correcta/i,/^#/,/fecha actual/i,/número total de/i];

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
  return {
    question: cleanQuestion(raw),
    lawHint: /ley|decreto|real decreto|orgánica|\d+\/\d{4}/i.test(inside) ? inside : null,
    articleHint: /art[íi]culos?\s+\d+|^art\.?\s+\d+/i.test(inside) ? inside : null,
  };
}
function normalize(text) {
  return (text || '').toLowerCase().replace(/[áàâä]/g,'a').replace(/[éèêë]/g,'e').replace(/[íìîï]/g,'i').replace(/[óòôö]/g,'o').replace(/[úùûü]/g,'u').replace(/ñ/g,'n').replace(/[^a-z0-9]/g,' ').replace(/\s+/g,' ').trim();
}
function shuffleKey(q, opts) { return normalize(q) + '###' + opts.map(o => normalize(o.text)).sort().join('|||'); }
function contentHash(q, a, b, c, d) { return crypto.createHash('sha256').update(normalize(q)+'||'+normalize(a)+'||'+normalize(b)+'||'+normalize(c)+'||'+normalize(d)).digest('hex'); }
function extractArt(text) {
  if (!text) return null;
  const m = text.match(/art[íi]culos?\s+(\d+)/i) || text.match(/\bart\.\s*(\d+)/i);
  return m ? m[1] : null;
}

(async () => {
  const d67dir = SRC + fs.readdirSync(SRC).find(d => d.startsWith('libro-67-')) + '/';
  const d72dir = SRC + fs.readdirSync(SRC).find(d => d.startsWith('libro-72-')) + '/';
  const f67 = fs.readdirSync(d67dir).find(x => x.startsWith('Tema_11.'));
  const f72 = fs.readdirSync(d72dir).find(x => /2_2015|empleo_publico/i.test(x));
  const d67 = JSON.parse(fs.readFileSync(d67dir + f67));
  const d72 = JSON.parse(fs.readFileSync(d72dir + f72));
  console.log('libro-67:', d67.questions.length, '| libro-72:', d72.questions.length);

  let all = [];
  for (const [lib, d] of [['67', d67], ['72', d72]]) {
    for (const q of d.questions) {
      const parsed = parseQuestion(q.question);
      all.push({
        cleaned: parsed.question, lawHint: parsed.lawHint, articleHint: parsed.articleHint,
        options: q.options, correctAnswer: q.correctAnswer,
        explanation: q.explanation || 'Pendiente de redacción (se revisará con agente).',
        source_book: 'libro-' + lib,
      });
    }
  }
  console.log('Total:', all.length);

  const seen = new Map();
  const uniques = [];
  for (const q of all) {
    const key = shuffleKey(q.cleaned, q.options);
    if (!seen.has(key)) { seen.set(key, q); uniques.push(q); }
  }
  console.log('Únicas:', uniques.length);

  let dbQs = [];
  for (let from = 0;; from += 1000) {
    const { data } = await supabase.from('questions').select('id,question_text,option_a,option_b,option_c,option_d').eq('is_active', true).range(from, from + 999);
    if (!data || data.length === 0) break;
    dbQs.push(...data);
    if (data.length < 1000) break;
  }
  const dbShuffle = new Set(), dbNorm = new Set();
  for (const q of dbQs) {
    dbShuffle.add(shuffleKey(q.question_text, [{text:q.option_a},{text:q.option_b},{text:q.option_c},{text:q.option_d}]));
    dbNorm.add(normalize(q.question_text));
  }
  const newQs = uniques.filter(q => {
    if (dbShuffle.has(shuffleKey(q.cleaned, q.options))) return false;
    if (dbNorm.has(normalize(q.cleaned))) return false;
    return true;
  });
  console.log('Nuevas vs BD:', newQs.length);

  const { data: law } = await supabase.from('laws').select('id').eq('short_name', LAW_SHORT).single();
  const { data: arts } = await supabase.from('articles').select('id, article_number').eq('law_id', law.id);
  const artMap = new Map(arts.map(a => [a.article_number, a.id]));

  const mapped = [], unmapped = [];
  for (const q of newQs) {
    let art = null;
    if (q.articleHint) art = extractArt(q.articleHint);
    if (!art && q.explanation) art = extractArt(q.explanation);
    if (!art) art = extractArt(q.cleaned);
    if (!art || !artMap.has(art)) { unmapped.push({ ...q, _art: art }); continue; }
    mapped.push({ ...q, primary_article_id: artMap.get(art), article_number: art });
  }
  console.log('Mapeadas:', mapped.length, '| Sin mapear:', unmapped.length);

  const rows = mapped.map(q => {
    const opts = {A:null,B:null,C:null,D:null};
    for (const o of q.options) opts[o.letter] = o.text;
    return {
      question_text: q.cleaned,
      option_a: opts.A, option_b: opts.B, option_c: opts.C, option_d: opts.D,
      correct_option: ['A','B','C','D'].indexOf(q.correctAnswer),
      explanation: q.explanation,
      primary_article_id: q.primary_article_id,
      is_active: false,
      deactivation_reason: 'Pendiente de revisión post-importación',
      topic_review_status: 'pending',
      question_type: 'single', difficulty: 'medium',
      content_hash: contentHash(q.cleaned, opts.A, opts.B, opts.C, opts.D),
      is_official_exam: false,
    };
  }).filter(r => r.correct_option >= 0);

  let inserted = 0;
  const insertedIds = [];
  for (let i = 0; i < rows.length; i += 50) {
    const chunk = rows.slice(i, i + 50);
    const { data, error } = await supabase.from('questions').insert(chunk).select('id');
    if (error) {
      for (const row of chunk) {
        const { data: d2, error: e2 } = await supabase.from('questions').insert([row]).select('id');
        if (!e2) { inserted++; insertedIds.push(d2[0].id); }
      }
    } else { inserted += data.length; insertedIds.push(...data.map(r => r.id)); }
  }
  console.log('Importadas:', inserted, '/', rows.length);
  fs.writeFileSync('t11_galicia_imported_ids.json', JSON.stringify(insertedIds, null, 2));
  fs.writeFileSync('t11_galicia_unmapped.json', JSON.stringify(unmapped, null, 2));
})();
