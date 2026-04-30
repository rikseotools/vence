#!/usr/bin/env node
/**
 * Import InnoTest Policía Nacional questions into Vence BD
 *
 * Supports 3, 4, and 5 option questions.
 *
 * Usage: node scripts/_tmp_pn_import_questions.cjs [bloque]
 *   bloques: conocimientos, examenes-oficiales, especificos-conocimientos,
 *            comunes, ingles, ingles-tests, psicotecnicos, psicotecnicos-tests,
 *            psicotecnicos-especificos, psicotecnicos-oficiales, simulacros
 *   default: ALL bloques
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const PN_DIR = path.join(__dirname, '..', 'preguntas-para-subir', 'innotest-policia-nacional');
const LAW_MAP = JSON.parse(fs.readFileSync(path.join(PN_DIR, '_law_map.json'), 'utf-8'));

const ALL_BLOQUES = [
  'conocimientos', 'examenes-oficiales', 'especificos-conocimientos',
  'comunes', 'ingles', 'ingles-tests', 'psicotecnicos', 'psicotecnicos-tests',
  'psicotecnicos-especificos', 'psicotecnicos-oficiales', 'simulacros',
];

const SELECTED = process.argv[2] ? [process.argv[2]] : ALL_BLOQUES;

// ── Helpers ──────────────────────────────────────────────────────

function normalize(text) {
  return (text || '').toLowerCase()
    .replace(/[áàâä]/g, 'a').replace(/[éèêë]/g, 'e').replace(/[íìîï]/g, 'i')
    .replace(/[óòôö]/g, 'o').replace(/[úùûü]/g, 'u').replace(/ñ/g, 'n')
    .replace(/<[^>]*>/g, '')
    .replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
}

function generateContentHash(text) {
  return crypto.createHash('sha256').update(normalize(text)).digest('hex');
}

const LETTER_TO_NUM = { 'A': 0, 'B': 1, 'C': 2, 'D': 3, 'E': 4 };

// ── Article cache ──────────────────────────────────────────────

const articleCache = {};

async function findArticleId(lawId, articleNumber) {
  if (!lawId || !articleNumber) return null;
  const key = lawId + '_' + articleNumber;
  if (articleCache[key] !== undefined) return articleCache[key];

  const { data } = await s.from('articles').select('id')
    .eq('law_id', lawId)
    .eq('article_number', String(articleNumber))
    .limit(1);

  let id = data?.[0]?.id || null;

  // Fallback: try Art 0
  if (!id) {
    const key0 = lawId + '_0';
    if (articleCache[key0] !== undefined) {
      id = articleCache[key0];
    } else {
      const { data: d0 } = await s.from('articles').select('id')
        .eq('law_id', lawId).eq('article_number', '0').limit(1);
      const id0 = d0?.[0]?.id || null;
      articleCache[key0] = id0;
      id = id0;
    }
  }

  articleCache[key] = id;
  return id;
}

// ── Fallback article for bloques without law references ─────────

// For psicotécnicos, inglés, etc — need a catch-all Art 0 per bloque
const BLOQUE_FALLBACK_LAW = {};

async function getOrCreateFallbackArticle(bloqueName) {
  if (BLOQUE_FALLBACK_LAW[bloqueName]) return BLOQUE_FALLBACK_LAW[bloqueName];

  const lawNameMap = {
    'ingles': 'Inglés PN',
    'ingles-tests': 'Inglés PN',
    'psicotecnicos': 'Psicotécnicos PN',
    'psicotecnicos-tests': 'Psicotécnicos PN',
    'psicotecnicos-especificos': 'Psicotécnicos PN',
    'psicotecnicos-oficiales': 'Psicotécnicos PN',
    'conocimientos': 'Conocimientos PN (sin ley)',
    'examenes-oficiales': 'Exámenes Oficiales PN (sin ley)',
    'especificos-conocimientos': 'Específicos PN (sin ley)',
    'comunes': 'Comunes PN (sin ley)',
    'simulacros': 'Simulacros PN (sin ley)',
  };

  const virtualName = lawNameMap[bloqueName];
  if (!virtualName) return null;

  // Check if virtual law exists
  let { data: law } = await s.from('laws').select('id').eq('short_name', virtualName).single();

  if (!law) {
    // Create virtual law
    const slug = virtualName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const { data: created } = await s.from('laws').insert({
      short_name: virtualName,
      name: virtualName + ' — Policía Nacional',
      slug,
      scope: 'national',
      type: 'regulation',
      is_active: true,
      is_virtual: true,
    }).select('id').single();
    law = created;
    console.log(`  Created virtual law: ${virtualName} → ${law.id.substring(0, 8)}`);
  }

  // Check if Art 0 exists
  let { data: art } = await s.from('articles').select('id')
    .eq('law_id', law.id).eq('article_number', '0').single();

  if (!art) {
    const { data: created } = await s.from('articles').insert({
      law_id: law.id,
      article_number: '0',
      title: virtualName + ' — Contenido general',
      content: 'Artículo contenedor para preguntas de ' + virtualName,
      is_active: true,
    }).select('id').single();
    art = created;
    console.log(`  Created Art 0 for ${virtualName} → ${art.id.substring(0, 8)}`);
  }

  BLOQUE_FALLBACK_LAW[bloqueName] = art.id;
  return art.id;
}

// ── Load existing questions for dedup ──────────────────────────

async function loadDbQuestions() {
  console.log('Loading existing questions for dedup...');
  const normSet = new Set();
  let page = 0;
  let total = 0;
  while (true) {
    const { data } = await s.from('questions')
      .select('question_text')
      .range(page * 1000, (page + 1) * 1000 - 1);
    if (!data || data.length === 0) break;
    for (const q of data) normSet.add(normalize(q.question_text));
    total += data.length;
    page++;
    if (data.length < 1000) break;
  }
  console.log('Loaded', total, 'existing questions →', normSet.size, 'unique normalized\n');
  return normSet;
}

// ── Process one bloque ──────────────────────────────────────────

async function processBloque(bloqueName, normSet) {
  const bloqueDir = path.join(PN_DIR, bloqueName);
  if (!fs.existsSync(bloqueDir)) {
    console.log(`\n⏭ ${bloqueName}: directory not found, skipping`);
    return { inserted: 0, dupes: 0, errors: 0, processed: 0 };
  }

  const files = fs.readdirSync(bloqueDir).filter(f => f.endsWith('.json') && !f.startsWith('_'));
  if (files.length === 0) return { inserted: 0, dupes: 0, errors: 0, processed: 0 };

  console.log(`\n${'═'.repeat(50)}`);
  console.log(`📚 ${bloqueName.toUpperCase()} (${files.length} files)`);
  console.log('═'.repeat(50));

  const isExam = bloqueName.includes('oficiales') || bloqueName === 'simulacros';
  const needsFallback = ['ingles', 'ingles-tests', 'psicotecnicos', 'psicotecnicos-tests',
    'psicotecnicos-especificos', 'psicotecnicos-oficiales'].includes(bloqueName);

  let fallbackArticleId = null;
  if (needsFallback) {
    fallbackArticleId = await getOrCreateFallbackArticle(bloqueName);
  }

  let totalInserted = 0, totalDupes = 0, totalErrors = 0, totalProcessed = 0;

  for (const file of files) {
    const data = JSON.parse(fs.readFileSync(path.join(bloqueDir, file), 'utf-8'));
    const questions = data.questions || [];
    if (questions.length === 0) continue;

    process.stdout.write(`  [${file.substring(0, 40)}] ${questions.length}q...`);
    let inserted = 0, dupes = 0, errors = 0;

    const BATCH_SIZE = 50;
    for (let i = 0; i < questions.length; i += BATCH_SIZE) {
      const batch = questions.slice(i, i + BATCH_SIZE);
      const toInsert = [];

      for (const q of batch) {
        totalProcessed++;

        // Skip empty questions
        if (!q.question || q.question.length < 5) continue;

        // Must have at least 3 options (PN uses 3-option format)
        if (!q.options || q.options.length < 3) continue;

        // Dedup
        const normQ = normalize(q.question);
        if (normSet.has(normQ)) { dupes++; totalDupes++; continue; }

        // Map law + article
        let articleId = null;

        if (q.article && q.article.leyID) {
          const mapping = LAW_MAP[String(q.article.leyID)];
          if (mapping && mapping.law_id) {
            articleId = await findArticleId(mapping.law_id, q.article.articulo);
          }
        }

        // Fallback for bloques without article references
        if (!articleId && fallbackArticleId) {
          articleId = fallbackArticleId;
        }

        // If still no article, use a bloque-level fallback (virtual law Art 0)
        if (!articleId) {
          if (!fallbackArticleId) {
            // Create fallback for this bloque on the fly
            fallbackArticleId = await getOrCreateFallbackArticle(bloqueName);
          }
          if (fallbackArticleId) {
            articleId = fallbackArticleId;
          } else {
            errors++;
            totalErrors++;
            continue;
          }
        }

        // Correct answer
        const correctNum = LETTER_TO_NUM[q.correctAnswer];
        if (correctNum === undefined || correctNum === null) continue;

        // Build options (3, 4, or 5)
        const opts = q.options.map(o => o.text || '');
        const optA = opts[0] || '';
        const optB = opts[1] || '';
        const optC = opts[2] || '';
        const optD = opts[3] || null;  // nullable for 3-option
        const optE = opts[4] || null;  // nullable for 3/4-option

        // Content hash
        const hash = generateContentHash(q.question);

        // Explanation: strip HTML for now
        let explanation = (q.explanation || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
        if (explanation.length < 5) explanation = 'Sin explicación disponible.';

        toInsert.push({
          question_text: q.question,
          option_a: optA,
          option_b: optB,
          option_c: optC,
          option_d: optD,
          option_e: optE,
          correct_option: correctNum,
          explanation,
          primary_article_id: articleId,
          difficulty: 'medium',
          is_active: false,
          deactivation_reason: 'Pendiente de revisión post-importación',
          topic_review_status: 'pending',
          is_official_exam: isExam,
          exam_position: isExam ? 'policia_nacional' : null,
          exam_source: isExam ? (data.tema || null) : null,
          content_hash: hash,
          tags: ['InnoTest', 'PN', data.tema || bloqueName],
        });

        normSet.add(normQ);
      }

      // Insert batch
      if (toInsert.length > 0) {
        const { data: result, error } = await s.from('questions')
          .insert(toInsert)
          .select('id');

        if (error) {
          // Batch failed — insert one by one
          for (const q of toInsert) {
            const { error: e2 } = await s.from('questions').insert(q);
            if (e2) {
              if (e2.message.includes('content_hash') || e2.message.includes('duplicate') || e2.message.includes('unique')) {
                dupes++; totalDupes++;
              } else {
                errors++; totalErrors++;
                if (totalErrors <= 5) console.log('\n    ERR:', e2.message.substring(0, 120));
              }
            } else {
              inserted++; totalInserted++;
            }
          }
        } else {
          inserted += result?.length || toInsert.length;
          totalInserted += result?.length || toInsert.length;
        }
      }
    }

    console.log(` +${inserted} (${dupes} dupes, ${errors} err)`);
  }

  console.log(`\n  ✅ ${bloqueName}: ${totalInserted} inserted, ${totalDupes} dupes, ${totalErrors} errors`);
  return { inserted: totalInserted, dupes: totalDupes, errors: totalErrors, processed: totalProcessed };
}

// ── Main ──────────────────────────────────────────────────────

async function main() {
  console.log('🚀 Import InnoTest Policía Nacional\n');
  console.log('Bloques:', SELECTED.join(', '));

  const normSet = await loadDbQuestions();

  const grandTotals = { inserted: 0, dupes: 0, errors: 0, processed: 0 };

  for (const bloque of SELECTED) {
    const result = await processBloque(bloque, normSet);
    grandTotals.inserted += result.inserted;
    grandTotals.dupes += result.dupes;
    grandTotals.errors += result.errors;
    grandTotals.processed += result.processed;
  }

  console.log('\n' + '═'.repeat(50));
  console.log('📊 RESUMEN FINAL — POLICÍA NACIONAL');
  console.log('═'.repeat(50));
  console.log(`Procesadas: ${grandTotals.processed}`);
  console.log(`Insertadas: ${grandTotals.inserted}`);
  console.log(`Duplicadas: ${grandTotals.dupes}`);
  console.log(`Errores:    ${grandTotals.errors}`);
}

main().catch(e => { console.error('❌ Fatal:', e); process.exit(1); });
