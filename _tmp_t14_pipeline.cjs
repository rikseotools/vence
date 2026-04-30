require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const T14_ID = 'eb0e465b-0ab8-4996-af2c-b789735ba41f';
const LEY_7_2014 = '1893180f-a842-4990-9661-d23d63958ff4';
const LEY_4_2019 = '3a3bb3d5-cf43-43b8-9137-ffd805dfcbd2';

const SRC_FILE = '/home/manuel/Documentos/github/vence/preguntas-para-subir/tutestdigital/libro-67-test-interactivo-83-auxiliar-administrativo-c2-xunta-de-gali/Tema_14.-_Tema_14.-_La_Gestión_de_documentos_en_la_Administración_de_la_Xunta_de_Galicia._Clasificac.json';

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

// Infer law based on context clues in question + explanation text
function inferLaw(text) {
  const t = (text || '').toLowerCase();
  // Explicit Ley 4/2019 mentions
  if (/ley\s*4\/2019/i.test(text)) return 'LEY_4_2019';
  // Registro electrónico, sede electrónica, DOG, firma electrónica, notificación electrónica → Ley 4/2019
  if (/registro electr[oó]nico|sede electr[oó]nica|diario oficial de galicia|\bdog\b|firma electr[oó]nica|notificaci[oó]n electr[oó]nica|carpeta ciudadana|interoperabilidad/i.test(text)) return 'LEY_4_2019';
  // Archivos, patrimonio documental, sistema de archivos, documentos de titularidad → Ley 7/2014
  if (/archivo|patrimonio documental|sistema de archivos|titularidad p[uú]blica|titularidad privada|selecci[oó]n documental|valoraci[oó]n documental|clasificaci[oó]n de documentos|historia/i.test(text)) return 'LEY_7_2014';
  // "la presente ley" + archivo context → Ley 7/2014
  if (/presente ley/i.test(text)) return 'LEY_7_2014';
  return null;
}

