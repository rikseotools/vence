// Importar preguntas Tema 1 Tramitación Procesal con artículos verificados por IA
// Las preguntas ya tienen verified_article_id asignado

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const TOPIC_ID = 'a6351c86-dd4d-4a51-a615-8daf3ae07682'; // Tema 1 TP
const LETTER_TO_INDEX = { 'A': 0, 'B': 1, 'C': 2, 'D': 3 };

// Normalizar confianza (algunos agentes usaron español, otros inglés)
function normalizeConfidence(conf) {
  const map = {
    'alta': 'high', 'high': 'high',
    'media': 'medium', 'medium': 'medium',
    'baja': 'low', 'low': 'low'
  };
  return map[conf?.toLowerCase()] || 'unknown';
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
  console.log('IMPORTAR TEMA 1 - TRAMITACIÓN PROCESAL');
  console.log('(Con artículos verificados por IA)');
  console.log('='.repeat(60));
  if (dryRun) console.log('🔍 MODO DRY-RUN (no se insertarán datos)\n');

  // Cargar preguntas verificadas (fusionadas con datos originales)
  const mergedPath = '/tmp/tema1-all-merged.json';
  if (!fs.existsSync(mergedPath)) {
    console.error('❌ No se encontró el archivo de preguntas fusionadas');
    console.error('   Ejecuta primero el proceso de verificación con IA y fusión');
    process.exit(1);
  }

  const questions = JSON.parse(fs.readFileSync(mergedPath, 'utf8'));
  console.log(`📚 ${questions.length} preguntas cargadas\n`);

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
      tags: ['Tema 1', q.subtema || 'Constitución Española', 'Tramitación Procesal', 'IA-Verified']
    };

    if (dryRun) {
      if (verbose) console.log(`  ✓ ${q.verified_law} Art.${q.verified_article_number}: ${q.question.substring(0, 40)}...`);
      stats.imported++;
      stats.byLaw[q.verified_law] = (stats.byLaw[q.verified_law] || 0) + 1;
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
        stats.byLaw[q.verified_law] = (stats.byLaw[q.verified_law] || 0) + 1;
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
    console.log('\n❌ ERRORES (primeros 10):');
    stats.errors.slice(0, 10).forEach(e => {
      console.log(`   - ${e.reason}: ${e.question}...`);
    });
    fs.writeFileSync('/tmp/tema1-import-errors.json', JSON.stringify(stats.errors, null, 2));
    console.log('\n💾 Errores guardados en /tmp/tema1-import-errors.json');
  }

  if (dryRun) {
    console.log('\n⚠️  MODO DRY-RUN: No se insertó nada. Ejecuta sin --dry-run para importar.');
  }
}

main().catch(console.error);
