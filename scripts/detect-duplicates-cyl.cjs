/**
 * Detección de duplicados para preguntas scrapeadas de CyL
 * Conforme al manual: importar-preguntas-scrapeadas.md
 *
 * Niveles:
 *   0. Opciones barajadas (mismas opciones en distinto orden)
 *   1. Exacto normalizado
 *   2. Similitud alta (>=80% Jaccard)
 *   3. Similitud media (60-80% Jaccard)
 *
 * Compara contra TODA la BD (activas + inactivas)
 *
 * Uso: node scripts/detect-duplicates-cyl.cjs
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });
const { createClient } = require(path.join(__dirname, '..', 'node_modules', '@supabase', 'supabase-js'));

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const OUTPUT_DIR = path.join(__dirname, '..', 'preguntas-para-subir', 'auxiliar-cyl');
const REPORT_FILE = path.join(OUTPUT_DIR, 'duplicates-report.json');

// ─── Normalización y similitud ───

function normalize(text) {
  return (text || '').toLowerCase()
    .replace(/[áàâä]/g, 'a').replace(/[éèêë]/g, 'e').replace(/[íìîï]/g, 'i')
    .replace(/[óòôö]/g, 'o').replace(/[úùûü]/g, 'u').replace(/ñ/g, 'n')
    .replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
}

function normalizeOptions(opts) {
  return opts.map(o => normalize(o)).sort().join('|||');
}

function jaccard(a, b) {
  const wa = new Set(a.split(' ').filter(w => w.length > 2));
  const wb = new Set(b.split(' ').filter(w => w.length > 2));
  if (wa.size === 0 && wb.size === 0) return 1;
  let intersection = 0;
  for (const w of wa) if (wb.has(w)) intersection++;
  const union = new Set([...wa, ...wb]).size;
  return union === 0 ? 0 : intersection / union;
}

// ─── Cargar preguntas de BD ───

async function loadDbQuestions() {
  console.log('📥 Cargando preguntas de BD...');
  const allQ = [];
  let page = 0;
  while (true) {
    const { data } = await sb.from('questions')
      .select('id, question_text, option_a, option_b, option_c, option_d')
      .range(page * 1000, (page + 1) * 1000 - 1);
    if (!data || data.length === 0) break;
    allQ.push(...data);
    page++;
    if (data.length < 1000) break;
  }
  console.log(`  ${allQ.length} preguntas cargadas de BD`);
  return allQ;
}

// ─── Cargar preguntas scrapeadas ───

function loadScrapedQuestions() {
  console.log('📥 Cargando preguntas scrapeadas...');
  const all = [];
  const dirs = fs.readdirSync(OUTPUT_DIR).filter(d => d.startsWith('Tema_'));

  for (const dir of dirs) {
    const tema = parseInt(dir.split('_')[1]);
    const files = fs.readdirSync(path.join(OUTPUT_DIR, dir)).filter(f => f.endsWith('.json'));
    for (const f of files) {
      const data = JSON.parse(fs.readFileSync(path.join(OUTPUT_DIR, dir, f), 'utf-8'));
      for (const q of data.questions) {
        all.push({
          id: q.id,
          tema,
          question: q.question,
          options: q.options.map(o => o.text),
          correctAnswer: q.correctAnswer,
          explanation: q.explanation || ''
        });
      }
    }
  }

  console.log(`  ${all.length} preguntas scrapeadas de ${dirs.length} temas`);
  return all;
}

// ─── Detección ───

function detectDuplicates(scraped, dbQuestions) {
  console.log('\n🔍 Detectando duplicados...\n');

  // Preparar índices de BD
  const dbNormSet = new Map(); // normalized text → db question id
  const dbNormOptionsSet = new Map(); // normalized text + sorted options → db question id
  const dbNormList = []; // for Jaccard comparison

  for (const q of dbQuestions) {
    const norm = normalize(q.question_text);
    dbNormSet.set(norm, q.id);

    const normOpts = normalizeOptions([q.option_a, q.option_b, q.option_c, q.option_d]);
    const key = norm + '###' + normOpts;
    dbNormOptionsSet.set(key, q.id);

    dbNormList.push({ id: q.id, norm, normOpts });
  }

  // Also deduplicate within scraped (intra-scrape duplicates)
  const scrapedSeen = new Map(); // norm+options → first scraped question
  const intraDuplicates = [];

  const results = {
    shuffled: [],    // Nivel 0: mismas opciones barajadas
    exact: [],       // Nivel 1: texto exacto normalizado
    high: [],        // Nivel 2: >=80% Jaccard
    medium: [],      // Nivel 3: 60-80% Jaccard
    new: [],         // <60% Jaccard = nueva
    intraDuplicates: [] // duplicados dentro del scraping
  };

  let processed = 0;

  for (const sq of scraped) {
    processed++;
    if (processed % 500 === 0) console.log(`  Procesadas ${processed}/${scraped.length}...`);

    const normQ = normalize(sq.question);
    const normOpts = normalizeOptions(sq.options);
    const fullKey = normQ + '###' + normOpts;

    // Intra-scrape dedup
    if (scrapedSeen.has(fullKey)) {
      intraDuplicates.push({ scraped: sq, duplicateOf: scrapedSeen.get(fullKey) });
      results.intraDuplicates.push({
        id: sq.id, tema: sq.tema,
        question: sq.question.substring(0, 80),
        duplicateOfId: scrapedSeen.get(fullKey).id
      });
      continue;
    }
    scrapedSeen.set(fullKey, sq);

    // Nivel 0: Opciones barajadas (misma pregunta + mismas opciones en cualquier orden)
    let found = false;
    for (const db of dbNormList) {
      if (db.norm === normQ && db.normOpts === normOpts) {
        results.shuffled.push({
          id: sq.id, tema: sq.tema,
          question: sq.question.substring(0, 80),
          dbId: db.id, level: 'shuffled'
        });
        found = true;
        break;
      }
    }
    if (found) continue;

    // Nivel 1: Texto exacto normalizado
    if (dbNormSet.has(normQ)) {
      // Verificar si opciones también coinciden (legislativa: mismo enunciado + opciones distintas = nueva)
      const dbId = dbNormSet.get(normQ);
      const dbQ = dbNormList.find(d => d.id === dbId);
      if (dbQ && dbQ.normOpts === normOpts) {
        results.exact.push({
          id: sq.id, tema: sq.tema,
          question: sq.question.substring(0, 80),
          dbId, level: 'exact'
        });
        continue;
      }
      // Mismo enunciado pero opciones distintas → podría ser nueva (legislativa)
      // Aún así marcar como exact si las opciones son muy similares
      if (dbQ) {
        const optSim = jaccard(dbQ.normOpts.replace(/\|\|\|/g, ' '), normOpts.replace(/\|\|\|/g, ' '));
        if (optSim >= 0.7) {
          results.exact.push({
            id: sq.id, tema: sq.tema,
            question: sq.question.substring(0, 80),
            dbId, level: 'exact_similar_opts', optSimilarity: Math.round(optSim * 100)
          });
          continue;
        }
      }
    }

    // Nivel 2 y 3: Similitud Jaccard
    let bestMatch = null;
    let bestSim = 0;

    for (const db of dbNormList) {
      // Quick filter: skip if lengths differ too much
      if (Math.abs(db.norm.length - normQ.length) > normQ.length * 0.6) continue;

      const sim = jaccard(normQ, db.norm);
      if (sim > bestSim) {
        bestSim = sim;
        bestMatch = db;
      }
    }

    if (bestSim >= 0.8) {
      results.high.push({
        id: sq.id, tema: sq.tema,
        question: sq.question.substring(0, 80),
        dbId: bestMatch.id, similarity: Math.round(bestSim * 100),
        level: 'high'
      });
    } else if (bestSim >= 0.6) {
      results.medium.push({
        id: sq.id, tema: sq.tema,
        question: sq.question.substring(0, 80),
        dbId: bestMatch.id, similarity: Math.round(bestSim * 100),
        level: 'medium'
      });
    } else {
      results.new.push({
        id: sq.id, tema: sq.tema,
        question: sq.question.substring(0, 80),
        level: 'new', bestSimilarity: Math.round(bestSim * 100)
      });
    }
  }

  return results;
}

// ─── Main ───

(async () => {
  const dbQuestions = await loadDbQuestions();
  const scraped = loadScrapedQuestions();

  const results = detectDuplicates(scraped, dbQuestions);

  // Guardar reporte
  fs.writeFileSync(REPORT_FILE, JSON.stringify(results, null, 2));

  // Resumen
  console.log('\n═══════════════════════════════════════');
  console.log('          REPORTE DE DUPLICADOS');
  console.log('═══════════════════════════════════════\n');
  console.log(`Preguntas scrapeadas:     ${scraped.length}`);
  console.log(`Preguntas en BD:          ${dbQuestions.length}`);
  console.log('');
  console.log(`Intra-scrape duplicados:  ${results.intraDuplicates.length} (duplicados dentro del scraping)`);
  console.log(`Nivel 0 - Barajadas:      ${results.shuffled.length} (descartar)`);
  console.log(`Nivel 1 - Exactas:        ${results.exact.length} (descartar)`);
  console.log(`Nivel 2 - Alta (>=80%):   ${results.high.length} (revisar rápido)`);
  console.log(`Nivel 3 - Media (60-80%): ${results.medium.length} (revisar manual)`);
  console.log(`Nuevas (<60%):            ${results.new.length} (importar)`);
  console.log('');

  const totalDup = results.intraDuplicates.length + results.shuffled.length + results.exact.length;
  const toReview = results.high.length + results.medium.length;
  console.log(`Total duplicados seguros: ${totalDup}`);
  console.log(`Por revisar:              ${toReview}`);
  console.log(`Nuevas seguras:           ${results.new.length}`);
  console.log(`\nReporte guardado en: ${REPORT_FILE}`);

  // Desglose por tema
  console.log('\n── Desglose por tema ──');
  const temaStats = {};
  for (const r of [...results.shuffled, ...results.exact, ...results.high, ...results.medium, ...results.new, ...results.intraDuplicates]) {
    if (!temaStats[r.tema]) temaStats[r.tema] = { shuffled: 0, exact: 0, high: 0, medium: 0, new: 0, intra: 0 };
    if (results.intraDuplicates.includes(r)) temaStats[r.tema].intra++;
    else if (r.level === 'shuffled') temaStats[r.tema].shuffled++;
    else if (r.level === 'exact' || r.level === 'exact_similar_opts') temaStats[r.tema].exact++;
    else if (r.level === 'high') temaStats[r.tema].high++;
    else if (r.level === 'medium') temaStats[r.tema].medium++;
    else if (r.level === 'new') temaStats[r.tema].new++;
  }

  console.log('Tema | Baraj | Exact | Alta | Media | Nuevas | Intra');
  for (const t of Object.keys(temaStats).sort((a, b) => parseInt(a) - parseInt(b))) {
    const s = temaStats[t];
    console.log(`T${t.padStart(2)}  |  ${String(s.shuffled).padStart(3)}  |  ${String(s.exact).padStart(3)}  | ${String(s.high).padStart(3)}  |  ${String(s.medium).padStart(3)}  |   ${String(s.new).padStart(3)}  |  ${String(s.intra).padStart(3)}`);
  }
})();
