#!/usr/bin/env node
/**
 * Script para corregir correct_answer en test_questions
 *
 * Bug: /api/exam/init guardaba 'a' como fallback cuando correct_option no estaba disponible
 * Este script:
 * 1. Encuentra registros en test_questions con correct_answer incorrecto
 * 2. Obtiene el correct_option real de la tabla questions
 * 3. Actualiza correct_answer y recalcula is_correct
 * 4. Actualiza el score en tests
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function fixExamCorrectAnswers(dryRun = true) {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🔧 SCRIPT: Corrección de correct_answer en test_questions');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`Modo: ${dryRun ? '🔍 DRY RUN (sin cambios)' : '⚠️  EJECUCIÓN REAL'}`);
  console.log('');

  // 1. Obtener todos los test_questions con question_id válido (paginando para obtener todos)
  console.log('📊 Paso 1: Obteniendo registros de test_questions...');

  let testQuestions = [];
  let hasMore = true;
  let offset = 0;
  const pageSize = 1000;

  while (hasMore) {
    const { data, error: tqError } = await supabase
      .from('test_questions')
      .select('id, test_id, question_id, question_order, user_answer, correct_answer, is_correct')
      .not('question_id', 'is', null)
      .order('created_at', { ascending: false })
      .range(offset, offset + pageSize - 1);

    if (tqError) {
      console.error('❌ Error obteniendo test_questions:', tqError);
      return;
    }

    testQuestions = testQuestions.concat(data || []);
    console.log(`   Página ${Math.floor(offset/pageSize) + 1}: ${data?.length || 0} registros`);

    hasMore = data && data.length === pageSize;
    offset += pageSize;
  }

  console.log(`   Encontrados: ${testQuestions.length} registros con question_id`);

  // 2. Obtener IDs únicos de preguntas
  const questionIds = [...new Set(testQuestions.map(tq => tq.question_id).filter(Boolean))];
  console.log(`   Preguntas únicas: ${questionIds.length}`);
  console.log('');

  // 3. Obtener correct_option de la tabla questions (en batches para evitar límite de URL)
  console.log('📊 Paso 2: Obteniendo respuestas correctas de BD...');

  const correctAnswerMap = new Map();
  const batchSizeQuery = 200; // Supabase tiene límite en URLs largas

  for (let i = 0; i < questionIds.length; i += batchSizeQuery) {
    const batch = questionIds.slice(i, i + batchSizeQuery);

    const { data: questions, error: qError } = await supabase
      .from('questions')
      .select('id, correct_option')
      .in('id', batch);

    if (qError) {
      console.error(`❌ Error obteniendo questions batch ${i}:`, qError);
      continue;
    }

    for (const q of questions) {
      const letter = String.fromCharCode(97 + q.correct_option); // 0=a, 1=b, 2=c, 3=d
      correctAnswerMap.set(q.id, letter);
    }

    console.log(`   Batch ${Math.floor(i/batchSizeQuery) + 1}: ${questions?.length || 0} preguntas`);
  }

  console.log(`   Respuestas correctas obtenidas: ${correctAnswerMap.size}`);
  console.log('');

  // 4. Identificar registros que necesitan corrección
  console.log('📊 Paso 3: Identificando registros a corregir...');

  const toFix = [];
  const stats = {
    total: testQuestions.length,
    correct: 0,
    incorrect: 0,
    missingQuestion: 0,
    alreadyCorrect: 0
  };

  for (const tq of testQuestions) {
    const realCorrect = correctAnswerMap.get(tq.question_id);

    if (!realCorrect) {
      stats.missingQuestion++;
      continue;
    }

    const currentCorrect = tq.correct_answer?.toLowerCase();
    const userAnswer = tq.user_answer?.toLowerCase();

    // Verificar si el correct_answer guardado es diferente al real
    if (currentCorrect !== realCorrect) {
      const shouldBeCorrect = userAnswer === realCorrect;

      toFix.push({
        id: tq.id,
        testId: tq.test_id,
        questionOrder: tq.question_order,
        userAnswer: userAnswer,
        oldCorrectAnswer: currentCorrect,
        newCorrectAnswer: realCorrect,
        oldIsCorrect: tq.is_correct,
        newIsCorrect: shouldBeCorrect,
        changed: tq.is_correct !== shouldBeCorrect
      });

      if (tq.is_correct !== shouldBeCorrect) {
        stats.incorrect++;
      }
    } else {
      stats.alreadyCorrect++;
    }
  }

  console.log(`   Registros que necesitan corrección: ${toFix.length}`);
  console.log(`   Registros ya correctos: ${stats.alreadyCorrect}`);
  console.log(`   Preguntas sin match en BD: ${stats.missingQuestion}`);
  console.log('');

  // 5. Mostrar ejemplos de correcciones
  console.log('📋 Ejemplos de correcciones (primeros 10):');
  console.log('─────────────────────────────────────────────────────────');

  for (const fix of toFix.slice(0, 10)) {
    const changeIcon = fix.changed ? '🔄' : '✓';
    const correctIcon = fix.newIsCorrect ? '✅' : '❌';
    console.log(`${changeIcon} Pregunta orden ${fix.questionOrder}:`);
    console.log(`   Usuario: ${fix.userAnswer?.toUpperCase() || '?'} | Correcto: ${fix.oldCorrectAnswer?.toUpperCase()} → ${fix.newCorrectAnswer.toUpperCase()}`);
    console.log(`   is_correct: ${fix.oldIsCorrect} → ${fix.newIsCorrect} ${correctIcon}`);
    console.log('');
  }

  // 6. Agrupar por test_id para actualizar scores
  const testIdsToUpdate = [...new Set(toFix.map(f => f.testId))];
  console.log(`📊 Tests afectados: ${testIdsToUpdate.length}`);
  console.log('');

  if (dryRun) {
    console.log('═══════════════════════════════════════════════════════════');
    console.log('🔍 DRY RUN COMPLETADO - No se realizaron cambios');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('');
    console.log('Para ejecutar los cambios, usa:');
    console.log('  node scripts/fix-exam-correct-answers.cjs --execute');
    return { toFix, testIdsToUpdate, stats };
  }

  // 7. EJECUTAR CORRECCIONES
  console.log('═══════════════════════════════════════════════════════════');
  console.log('⚠️  EJECUTANDO CORRECCIONES...');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');

  let updatedCount = 0;
  let errorCount = 0;

  // Actualizar en batches de 100
  const batchSize = 100;
  for (let i = 0; i < toFix.length; i += batchSize) {
    const batch = toFix.slice(i, i + batchSize);

    for (const fix of batch) {
      const { error } = await supabase
        .from('test_questions')
        .update({
          correct_answer: fix.newCorrectAnswer,
          is_correct: fix.newIsCorrect
        })
        .eq('id', fix.id);

      if (error) {
        console.error(`❌ Error actualizando ${fix.id}:`, error);
        errorCount++;
      } else {
        updatedCount++;
      }
    }

    console.log(`   Procesados: ${Math.min(i + batchSize, toFix.length)}/${toFix.length}`);
  }

  console.log('');
  console.log(`✅ Registros actualizados: ${updatedCount}`);
  console.log(`❌ Errores: ${errorCount}`);
  console.log('');

  // 8. Recalcular scores de tests
  console.log('📊 Paso 4: Recalculando scores de tests...');

  let scoresUpdated = 0;
  for (const testId of testIdsToUpdate) {
    // Contar correctas
    const { count, error: countError } = await supabase
      .from('test_questions')
      .select('*', { count: 'exact', head: true })
      .eq('test_id', testId)
      .eq('is_correct', true);

    if (countError) {
      console.error(`❌ Error contando correctas para test ${testId}:`, countError);
      continue;
    }

    // Actualizar score
    const { error: updateError } = await supabase
      .from('tests')
      .update({ score: count })
      .eq('id', testId);

    if (updateError) {
      console.error(`❌ Error actualizando score para test ${testId}:`, updateError);
    } else {
      scoresUpdated++;
    }
  }

  console.log(`✅ Scores de tests actualizados: ${scoresUpdated}/${testIdsToUpdate.length}`);
  console.log('');

  console.log('═══════════════════════════════════════════════════════════');
  console.log('✅ CORRECCIÓN COMPLETADA');
  console.log('═══════════════════════════════════════════════════════════');

  return { toFix, testIdsToUpdate, stats, updatedCount, scoresUpdated };
}

// Verificar un usuario específico
async function verifyUser(userId) {
  console.log('');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`🔍 Verificando usuario: ${userId}`);
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');

  // Obtener tests del usuario
  const { data: tests, error: testError } = await supabase
    .from('tests')
    .select('id, score, total_questions, created_at, is_completed')
    .eq('user_id', userId)
    .eq('is_completed', true)
    .order('created_at', { ascending: false })
    .limit(5);

  if (testError) {
    console.error('❌ Error:', testError);
    return;
  }

  for (const test of tests) {
    // Obtener respuestas
    const { data: answers, error: ansError } = await supabase
      .from('test_questions')
      .select('question_order, user_answer, correct_answer, is_correct')
      .eq('test_id', test.id)
      .order('question_order', { ascending: true });

    if (ansError) continue;

    const correctas = answers.filter(a => a.is_correct).length;
    const scoreMatch = correctas === parseInt(test.score);

    console.log(`📋 Test ${new Date(test.created_at).toLocaleString('es-ES')}:`);
    console.log(`   Score en tests: ${test.score}/${test.total_questions}`);
    console.log(`   Correctas en test_questions: ${correctas}/${answers.length}`);
    console.log(`   ${scoreMatch ? '✅ Coincide' : '❌ NO COINCIDE'}`);

    // Mostrar algunas respuestas
    console.log('   Primeras 5 respuestas:');
    for (const a of answers.slice(0, 5)) {
      console.log(`     ${a.is_correct ? '✅' : '❌'} Q${a.question_order}: usuario=${a.user_answer?.toUpperCase()} correcta=${a.correct_answer?.toUpperCase()}`);
    }
    console.log('');
  }
}

// Main
async function main() {
  const args = process.argv.slice(2);
  const execute = args.includes('--execute');
  const verifyUserId = args.find(a => a.startsWith('--verify='))?.split('=')[1];

  if (verifyUserId) {
    await verifyUser(verifyUserId);
  } else {
    await fixExamCorrectAnswers(!execute);
  }
}

main().catch(console.error);
