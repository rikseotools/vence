require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
const clean = require('./lib/import-cleanup.cjs');
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const TUE = 'ddc2ffa9-d99b-4abc-b149-ab47916ab9da';
const TFUE = 'eba370d3-73d9-44a9-9865-48d2effabaf4';
const SRC = '/home/manuel/Documentos/github/vence/preguntas-para-subir/tutestdigital/libro-72-test-interactivo-74-administrativo-c1-xunta-de-galicia-ed-20/Tema_6.-_Tema_6.-_Las_competencias_de_la_Unión_Europea._El_marco_de_atribuciones_concedidas_por_los_.json';

const LAW_CTX_TFUE = 'el Tratado de Funcionamiento de la Unión Europea';
const LAW_CTX_TUE = 'el Tratado de la Unión Europea';

const MENTIONS_TFUE = /\btfue\b|tratado\s+de\s+funcionamiento/i;
const MENTIONS_TUE = /\btue\b|tratado\s+de\s+la\s+uni[oó]n\s+europea/i;
const MENTIONS_ANY = /\bt[fu][ue]\b|tratado/i;

const TFUE_SCOPE = new Set(['2','3','4','5','6']);
const TUE_SCOPE = new Set(['3','4','5']);

(async () => {
  const src = JSON.parse(fs.readFileSync(SRC));
  console.log('Fuente:', src.questions.length);

  const cleaned = src.questions.map(q => {
    if (!q.options || !q.correctAnswer) return null;
    let text = clean.stripInlineJunk(q.question || '');
    const parsed = clean.parseQuestion(text);
    text = parsed.question;

    // Determinar TUE o TFUE según el texto
    const fullText = text + ' ' + (q.explanation || '');
    const isTFUE = MENTIONS_TFUE.test(fullText);
    const isTUE = !isTFUE && MENTIONS_TUE.test(fullText);
    const lawFullName = isTUE ? LAW_CTX_TUE : LAW_CTX_TFUE;
    const lawId = isTUE ? TUE : TFUE;
    const lawScope = isTUE ? TUE_SCOPE : TFUE_SCOPE;
    const lawShort = isTUE ? 'TUE' : 'TFUE';

    let artNum = clean.extractArt(parsed.articleHint || '') || clean.extractArt(text) || clean.extractArt(q.explanation || '');

    // Contextualizar
    const mentionsRegex = isTUE ? MENTIONS_TUE : (isTFUE ? MENTIONS_TFUE : MENTIONS_ANY);
    const ctxResult = clean.ensureLawContext(text, lawFullName, mentionsRegex);
    text = ctxResult.text;
    if (ctxResult.needs_manual_rewrite) {
      const effectiveArt = artNum || (isTUE ? '5' : '2');
      text = clean.reformulateWithArticle(text, effectiveArt, lawFullName);
      if (!artNum) artNum = effectiveArt;
    }

    return { text, options: q.options, correctAnswer: q.correctAnswer, explanation: q.explanation || 'Pendiente de redacción (se revisará con agente).', artNum, lawId, lawShort, lawScope };
  }).filter(Boolean);

  // Dedup
  const seen = new Map();
  const uniques = [];
  for (const q of cleaned) {
    const k = clean.shuffleKey(q.text, q.options);
    if (!seen.has(k)) { seen.set(k, q); uniques.push(q); }
  }
  console.log('Únicas:', uniques.length);

  // Dedup vs BD
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
  console.log('Nuevas:', nuevas.length);

  // Pre-fetch articles for both laws
  const { data: tueArts } = await s.from('articles').select('id, article_number').eq('law_id', TUE);
  const { data: tfueArts } = await s.from('articles').select('id, article_number').eq('law_id', TFUE);
  const tueMap = new Map(tueArts.map(a => [a.article_number, a.id]));
  const tfueMap = new Map(tfueArts.map(a => [a.article_number, a.id]));

  const rows = [];
  for (const q of nuevas) {
    let artNum = q.artNum;
    // Si no está en el scope del ley detectada, usar fallback
    if (!q.lawScope.has(artNum)) artNum = q.lawShort === 'TUE' ? '5' : '2';
    const artMap = q.lawShort === 'TUE' ? tueMap : tfueMap;
    if (!artMap.has(artNum)) continue;
    const articleId = artMap.get(artNum);

    const opts = { A: null, B: null, C: null, D: null };
    for (const o of q.options) opts[o.letter] = o.text;
    const correctOption = ['A','B','C','D'].indexOf(q.correctAnswer);
    if (correctOption < 0) continue;

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
      tags: ['Tema 6', 'Competencias UE', q.lawShort, 'C1 Galicia'],
    });
  }
  console.log('A insertar:', rows.length);
  const insertedIds = [];
  for (const row of rows) {
    const { data, error } = await s.from('questions').insert([row]).select('id');
    if (error) console.error('❌', error.message.slice(0,100));
    else insertedIds.push(data[0].id);
  }
  console.log('✅ Importadas:', insertedIds.length);
  fs.writeFileSync('c1_t6_imported_ids.json', JSON.stringify(insertedIds, null, 2));
})();