(async () => {
  console.log('=== 1. Actualizando topic_scope T14 ===');
  // Scope: todos los artículos que cubren el epígrafe de T14
  // Ley 7/2014: todos los arts 1-56 (archivos y documentos)
  // Ley 4/2019: arts relacionados con registro electrónico (16-48), DOG (49-51), archivo electrónico (81-82)
  const ley7_2014_arts = Array.from({length: 56}, (_, i) => String(i + 1));
  const ley4_2019_arts = [
    // Cap I sede electrónica
    '16','17','18','19',
    // Cap II carpeta ciudadana
    '20','21','22','23','24','25',
    // Cap III sistema único de registro (incluye Registro Electrónico General)
    '26','27','28','29','30','31','32','33','34','35','36',
    // Cap IV representación
    '37',
    // Cap V identificación y firma
    '38',
    // Cap VI notificación
    '39','40','41',
    // Cap VII medios de pago
    '42','43','44',
    // Cap VIII copias auténticas
    '45','46','47',
    // Cap IX documentos electrónicos
    '48',
    // T II DOG
    '49','50','51',
    // T IV Cap VII archivo electrónico
    '81','82',
  ];

  for (const [lawId, arts, label] of [[LEY_7_2014, ley7_2014_arts, 'Ley 7/2014'], [LEY_4_2019, ley4_2019_arts, 'Ley 4/2019']]) {
    const { data: existing } = await supabase.from('topic_scope').select('id').eq('topic_id', T14_ID).eq('law_id', lawId).maybeSingle();
    if (existing) {
      const { error } = await supabase.from('topic_scope').update({ article_numbers: arts }).eq('id', existing.id);
      if (error) { console.error('❌', label, error.message); continue; }
      console.log('  ✅', label, 'actualizado:', arts.length, 'arts');
    } else {
      const { error } = await supabase.from('topic_scope').insert({ topic_id: T14_ID, law_id: lawId, article_numbers: arts });
      if (error) { console.error('❌', label, error.message); continue; }
      console.log('  ✅', label, 'insertado:', arts.length, 'arts');
    }
  }

  console.log('\n=== 2. Leyendo y parseando fuente ===');
  const src = JSON.parse(fs.readFileSync(SRC_FILE));
  console.log('Fuente T14:', src.questions.length, 'preguntas');

  const all = src.questions.map((q, idx) => {
    const p = parseQuestion(q.question);
    const fullText = p.question + ' ' + (q.explanation || '');
    const lawHint = inferLaw(fullText);
    return {
      idx,
      cleaned: p.question,
      articleHint: p.articleHint,
      options: q.options,
      correctAnswer: q.correctAnswer,
      explanation: q.explanation || 'Pendiente de redacción (se revisará con agente).',
      lawHint,
    };
  });

  console.log('\n=== 3. Dedup intra-batch ===');
  const seen = new Map();
  const uniques = [];
  for (const q of all) {
    const key = shuffleKey(q.cleaned, q.options);
    if (!seen.has(key)) { seen.set(key, q); uniques.push(q); }
  }
  console.log('Únicas:', uniques.length);

  console.log('\n=== 4. Dedup vs BD ===');
  let dbQs = [];
  for (let from = 0;; from += 1000) {
    const { data } = await supabase.from('questions').select('id,question_text,option_a,option_b,option_c,option_d').eq('is_active', true).range(from, from + 999);
    if (!data || data.length === 0) break;
    dbQs.push(...data);
    if (data.length < 1000) break;
  }
  console.log('Preguntas activas en BD:', dbQs.length);
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

  console.log('\n=== 5. Mapeo a ley + artículo ===');
  // Load articles for both laws
  const { data: ley7Arts } = await supabase.from('articles').select('id, article_number').eq('law_id', LEY_7_2014);
  const { data: ley4Arts } = await supabase.from('articles').select('id, article_number').eq('law_id', LEY_4_2019);
  const ley7Map = new Map(ley7Arts.map(a => [a.article_number, a.id]));
  const ley4Map = new Map(ley4Arts.map(a => [a.article_number, a.id]));

  const lawScopeArts = {
    LEY_7_2014: new Set(ley7_2014_arts),
    LEY_4_2019: new Set(ley4_2019_arts),
  };
  const lawMap = { LEY_7_2014: ley7Map, LEY_4_2019: ley4Map };

  const mapped = [], unmapped = [];
  for (const q of newQs) {
    // Extract article number from text
    let art = null;
    if (q.articleHint) art = extractArt(q.articleHint);
    if (!art && q.explanation) art = extractArt(q.explanation);
    if (!art) art = extractArt(q.cleaned);

    let lawTarget = q.lawHint;
    let articleId = null;

    if (art && lawTarget) {
      const m = lawMap[lawTarget];
      if (m.has(art) && lawScopeArts[lawTarget].has(art)) {
        articleId = m.get(art);
      }
    }

    // Fallback: if no law hint but we have art, try Ley 7/2014 first (most questions)
    if (!articleId && art) {
      if (ley7Map.has(art) && lawScopeArts.LEY_7_2014.has(art)) {
        articleId = ley7Map.get(art);
        lawTarget = 'LEY_7_2014';
      } else if (ley4Map.has(art) && lawScopeArts.LEY_4_2019.has(art)) {
        articleId = ley4Map.get(art);
        lawTarget = 'LEY_4_2019';
      }
    }

    // Last fallback: map to Ley 7/2014 art 1 as "general" if nothing else
    if (!articleId) {
      unmapped.push({ ...q, _art: art, _law: lawTarget });
      continue;
    }

    mapped.push({ ...q, primary_article_id: articleId, article_number: art, lawTarget });
  }
  console.log('Mapeadas:', mapped.length, '| Sin mapear:', unmapped.length);
  if (unmapped.length && unmapped.length <= 30) {
    for (const u of unmapped) console.log('  [' + u.idx + '] art=' + (u._art || '—') + ' law=' + (u._law || '—') + ' | ' + u.cleaned.slice(0, 100));
  }

  console.log('\n=== 6. Inserción en BD (desactivadas) ===');
  const rows = mapped.map(q => {
    const opts = { A: null, B: null, C: null, D: null };
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
      question_type: 'single',
      difficulty: 'medium',
      content_hash: contentHash(q.cleaned, opts.A, opts.B, opts.C, opts.D),
      is_official_exam: false,
      tags: ['Tema 14', 'Gestión Documental', 'Xunta Galicia'],
    };
  }).filter(r => r.correct_option >= 0);

  let inserted = 0;
  const insertedIds = [];
  for (let i = 0; i < rows.length; i += 50) {
    const chunk = rows.slice(i, i + 50);
    const { data, error } = await supabase.from('questions').insert(chunk).select('id');
    if (error) {
      console.error('  chunk error, retrying one by one:', error.message);
      for (const row of chunk) {
        const { data: d2, error: e2 } = await supabase.from('questions').insert([row]).select('id');
        if (e2) console.error('  ❌', e2.message.slice(0, 80));
        else { inserted++; insertedIds.push(d2[0].id); }
      }
    } else { inserted += data.length; insertedIds.push(...data.map(r => r.id)); }
  }
  console.log('Importadas:', inserted, '/', rows.length);
  fs.writeFileSync('t14_galicia_imported_ids.json', JSON.stringify(insertedIds, null, 2));
  fs.writeFileSync('t14_galicia_unmapped.json', JSON.stringify(unmapped, null, 2));
  console.log('\nImported IDs →  t14_galicia_imported_ids.json');
  console.log('Unmapped      →  t14_galicia_unmapped.json');
})();
