require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const RDL_2_2015 = 'd0dc66a4-a089-4aa0-9d98-1793734f5a18';
const SRC = '/home/manuel/Documentos/github/vence/preguntas-para-subir/tutestdigital/libro-72-test-interactivo-74-administrativo-c1-xunta-de-galicia-ed-20/Tema_18.-_Tema_11.-_Real_Decreto_Legislativo_2_2015,_de_23_de_octubre,_por_el_que_se_aprueba_el_text.json';
const LAW_CONTEXT = 'el Real Decreto Legislativo 2/2015, del Estatuto de los Trabajadores';

// === Cleanup functions (pipeline oficial según manual) ===

// Paso 1: basura sin paréntesis al final
const INLINE_JUNK_PATTERNS = [
  /\s+TEST\s+(?:LEY|REAL DECRETO|LEY ORG[AÁ]NICA|ESTATUTO|DECRETO|RDL)\b[^\n]*$/i,
  /\s+TEST\s+\d+\s+[^\n]*$/i,
  /\s+TEMARIO\s+(?:OFICIAL|ADMINISTRATIVO|AUXILIAR)[^\n]*$/i,
  /\s+\(D\.V\.\)\s*$/i,
];
function stripInlineJunk(text) {
  let t = text;
  for (const p of INLINE_JUNK_PATTERNS) t = t.replace(p, '');
  return t.trim();
}

// Paso 2: coletillas entre paréntesis
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
  if (!m) return { question: raw.trim(), articleHint: null };
  const inside = m[2];
  if (KEEP_PATTERNS.some(p => p.test(inside))) return { question: raw.trim(), articleHint: null };
  const isArt = /art[íi]culos?\s+\d+|^art\.?\s+\d+/i.test(inside);
  return { question: cleanQuestion(raw), articleHint: isArt ? inside : null };
}

// Paso 3: contextualizar ley si falta
function mentionsLaw(text) {
  const patterns = [
    /real decreto(?:\s+legislativo)?/i,
    /\brd(?:l|leg)?\s*\d+\/\d{4}/i,
    /estatuto.*trabajadores|\btrlet\b/i,
    /ley.*estatuto.*trabajad/i,
    /\bley\s+\d+\/\d{4}/i,
  ];
  return patterns.some(r => r.test(text));
}
function ensureLawContext(text, lawFullName) {
  if (mentionsLaw(text)) return text;
  const patterns = [
    /((?:Seg[uú]n|De acuerdo con|Conforme a|A tenor de|A efectos de|En)(?:\s+lo dispuesto en)?(?:\s+el)?\s+[Aa]rt[íi]culos?\s+\d+(?:\.\d+)?(?:\s+(?:bis|ter))?)/,
    /^([Aa]rt[íi]culo\s+\d+(?:\.\d+)?)/,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m) {
      const idx = m.index + m[0].length;
      const after = text.slice(idx, idx + 25);
      if (/^\s+(del|de la ley|de la constituci|de lo)/i.test(after)) continue;
      return text.slice(0, idx) + ' de ' + lawFullName + text.slice(idx);
    }
  }
  return `${lawFullName}. ${text}`;
}

// === Utils ===
function normalize(text) {
  return (text || '').toLowerCase().replace(/[áàâä]/g,'a').replace(/[éèêë]/g,'e').replace(/[íìîï]/g,'i').replace(/[óòôö]/g,'o').replace(/[úùûü]/g,'u').replace(/ñ/g,'n').replace(/[^a-z0-9]/g,' ').replace(/\s+/g,' ').trim();
}
function shuffleKey(q, opts) { return normalize(q) + '###' + opts.map(o => normalize(o.text || '')).sort().join('|||'); }
function contentHash(q, a, b, c, d) { return crypto.createHash('sha256').update(normalize(q)+'||'+normalize(a)+'||'+normalize(b)+'||'+normalize(c)+'||'+normalize(d)).digest('hex'); }
function extractArt(text) { const m = (text || '').match(/[aA]rt[íi]culos?\s+(\d+)/); return m ? m[1] : null; }

(async () => {
  const src = JSON.parse(fs.readFileSync(SRC));
  console.log('Fuente:', src.questions.length, 'preguntas');

  // === 1) Limpieza de cada pregunta ===
  const cleaned = src.questions.map((q, idx) => {
    if (!q.options || !q.correctAnswer) return null;
    let text = stripInlineJunk(q.question || '');
    const parsed = parseQuestion(text);
    text = parsed.question;
    text = ensureLawContext(text, LAW_CONTEXT);
    return { idx, text, options: q.options, correctAnswer: q.correctAnswer, explanation: q.explanation || 'Pendiente de redacción (se revisará con agente).', articleHint: parsed.articleHint };
  }).filter(Boolean);
  console.log('Limpiadas:', cleaned.length);

  // === 2) Dedup intra-batch ===
  const seen = new Map();
  const uniques = [];
  for (const q of cleaned) {
    const key = shuffleKey(q.text, q.options);
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
    const k = shuffleKey(q.text, q.options);
    const n = normalize(q.text);
    return !dbShuffle.has(k) && !dbNorm.has(n);
  });
  console.log('Nuevas vs BD:', nuevas.length);

  // === 4) Mapeo a artículo ===
  const { data: arts } = await s.from('articles').select('id, article_number').eq('law_id', RDL_2_2015);
  const artMap = new Map(arts.map(a => [a.article_number, a.id]));
  // Scope actual T18
  const scopeArts = new Set(['10','11','12','14','15','16','17','18','19','20','21','39','40','41']);

  const rows = [];
  const skipped = [];
  for (const q of nuevas) {
    const artNum = extractArt(q.text) || extractArt(q.explanation) || extractArt(q.articleHint || '');
    if (!artNum || !artMap.has(artNum)) { skipped.push({ q: q.text.slice(0,80), reason: 'art no encontrado: ' + artNum }); continue; }
    if (!scopeArts.has(artNum)) { skipped.push({ q: q.text.slice(0,80), reason: 'art fuera del scope T18: ' + artNum }); continue; }
    const articleId = artMap.get(artNum);

    const opts = { A: null, B: null, C: null, D: null };
    for (const o of q.options) opts[o.letter] = o.text;
    const correctOption = ['A','B','C','D'].indexOf(q.correctAnswer);
    if (correctOption < 0) { skipped.push({ q: q.text.slice(0,80), reason: 'correct invalido' }); continue; }

    rows.push({
      question_text: q.text,
      option_a: opts.A, option_b: opts.B, option_c: opts.C, option_d: opts.D,
      correct_option: correctOption,
      explanation: q.explanation,
      primary_article_id: articleId,
      is_active: false,
      deactivation_reason: 'Pendiente de revisión post-importación',
      topic_review_status: 'pending',
      question_type: 'single',
      difficulty: 'medium',
      content_hash: contentHash(q.text, opts.A, opts.B, opts.C, opts.D),
      is_official_exam: false,
      tags: ['Tema 18', 'Estatuto de los Trabajadores', 'RDL 2/2015', 'C1 Galicia'],
    });
  }

  console.log('\nA insertar:', rows.length, '| Skipped:', skipped.length);
  if (skipped.length) for (const x of skipped) console.log('  SKIP:', x.reason, '|', x.q);

  // === 5) Insertar ===
  let inserted = 0;
  const insertedIds = [];
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
  fs.writeFileSync('c1_t18_imported_ids.json', JSON.stringify(insertedIds, null, 2));
})();
