require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
const clean = require('./lib/import-cleanup.cjs');
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const DL_1_1999 = '91305f0e-96ca-40cb-920f-811081fe0a55';
const SRC = '/home/manuel/Documentos/github/vence/preguntas-para-subir/tutestdigital/libro-72-test-interactivo-74-administrativo-c1-xunta-de-galicia-ed-20/Tema_14.-_Tema_7-_Decreto_Legislativo_1_1999_de_7_de_octubre,_por_el_que_se_aprueba_el_texto_refundi.json';
const LAW_CTX = 'el Decreto Legislativo 1/1999, del régimen financiero y presupuestario de Galicia';
const MENTIONS = /\bdl\s*1\/1999\b|decreto\s+legislativo\s*1\/1999|régimen\s+financiero\s+y\s+presupuestario\s+de\s+galicia/i;
const SCOPE_ARTS = new Set(['1','2','3','4','5','6','7','8','9','10','11','12','13','46','46 bis','46 quater','46 quinquies','46 ter','47','48','49','50','50 bis','51','52','53','53 bis','54','55','55 bis','72','73','74','75','76','77','78','79','80','81']);

(async () => {
  const src = JSON.parse(fs.readFileSync(SRC));
  console.log('Fuente:', src.questions.length);

  const cleaned = src.questions.map(q => {
    if (!q.options || !q.correctAnswer) return null;
    let text = clean.stripInlineJunk(q.question || '');
    const parsed = clean.parseQuestion(text);
    text = parsed.question;
    let artNum = clean.extractArt(parsed.articleHint || '') || clean.extractArt(text) || clean.extractArt(q.explanation || '');
    const ctx = clean.ensureLawContext(text, LAW_CTX, MENTIONS);
    text = ctx.text;
    if (ctx.needs_manual_rewrite) {
      const eff = artNum || '1';
      text = clean.reformulateWithArticle(text, eff, LAW_CTX);
      if (!artNum) artNum = eff;
    }
    return { text, options: q.options, correctAnswer: q.correctAnswer, explanation: q.explanation || 'Pendiente de redacción (se revisará con agente).', artNum };
  }).filter(Boolean);
  console.log('Limpiadas:', cleaned.length);

  const seen = new Map();
  const uniques = [];
  for (const q of cleaned) { const k = clean.shuffleKey(q.text, q.options); if (!seen.has(k)) { seen.set(k, q); uniques.push(q); } }
  console.log('Únicas:', uniques.length);

  let dbQs = [];
  for (let from = 0;; from += 1000) {
    const { data } = await s.from('questions').select('question_text,option_a,option_b,option_c,option_d').eq('is_active', true).range(from, from + 999);
    if (!data || data.length === 0) break;
    dbQs.push(...data);
    if (data.length < 1000) break;
  }
  const dbSh = new Set(), dbN = new Set();
  for (const q of dbQs) {
    dbSh.add(clean.shuffleKey(q.question_text, [{text:q.option_a},{text:q.option_b},{text:q.option_c},{text:q.option_d}]));
    dbN.add(clean.normalize(q.question_text));
  }
  const nuevas = uniques.filter(q => !dbSh.has(clean.shuffleKey(q.text, q.options)) && !dbN.has(clean.normalize(q.text)));
  console.log('Nuevas:', nuevas.length);

  const { data: arts } = await s.from('articles').select('id, article_number').eq('law_id', DL_1_1999);
  const artMap = new Map(arts.map(a => [a.article_number, a.id]));

  const rows = [];
  const unmapped = [];
  for (const q of nuevas) {
    let artNum = q.artNum;
    if (!artNum || !SCOPE_ARTS.has(artNum)) { unmapped.push({ q: q.text.slice(0,80), artNum }); continue; }
    if (!artMap.has(artNum)) { unmapped.push({ q: q.text.slice(0,80), reason: 'not in BD: ' + artNum }); continue; }
    const opts = { A:null, B:null, C:null, D:null };
    for (const o of q.options) opts[o.letter] = o.text;
    const correctOption = ['A','B','C','D'].indexOf(q.correctAnswer);
    if (correctOption < 0) continue;
    rows.push({
      question_text: q.text,
      option_a: opts.A, option_b: opts.B, option_c: opts.C, option_d: opts.D,
      correct_option: correctOption,
      explanation: q.explanation,
      primary_article_id: artMap.get(artNum),
      is_active: false,
      deactivation_reason: 'Pendiente de revisión post-importación',
      topic_review_status: 'pending',
      question_type: 'single', difficulty: 'medium',
      content_hash: clean.contentHash(q.text, opts.A, opts.B, opts.C, opts.D),
      is_official_exam: false,
      tags: ['Tema 14', 'DL 1/1999', 'Régimen financiero Galicia', 'C1 Galicia'],
    });
  }
  console.log('A insertar:', rows.length, '| unmapped:', unmapped.length);
  if (unmapped.length) for (const u of unmapped) console.log('  SKIP:', JSON.stringify(u));

  const insertedIds = [];
  for (const row of rows) {
    const { data, error } = await s.from('questions').insert([row]).select('id');
    if (error) console.error('❌', error.message.slice(0,100));
    else insertedIds.push(data[0].id);
  }
  console.log('✅ Importadas:', insertedIds.length);
  fs.writeFileSync('c1_t14_imported_ids.json', JSON.stringify(insertedIds, null, 2));
})();
