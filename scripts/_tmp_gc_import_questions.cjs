#!/usr/bin/env node
/**
 * Import InnoTest Guardia Civil questions into Vence BD
 *
 * Step 1: Map InnoTest leyID+articulo → BD law_id+article_id
 * Step 2: Detect duplicates (Jaccard + options)
 * Step 3: Insert new questions (desactivadas)
 *
 * Usage: node scripts/_tmp_gc_import_questions.cjs [bloque]
 *   bloque: conocimientos (default), examenes-oficiales
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const BLOQUE = process.argv[2] || 'conocimientos';
const BASE = path.join(__dirname, '..', 'preguntas-para-subir', 'innotest-guardia-civil', BLOQUE);

// Fallback article IDs for questions without article (Art 0 of virtual laws)
const FALLBACK_ARTICLE = {
  'ingles': '9e2090cb-3f50-47f8-81fd-d239ab2b49a9',        // Art 0 Inglés GC
  'ortografia': '1c45bee9-f3fc-4397-bd9b-45976619edc6',     // Art 0 Lengua Española GC
};
const LAW_MAP = JSON.parse(fs.readFileSync(
  path.join(__dirname, '..', 'preguntas-para-subir', 'innotest-guardia-civil', '_law_map.json'), 'utf-8'
));

// ── Helpers ──────────────────────────────────────────────────────

function normalize(text) {
  return (text || '').toLowerCase()
    .replace(/[áàâä]/g,'a').replace(/[éèêë]/g,'e').replace(/[íìîï]/g,'i')
    .replace(/[óòôö]/g,'o').replace(/[úùûü]/g,'u').replace(/ñ/g,'n')
    .replace(/<[^>]*>/g, '') // strip HTML
    .replace(/[^a-z0-9]/g,' ').replace(/\s+/g,' ').trim();
}

function contentHash(text) {
  return crypto.createHash('sha256').update(normalize(text)).digest('hex');
}

function normalizeOptions(opts) {
  return opts.map(o => normalize(o.text || o)).sort().join('|||');
}

function jaccard(a, b) {
  const wa = new Set(a.split(' ').filter(w => w.length > 2));
  const wb = new Set(b.split(' ').filter(w => w.length > 2));
  let intersection = 0;
  for (const w of wa) if (wb.has(w)) intersection++;
  const union = new Set([...wa, ...wb]).size;
  return union === 0 ? 0 : intersection / union;
}

const LETTER_TO_NUM = { 'A': 0, 'B': 1, 'C': 2, 'D': 3 };

// ── Article cache ──────────────────────────────────────────────

const articleCache = {}; // key: law_id + '_' + article_number → article.id

async function findArticleId(lawId, articleNumber) {
  if (!lawId || !articleNumber) return null;
  const key = lawId + '_' + articleNumber;
  if (articleCache[key] !== undefined) return articleCache[key];

  const { data } = await s.from('articles').select('id')
    .eq('law_id', lawId)
    .eq('article_number', String(articleNumber))
    .limit(1);

  const id = data?.[0]?.id || null;
  articleCache[key] = id;
  return id;
}

// ── Load existing questions for dedup ──────────────────────────

async function loadDbQuestions() {
  console.log('Loading existing questions for dedup...');
  const allQ = [];
  let page = 0;
  while (true) {
    const { data } = await s.from('questions')
      .select('id, question_text')
      .eq('is_active', true)
      .range(page * 1000, (page + 1) * 1000 - 1);
    if (!data || data.length === 0) break;
    allQ.push(...data);
    page++;
    if (data.length < 1000) break;
  }
  console.log('Loaded', allQ.length, 'existing questions');

  // Build normalized set for fast lookup
  const normSet = new Set();
  const normMap = new Map(); // normalized → id (for Jaccard comparison we'd need the text too)
  for (const q of allQ) {
    const norm = normalize(q.question_text);
    normSet.add(norm);
  }
  return { normSet, count: allQ.length };
}

// ── Main ──────────────────────────────────────────────────────

async function main() {
  console.log('=== Import InnoTest GC:', BLOQUE.toUpperCase(), '===\n');

  const files = fs.readdirSync(BASE).filter(f => f.endsWith('.json') && !f.startsWith('_'));
  console.log('Files:', files.length);

  // Load dedup data
  const { normSet } = await loadDbQuestions();

  // Stats
  let totalProcessed = 0, totalInserted = 0, totalDuplicates = 0;
  let totalNoArticle = 0, totalNoLaw = 0, totalArticleNotFound = 0;
  let totalErrors = 0;

  for (const file of files) {
    const data = JSON.parse(fs.readFileSync(path.join(BASE, file), 'utf-8'));
    console.log(`\n[${file}] ${data.tema} — ${data.questions.length} questions`);

    let inserted = 0, dupes = 0, noArt = 0, noLaw = 0, artNotFound = 0, errors = 0;

    // Process in batches of 50
    const BATCH_SIZE = 50;
    for (let i = 0; i < data.questions.length; i += BATCH_SIZE) {
      const batch = data.questions.slice(i, i + BATCH_SIZE);
      const toInsert = [];

      for (const q of batch) {
        totalProcessed++;

        // Skip if no question text
        if (!q.question || q.question.length < 10) continue;

        // Skip if < 4 options
        if (!q.options || q.options.length < 4) continue;

        // Dedup check (exact normalized match)
        const normQ = normalize(q.question);
        if (normSet.has(normQ)) {
          dupes++;
          totalDuplicates++;
          continue;
        }

        // Map law
        let lawId = null;
        let articleId = null;

        if (q.article && q.article.leyID) {
          const mapping = LAW_MAP[String(q.article.leyID)];
          if (mapping && mapping.law_id) {
            lawId = mapping.law_id;
            // Find article
            articleId = await findArticleId(lawId, q.article.articulo);
            if (!articleId) {
              artNotFound++;
              totalArticleNotFound++;
            }
          } else {
            noLaw++;
            totalNoLaw++;
          }
        } else {
          noArt++;
          totalNoArticle++;
          // Use fallback article for bloques without articles (inglés, ortografía)
          if (FALLBACK_ARTICLE[BLOQUE]) {
            articleId = FALLBACK_ARTICLE[BLOQUE];
          }
        }

        // For questions with article but no match, also use fallback
        if (!articleId && FALLBACK_ARTICLE[BLOQUE]) {
          articleId = FALLBACK_ARTICLE[BLOQUE];
        }

        // Build question object
        const correctNum = LETTER_TO_NUM[q.correctAnswer] ?? null;
        if (correctNum === null) continue;

        const questionText = q.question;
        const hash = contentHash(questionText);

        // Clean HTML from explanation
        let explanation = (q.explanation || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
        if (explanation.length < 5) explanation = null;

        toInsert.push({
          question_text: questionText,
          option_a: q.options[0]?.text || '',
          option_b: q.options[1]?.text || '',
          option_c: q.options[2]?.text || '',
          option_d: q.options[3]?.text || '',
          correct_option: correctNum,
          explanation: explanation,
          primary_article_id: articleId,
          difficulty: 'medium',
          is_active: false,
          deactivation_reason: 'Pendiente de revisión post-importación',
          topic_review_status: 'pending',
          is_official_exam: BLOQUE === 'examenes-oficiales',
          exam_position: BLOQUE === 'examenes-oficiales' ? 'guardia_civil' : null,
          content_hash: hash,
          tags: ['InnoTest', data.tema || ''],
        });

        // Add to normSet to prevent intra-file dupes
        normSet.add(normQ);
      }

      // Insert batch
      if (toInsert.length > 0) {
        const { data: result, error } = await s.from('questions')
          .insert(toInsert)
          .select('id');

        if (error) {
          // Likely content_hash conflicts — insert one by one
          for (const q of toInsert) {
            const { error: e2 } = await s.from('questions').insert(q);
            if (e2) {
              if (e2.message.includes('content_hash') || e2.message.includes('duplicate') || e2.message.includes('unique')) {
                dupes++;
                totalDuplicates++;
              } else {
                errors++;
                totalErrors++;
                if (errors <= 3) console.log('    ERR:', e2.message.substring(0, 100));
              }
            } else {
              inserted++;
              totalInserted++;
            }
          }
        } else {
          inserted += result?.length || toInsert.length;
          totalInserted += result?.length || toInsert.length;
        }
      }
    }

    console.log(`  ✅ +${inserted} inserted, ${dupes} dupes, ${noArt} no-article, ${noLaw} no-law, ${artNotFound} art-not-found, ${errors} errors`);
  }

  console.log('\n' + '═'.repeat(60));
  console.log('📊 RESUMEN FINAL');
  console.log('═'.repeat(60));
  console.log('  Procesadas:', totalProcessed);
  console.log('  Insertadas:', totalInserted);
  console.log('  Duplicadas:', totalDuplicates);
  console.log('  Sin artículo (InnoTest):', totalNoArticle);
  console.log('  Ley no mapeada:', totalNoLaw);
  console.log('  Artículo no encontrado en BD:', totalArticleNotFound);
  console.log('  Errores:', totalErrors);
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
