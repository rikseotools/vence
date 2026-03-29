/**
 * Revisar preguntas de similitud alta/media contra la BD
 * Muestra las comparaciones para decidir: DUPLICADO o NUEVA
 *
 * Uso: node scripts/review-similar-cyl.cjs
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });
const { createClient } = require(path.join(__dirname, '..', 'node_modules', '@supabase', 'supabase-js'));

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const OUTPUT_DIR = path.join(__dirname, '..', 'preguntas-para-subir', 'auxiliar-cyl');
const REPORT_FILE = path.join(OUTPUT_DIR, 'duplicates-report.json');
const REVIEW_OUTPUT = path.join(OUTPUT_DIR, 'similar-review.json');

(async () => {
  const report = JSON.parse(fs.readFileSync(REPORT_FILE, 'utf-8'));
  const toReview = [...report.high, ...report.medium];
  console.log(`📋 Preguntas a revisar: ${toReview.length} (${report.high.length} alta + ${report.medium.length} media)\n`);

  // Cargar preguntas scrapeadas
  const scrapedMap = new Map();
  const dirs = fs.readdirSync(OUTPUT_DIR).filter(d => d.startsWith('Tema_'));
  for (const dir of dirs) {
    const files = fs.readdirSync(path.join(OUTPUT_DIR, dir)).filter(f => f.endsWith('.json'));
    for (const f of files) {
      const data = JSON.parse(fs.readFileSync(path.join(OUTPUT_DIR, dir, f), 'utf-8'));
      for (const q of data.questions) {
        scrapedMap.set(q.id, { ...q, tema: parseInt(dir.split('_')[1]) });
      }
    }
  }

  // Cargar preguntas de BD referenciadas
  const dbIds = [...new Set(toReview.map(r => r.dbId))];
  console.log(`📥 Cargando ${dbIds.length} preguntas de BD para comparar...`);

  const dbMap = new Map();
  for (let i = 0; i < dbIds.length; i += 50) {
    const batch = dbIds.slice(i, i + 50);
    const { data, error } = await sb.from('questions')
      .select('id, question_text, option_a, option_b, option_c, option_d, correct_option')
      .in('id', batch);
    if (error) console.error('DB error:', error.message);
    if (data) data.forEach(q => dbMap.set(q.id, q));
  }
  console.log(`  ${dbMap.size} preguntas de BD cargadas`);

  // Comparar cada par
  const results = [];
  let skipped = 0;

  for (const r of toReview) {
    const scraped = scrapedMap.get(r.id);
    const db = dbMap.get(r.dbId);
    if (!scraped || !db) { skipped++; continue; }

    const scrapedOpts = scraped.options.map(o => o.text).sort();
    const dbOpts = [db.option_a, db.option_b, db.option_c, db.option_d].sort();

    // Compare sorted options
    const optionsMatch = scrapedOpts.join('|||') === dbOpts.join('|||');

    // Same concept check: if options are very similar, likely duplicate
    const optOverlap = scrapedOpts.filter(so => dbOpts.some(dbo => {
      const norm = t => (t || '').toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
      return norm(so) === norm(dbo);
    })).length;

    let verdict;
    if (optionsMatch) {
      verdict = 'DUPLICATE'; // Same options = definitely duplicate
    } else if (optOverlap >= 3) {
      verdict = 'LIKELY_DUPLICATE'; // 3+ matching options
    } else if (r.similarity >= 85 && optOverlap >= 2) {
      verdict = 'LIKELY_DUPLICATE';
    } else {
      verdict = 'LIKELY_NEW'; // Different options = likely new question
    }

    results.push({
      scrapedId: r.id,
      dbId: r.dbId,
      tema: r.tema,
      similarity: r.similarity,
      level: r.level,
      optionsMatch,
      optOverlap,
      verdict,
      scraped: {
        question: scraped.question,
        options: scraped.options.map(o => o.text),
        correctAnswer: scraped.correctAnswer
      },
      db: {
        question: db.question_text,
        options: [db.option_a, db.option_b, db.option_c, db.option_d],
        correctOption: db.correct_option
      }
    });
  }

  // Save full review
  fs.writeFileSync(REVIEW_OUTPUT, JSON.stringify(results, null, 2));

  // Summary
  const duplicates = results.filter(r => r.verdict === 'DUPLICATE');
  const likelyDup = results.filter(r => r.verdict === 'LIKELY_DUPLICATE');
  const likelyNew = results.filter(r => r.verdict === 'LIKELY_NEW');

  console.log('\n═══════════════════════════════════════');
  console.log('       RESULTADO REVISIÓN SIMILARES');
  console.log('═══════════════════════════════════════\n');
  console.log(`DUPLICATE (mismas opciones):        ${duplicates.length} → descartar`);
  console.log(`LIKELY_DUPLICATE (3+ opts iguales):  ${likelyDup.length} → descartar`);
  console.log(`LIKELY_NEW (opciones diferentes):    ${likelyNew.length} → importar`);
  console.log(`\nTotal revisadas: ${results.length}`);

  // Desglose por tema de las LIKELY_NEW
  console.log('\n── Preguntas rescatadas por tema ──');
  const temaNew = {};
  for (const r of likelyNew) {
    temaNew[r.tema] = (temaNew[r.tema] || 0) + 1;
  }
  for (const [t, c] of Object.entries(temaNew).sort((a, b) => parseInt(a[0]) - parseInt(b[0]))) {
    console.log(`  T${t}: ${c} nuevas rescatadas`);
  }

  console.log(`\nReporte guardado en: ${REVIEW_OUTPUT}`);

  // Save IDs of likely new for import
  const newIdsToImport = likelyNew.map(r => r.scrapedId);
  fs.writeFileSync(path.join(OUTPUT_DIR, 'similar-new-ids.json'), JSON.stringify(newIdsToImport, null, 2));
  console.log(`IDs nuevas guardadas en: similar-new-ids.json (${newIdsToImport.length} preguntas)`);
})();
