// Importar preguntas Tema 2 Tramitación Procesal con artículos verificados por IA
// Tema 2: Igualdad efectiva y no discriminación
// Leyes: LO 3/2007, LO 1/2004, Ley 15/2022, Ley 4/2023

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const TOPIC_ID = '06c477d8-ba1d-46be-81ac-8ad0b6e57380'; // Tema 2 TP (Igualdad)
const LETTER_TO_INDEX = { 'A': 0, 'B': 1, 'C': 2, 'D': 3 };

function normalizeConfidence(conf) {
  if (!conf || typeof conf !== 'string') return 'unknown';
  const map = {
    'alta': 'high', 'high': 'high',
    'media': 'medium', 'medium': 'medium',
    'baja': 'low', 'low': 'low'
  };
  return map[conf.toLowerCase()] || 'unknown';
}

function consolidateBatches() {
  const allQuestions = [];
  for (let i = 1; i <= 11; i++) {
    const path = `/tmp/tema2-batch-${i}-verified.json`;
    if (fs.existsSync(path)) {
      const batch = JSON.parse(fs.readFileSync(path, 'utf8'));
      allQuestions.push(...batch);
      console.log(`  📁 Batch ${i}: ${batch.length} preguntas`);
    } else {
      console.log(`  ⚠️  Batch ${i} no encontrado`);
    }
  }
  return allQuestions;
}

async function questionExists(questionText) {
  const { data } = await supabase
    .from('questions')
    .select('id')
    .eq('question_text', questionText)
    .single();
  return data?.id || null;
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const verbose = args.includes('--verbose');
  const limit = args.find(a => a.startsWith('--limit='));
  const maxQuestions = limit ? parseInt(limit.split('=')[1]) : Infinity;

  console.log('='.repeat(60));
  console.log('IMPORTAR TEMA 2 - TRAMITACIÓN PROCESAL');
  console.log('Igualdad efectiva y no discriminación');
  console.log('='.repeat(60));
  if (dryRun) console.log('🔍 MODO DRY-RUN (no se insertarán datos)\n');

  console.log('📦 Consolidando batches verificados...');
  const questions = consolidateBatches();
  console.log(`\n📚 ${questions.length} preguntas totales\n`);

  // Guardar consolidado
  fs.writeFileSync('/tmp/tema2-all-merged.json', JSON.stringify(questions, null, 2));
  console.log('💾 Consolidado guardado en /tmp/tema2-all-merged.json\n');

  const stats = {
    total: 0,
    imported: 0,
    duplicates: 0,
    noArticle: 0,
    errors: [],
    byLaw: {},
    byConfidence: {}
  };

  for (const q of questions) {
    if (stats.total >= maxQuestions) break;
    stats.total++;

    // Verificar si tiene artículo
    if (!q.verified_article_id) {
      stats.noArticle++;
      if (verbose) console.log(`  ⏭️  Sin artículo: ${q.question.substring(0, 40)}...`);
      continue;
    }

    // Verificar duplicado
    const existingId = await questionExists(q.question);
    if (existingId) {
      stats.duplicates++;
      if (verbose) console.log(`  ⏭️  Duplicada: ${q.question.substring(0, 40)}...`);
      continue;
    }

    // Preparar datos
    const questionData = {
      question_text: q.question,
      option_a: q.options.find(o => o.letter === 'A')?.text || '',
      option_b: q.options.find(o => o.letter === 'B')?.text || '',
      option_c: q.options.find(o => o.letter === 'C')?.text || '',
      option_d: q.options.find(o => o.letter === 'D')?.text || '',
      correct_option: LETTER_TO_INDEX[q.correctAnswer],
      explanation: q.explanation || '',
      primary_article_id: q.verified_article_id,
      difficulty: 'medium',
      is_active: true,
      is_official_exam: false,
      tags: ['Tema 2', q.subtema || 'Igualdad', 'Tramitación Procesal', 'IA-Verified']
    };

    if (dryRun) {
      if (verbose) console.log(`  ✓ ${q.verified_law} Art.${q.verified_article_number}: ${q.question.substring(0, 40)}...`);
      stats.imported++;
      stats.byLaw[q.verified_law || 'Sin ley'] = (stats.byLaw[q.verified_law || 'Sin ley'] || 0) + 1;
      const normConf = normalizeConfidence(q.ai_confidence);
      stats.byConfidence[normConf] = (stats.byConfidence[normConf] || 0) + 1;
    } else {
      const { error } = await supabase.from('questions').insert(questionData);
      if (error) {
        if (error.message.includes('duplicate')) {
          stats.duplicates++;
        } else {
          stats.errors.push({
            question: q.question.substring(0, 50),
            reason: error.message
          });
        }
      } else {
        stats.imported++;
        stats.byLaw[q.verified_law || 'Sin ley'] = (stats.byLaw[q.verified_law || 'Sin ley'] || 0) + 1;
        const normConf = normalizeConfidence(q.ai_confidence);
        stats.byConfidence[normConf] = (stats.byConfidence[normConf] || 0) + 1;
        if (verbose) console.log(`  ✅ ${q.verified_law} Art.${q.verified_article_number}: ${q.question.substring(0, 40)}...`);
      }
    }
  }

  // Resumen
  console.log('\n' + '='.repeat(60));
  console.log('📊 RESUMEN');
  console.log('='.repeat(60));
  console.log(`Total procesadas: ${stats.total}`);
  console.log(`✅ Importadas: ${stats.imported}`);
  console.log(`⏭️  Duplicadas: ${stats.duplicates}`);
  console.log(`⚠️  Sin artículo: ${stats.noArticle}`);
  console.log(`❌ Errores: ${stats.errors.length}`);

  console.log('\n📈 Por ley:');
  Object.entries(stats.byLaw).sort((a, b) => b[1] - a[1]).forEach(([law, count]) => {
    console.log(`   ${law}: ${count}`);
  });

  console.log('\n🎯 Por confianza IA:');
  Object.entries(stats.byConfidence).forEach(([conf, count]) => {
    console.log(`   ${conf}: ${count}`);
  });

  if (stats.errors.length > 0) {
    console.log('\n❌ ERRORES:');
    stats.errors.forEach(e => {
      console.log(`   - ${e.reason}: ${e.question}...`);
    });
    fs.writeFileSync('/tmp/tema2-import-errors.json', JSON.stringify(stats.errors, null, 2));
  }

  if (dryRun) {
    console.log('\n⚠️  MODO DRY-RUN: Ejecuta sin --dry-run para importar.');
  }
}

main().catch(console.error);
