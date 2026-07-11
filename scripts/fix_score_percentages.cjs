/**
 * Script para corregir scores que se guardaron como conteo en vez de porcentaje
 *
 * Bug: score = correctCount (ej: 56) en vez de score = percentage (ej: 93%)
 *
 * Uso:
 *   node scripts/fix_score_percentages.cjs --dry-run   # Ver qué se corregiría
 *   node scripts/fix_score_percentages.cjs --fix       # Aplicar correcciones
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('./lib/pg-agnostic-client.cjs');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const isDryRun = process.argv.includes('--dry-run');
const doFix = process.argv.includes('--fix');

if (!isDryRun && !doFix) {
  console.log('Uso:');
  console.log('  node scripts/fix_score_percentages.cjs --dry-run   # Ver qué se corregiría');
  console.log('  node scripts/fix_score_percentages.cjs --fix       # Aplicar correcciones');
  process.exit(1);
}

async function main() {
  console.log(isDryRun ? '🔍 Modo DRY-RUN (no se harán cambios)\n' : '🔧 Modo FIX (aplicando correcciones)\n');

  // 1. Obtener todos los tests completados
  const { data: tests, error: testError } = await supabase
    .from('tests')
    .select('id, user_id, title, score, total_questions, is_completed')
    .eq('is_completed', true)
    .order('completed_at', { ascending: false });

  if (testError) {
    console.error('Error obteniendo tests:', testError);
    return;
  }

  console.log(`Analizando ${tests.length} tests completados...\n`);

  let fixedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  for (const test of tests) {
    // 2. Obtener respuestas de cada test
    const { data: answers, error: ansError } = await supabase
      .from('test_questions')
      .select('is_correct, user_answer')
      .eq('test_id', test.id);

    if (ansError || !answers || answers.length === 0) {
      skippedCount++;
      continue;
    }

    // 3. Calcular estadísticas reales
    const total = answers.length;
    const correct = answers.filter(a => a.is_correct).length;
    const answered = answers.filter(a => a.user_answer && a.user_answer.trim() !== '').length;

    // Calcular porcentaje correcto (sobre total de preguntas)
    const correctPercentage = total > 0 ? Math.round((correct / total) * 100) : 0;
    const currentScore = parseInt(test.score) || 0;

    // 4. Detectar si el score está mal
    // Heurística: si score == correct (conteo) y score != porcentaje, está mal
    const isBuggy = currentScore === correct && currentScore !== correctPercentage && total > 1;

    if (isBuggy) {
      console.log(`❌ Test: ${test.title}`);
      console.log(`   ID: ${test.id}`);
      console.log(`   Correctas: ${correct}/${total}`);
      console.log(`   Score actual: ${currentScore}% (incorrecto - es el conteo)`);
      console.log(`   Score correcto: ${correctPercentage}%`);

      if (doFix) {
        const { error: updateError } = await supabase
          .from('tests')
          .update({ score: correctPercentage.toString() })
          .eq('id', test.id);

        if (updateError) {
          console.log(`   ⚠️ Error actualizando: ${updateError.message}`);
          errorCount++;
        } else {
          console.log(`   ✅ Corregido!`);
          fixedCount++;
        }
      } else {
        fixedCount++;
      }
      console.log('');
    } else {
      skippedCount++;
    }
  }

  console.log('---');
  console.log(`📊 Resumen:`);
  console.log(`   Tests analizados: ${tests.length}`);
  console.log(`   Tests con bug: ${fixedCount}`);
  console.log(`   Tests OK: ${skippedCount}`);
  if (doFix) {
    console.log(`   Errores: ${errorCount}`);
    console.log(`\n✅ Correcciones aplicadas!`);
  } else {
    console.log(`\n💡 Ejecuta con --fix para aplicar correcciones`);
  }
}

main().catch(console.error);
