/**
 * Importar preguntas nuevas de CyL (las clasificadas como "new" en el reporte de duplicados)
 * Todas se insertan DESACTIVADAS conforme al manual.
 *
 * Uso: node scripts/import-cyl-new.cjs
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });
const { createClient } = require(path.join(__dirname, '..', 'node_modules', '@supabase', 'supabase-js'));

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const OUTPUT_DIR = path.join(__dirname, '..', 'preguntas-para-subir', 'auxiliar-cyl');
const REPORT_FILE = path.join(OUTPUT_DIR, 'duplicates-report.json');

// Mapa tema scrapeado → topic_id en BD
const TOPIC_MAP = {
  1:  '1d6a6cca-69ff-43e8-a236-68f9dc62c4fc',
  2:  'e001525b-7c40-498f-9855-555f4a521c29',
  3:  '8a9af80f-583b-4873-81f9-f55194343bab',
  4:  '1f24b56f-733e-4828-addb-abb75341ac5b',
  5:  '1049aaaf-93c8-439d-8f8d-c4fadc2a0811',
  6:  'bd2b3424-e8fd-4143-89c8-73316ab33ae6',
  7:  '9ded3d64-84d7-4965-a2b4-11f493127579',
  8:  'c1168dcc-a053-46fc-80f7-e23a21a1e254',
  9:  'f064cd54-aeaf-43df-8965-8cf86a103b33',
  11: '13c5f613-89a2-4f1e-9d70-385783042b10',
  12: '2d0dbbc9-8d92-431c-867b-ce924b7809c3',
  13: 'da268469-6803-4d85-888a-a1d588d2bceb',
  14: 'f733407a-dd2e-4e88-94d7-a1db32091103',
  15: '12f981d8-4485-46a4-8270-b40b9a6500f8',
  16: 'eba81f9e-6b4f-474f-a492-3144c6befcd2',
  17: 'b5ebea11-bbc0-4e70-825b-243bc4572efd',
  18: '4925e103-7cfa-41f4-a08f-03948ac8693b',
  19: '9ee260eb-7144-4188-93d9-23f7e854d799',
  20: '6b430415-2b8d-4e7d-b7dd-16c7c49f21b8',
  21: '9acf6662-df51-48a3-b71f-f99683fb5291',
  22: '6e413c9b-7b8b-49ee-a388-d69411e43549',
  23: 'e7f8c7b9-9930-4c11-a1be-12b171f6dd36',
  24: '12841bdd-bbf0-4a0e-beb8-48efdcc5af24',
  25: 'cd1107da-a38c-45a3-9953-6ef0c012b17e',
  26: 'ab5ca682-ede2-412d-9e87-629a8fb0e279',
  27: 'f3392598-9b5a-4028-be4d-dee836ff2a05',
  28: 'f51cbf8d-8ba8-4000-9106-4acd7bd9e7cd',
};

const LETTER_TO_NUM = { 'A': 0, 'B': 1, 'C': 2, 'D': 3 };

function generateContentHash(text) {
  const normalized = (text || '').toLowerCase()
    .replace(/[áàâä]/g, 'a').replace(/[éèêë]/g, 'e').replace(/[íìîï]/g, 'i')
    .replace(/[óòôö]/g, 'o').replace(/[úùûü]/g, 'u').replace(/ñ/g, 'n')
    .replace(/\s+/g, ' ').trim();
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

(async () => {
  // Cargar reporte de duplicados
  const report = JSON.parse(fs.readFileSync(REPORT_FILE, 'utf-8'));
  const newIds = new Set(report.new.map(q => q.id));
  console.log(`📋 Preguntas nuevas a importar: ${newIds.size}\n`);

  // Cargar preguntas scrapeadas
  const dirs = fs.readdirSync(OUTPUT_DIR).filter(d => d.startsWith('Tema_'));
  const allScraped = new Map();

  for (const dir of dirs) {
    const tema = parseInt(dir.split('_')[1]);
    const files = fs.readdirSync(path.join(OUTPUT_DIR, dir)).filter(f => f.endsWith('.json'));
    for (const f of files) {
      const data = JSON.parse(fs.readFileSync(path.join(OUTPUT_DIR, dir, f), 'utf-8'));
      for (const q of data.questions) {
        if (newIds.has(q.id)) {
          allScraped.set(q.id, { ...q, tema });
        }
      }
    }
  }

  console.log(`📥 Preguntas encontradas en archivos: ${allScraped.size}`);

  // Insertar en batches de 50
  const questions = [...allScraped.values()];
  let inserted = 0;
  let errors = 0;
  let hashDups = 0;
  const temaStats = {};

  for (let i = 0; i < questions.length; i += 50) {
    const batch = questions.slice(i, i + 50);
    const rows = [];

    for (const q of batch) {
      const correctOption = LETTER_TO_NUM[q.correctAnswer];
      if (correctOption === undefined) { console.error(`❌ Invalid correctAnswer: ${q.correctAnswer}`); errors++; continue; }

      const contentHash = generateContentHash(q.question);

      rows.push({
        question_text: q.question,
        option_a: q.options[0]?.text || '',
        option_b: q.options[1]?.text || '',
        option_c: q.options[2]?.text || '',
        option_d: q.options[3]?.text || '',
        correct_option: correctOption,
        explanation: q.explanation || '',
        primary_article_id: '2536184c-73ed-4568-9ac7-0bbf1da24dcb', // Placeholder: CE Art 0 (se asigna correcto en verificación)
        difficulty: 'medium',
        is_active: false,
        deactivation_reason: 'Pendiente de revisión post-importación',
        topic_review_status: 'pending',
        is_official_exam: false,
        content_hash: contentHash,
        tags: [`Tema ${q.tema}`, q.tema <= 19 ? 'Grupo I' : 'Grupo II', 'CyL'],
      });
    }

    if (rows.length === 0) continue;

    const { data, error } = await sb.from('questions').insert(rows).select('id');

    if (error) {
      if (error.message?.includes('content_hash')) {
        // Hash duplicate - insert one by one to find which
        for (const row of rows) {
          const { data: d, error: e } = await sb.from('questions').insert(row).select('id');
          if (e) {
            if (e.message?.includes('content_hash')) {
              hashDups++;
            } else {
              console.error(`❌ Error: ${e.message?.substring(0, 100)}`);
              errors++;
            }
          } else {
            inserted++;
            temaStats[row.tags[0]] = (temaStats[row.tags[0]] || 0) + 1;
          }
        }
      } else {
        console.error(`❌ Batch error: ${error.message?.substring(0, 200)}`);
        errors += rows.length;
      }
    } else {
      inserted += data.length;
      for (const row of rows) {
        temaStats[row.tags[0]] = (temaStats[row.tags[0]] || 0) + 1;
      }
    }

    if ((i + 50) % 500 === 0 || i + 50 >= questions.length) {
      console.log(`  Procesadas ${Math.min(i + 50, questions.length)}/${questions.length} | Insertadas: ${inserted} | Hash dups: ${hashDups} | Errores: ${errors}`);
    }
  }

  console.log('\n═══════════════════════════════════════');
  console.log('         RESULTADO IMPORTACIÓN');
  console.log('═══════════════════════════════════════\n');
  console.log(`Insertadas correctamente: ${inserted}`);
  console.log(`Duplicados por hash:      ${hashDups}`);
  console.log(`Errores:                  ${errors}`);
  console.log(`Total procesadas:         ${questions.length}`);

  console.log('\n── Por tema ──');
  for (const [tema, count] of Object.entries(temaStats).sort((a, b) => parseInt(a[0].split(' ')[1]) - parseInt(b[0].split(' ')[1]))) {
    console.log(`  ${tema}: ${count} insertadas`);
  }
})();
