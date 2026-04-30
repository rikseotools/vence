require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
const clean = require('./lib/import-cleanup.cjs');
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const TFUE = 'eba370d3-73d9-44a9-9865-48d2effabaf4';
const SRC = '/home/manuel/Documentos/github/vence/preguntas-para-subir/tutestdigital/libro-72-test-interactivo-74-administrativo-c1-xunta-de-galicia-ed-20/Tema_4.-_Tema_4.-_Fuentes_del_Derecho_europeo__actos_jurídicos_de_la_Unión,_procedimientos_de_adopci.json';
const LAW_CONTEXT = 'el Tratado de Funcionamiento de la Unión Europea';

// Artículo por defecto cuando no hay cita explícita — art 288 "tipos de actos" es el más general
const DEFAULT_ART_FALLBACK = '288';

// Regex específico para detectar menciones del TFUE
const MENTIONS_TFUE = /\btfue\b|tratado\s+de\s+funcionamiento|derecho\s+(?:de\s+la\s+uni[oó]n|europeo|comunitario)|uni[oó]n\s+europea/i;

(async () => {
  const src = JSON.parse(fs.readFileSync(SRC));
  console.log('Fuente:', src.questions.length, 'preguntas');

  // === Limpieza de cada pregunta ===
  const cleaned = src.questions.map(q => {
    if (!q.options || !q.correctAnswer) return null;
    let text = clean.stripInlineJunk(q.question || '');
    const parsed = clean.parseQuestion(text);
    text = parsed.question;

    // Determinar artículo: hint > extract > fallback
    let artNum = clean.extractArt(parsed.articleHint || '') || clean.extractArt(text) || clean.extractArt(q.explanation || '');

    // Contextualizar
    const ctxResult = clean.ensureLawContext(text, LAW_CONTEXT, MENTIONS_TFUE);
    text = ctxResult.text;
    if (ctxResult.needs_manual_rewrite && artNum) {
      text = clean.reformulateWithArticle(text, artNum, LAW_CONTEXT);
    }

    // Fallback art 288 si sigue sin artículo
    if (!artNum) artNum = DEFAULT_ART_FALLBACK;

    return { text, options: q.options, correctAnswer: q.correctAnswer, explanation: q.explanation || 'Pendiente de redacción (se revisará con agente).', artNum };
  }).filter(Boolean);
  console.log('Limpiadas:', cleaned.length);

  // === Dedup intra ===
  const seen = new Map();
  const uniques = [];
  for (const q of cleaned) {
    const k = clean.shuffleKey(q.text, q.options);
    if (!seen.has(k)) { seen.set(k, q); uniques.push(q); }
  }
  console.log('Únicas:', uniques.length);

  // === Dedup vs BD ===
  let dbQs = [];
  for (let from = 0;; from += 1000) {
    const { data } = await s.from('questions').select('question_text,option_a,option_b,option_c,option_d').eq('is_active', true).range(from, from + 999);
    if (!data || data.length === 0) break;
    dbQs.push(...data);
    if (data.length < 1000) break;
  }
  const dbShuffle = new Set(), dbNorm = new Set();
  for (const q of dbQs) {
    dbShuffle.add(clean.shuffleKey(q.question_text, [{text:q.option_a},{text:q.option_b},{text:q.option_c},{text:q.option_d}]));
    dbNorm.add(clean.normalize(q.question_text));
  }
  const nuevas = uniques.filter(q => !dbShuffle.has(clean.shuffleKey(q.text, q.options)) && !dbNorm.has(clean.normalize(q.text)));
  console.log('Nuevas vs BD:', nuevas.length);

  // === Mapeo a artículo TFUE ===
  const { data: arts } = await s.from('articles').select('id, article_number').eq('law_id', TFUE);
  const artMap = new Map(arts.map(a => [a.article_number, a.id]));
  // Scope T4: TFUE arts 288-299
  const scopeArts = new Set(['288','289','290','291','292','293','294','295','296','297','298','299']);

  const rows = [];
  const skipped = [];
  for (const q of nuevas) {
    let artNum = q.artNum;
    // Si el artículo no está en el scope, usar el default (288) como fallback
    if (!scopeArts.has(artNum)) {
      skipped.push({ original_art: artNum, q: q.text.slice(0, 100) });
      artNum = DEFAULT_ART_FALLBACK;
    }
    if (!artMap.has(artNum)) { skipped.push({ reason: 'art no en BD: ' + artNum, q: q.text.slice(0,80) }); continue; }
    const articleId = artMap.get(artNum);

    const opts = { A: null, B: null, C: null, D: null };
    for (const o of q.options) opts[o.letter] = o.text;
    const correctOption = ['A','B','C','D'].indexOf(q.correctAnswer);
    if (correctOption < 0) { skipped.push({ reason: 'correct invalido', q: q.text.slice(0,80) }); continue; }

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
      content_hash: clean.contentHash(q.text, opts.A, opts.B, opts.C, opts.D),
      is_official_exam: false,
      tags: ['Tema 4', 'Fuentes Derecho UE', 'TFUE', 'C1 Galicia'],
    });
  }
  console.log('\nA insertar:', rows.length);
  if (skipped.length) {
    console.log('Con art original fuera del scope (re-mapeadas a 288 o skipped):');
    for (const x of skipped) console.log('  ', JSON.stringify(x));
  }

  let inserted = 0;
  const insertedIds = [];
  for (let i = 0; i < rows.length; i += 50) {
    const chunk = rows.slice(i, i + 50);
    const { data, error } = await s.from('questions').insert(chunk).select('id');
    if (error) {
      for (const row of chunk) {
        const { data: d2, error: e2 } = await s.from('questions').insert([row]).select('id');
        if (e2) console.error('  ❌', e2.message.slice(0,100));
        else { inserted++; insertedIds.push(d2[0].id); }
      }
    } else { inserted += data.length; insertedIds.push(...data.map(r => r.id)); }
  }
  console.log('\n✅ Importadas:', inserted, '/', rows.length);
  fs.writeFileSync('c1_t4_imported_ids.json', JSON.stringify(insertedIds, null, 2));
})();
