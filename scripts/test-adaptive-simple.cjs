/**
 * Test simple para verificar si el modo adaptativo funcionaría
 * Simula el flujo exacto de TestLayout.js
 */

console.log('\n🧪 TEST: Modo Adaptativo Simple\n');
console.log('='.repeat(80));

// Simular estado inicial
let adaptiveMode = false;  // ❌ Esto es FALSE porque no hay catálogo
let adaptiveCatalog = null;
let answeredQuestions = [];
let currentQuestion = 0;

console.log('\n📋 ESTADO INICIAL:');
console.log(`   adaptiveMode: ${adaptiveMode}`);
console.log(`   adaptiveCatalog: ${adaptiveCatalog}`);

// Simular respuestas de usuario (5 incorrectas de 6)
const simulatedAnswers = [
  { correct: false },  // Falla
  { correct: false },  // Falla
  { correct: true },   // Acierta
  { correct: false },  // Falla
  { correct: false },  // Falla
  { correct: false },  // Falla
];

console.log('\n\n🎮 SIMULANDO TEST CON USUARIO FALLANDO...\n');

simulatedAnswers.forEach((answer, index) => {
  answeredQuestions.push(answer);
  currentQuestion = index + 1;

  const totalAnswered = answeredQuestions.length;
  const totalCorrect = answeredQuestions.filter(q => q.correct).length;
  const currentAccuracy = (totalCorrect / totalAnswered) * 100;

  console.log(`Pregunta ${currentQuestion}: ${answer.correct ? '✅ Correcta' : '❌ Incorrecta'}`);
  console.log(`   Accuracy actual: ${currentAccuracy.toFixed(1)}% (${totalCorrect}/${totalAnswered})`);

  // ==========================================
  // ESTA ES LA LÓGICA EXACTA DE TestLayout.js líneas 440-463
  // ==========================================
  if (adaptiveMode) {
    console.log('   🧠 Evaluando adaptación...');

    if (currentAccuracy < 60 && totalAnswered >= 3) {
      console.log('   ✅ DEBERÍA adaptar a preguntas más fáciles');
      console.log('   ✅ Llamando adaptDifficulty("easier")');

      // Verificar si hay catálogo
      if (!adaptiveCatalog) {
        console.log('   ❌ NO hay catálogo adaptativo');
        console.log('   ❌ adaptDifficultyLegacy() está VACÍO');
        console.log('   ❌ NO SE HACE NADA');
      } else {
        console.log('   ✅ Hay catálogo, cambiando preguntas...');
      }
    } else if (currentAccuracy > 70 && totalAnswered >= 5) {
      console.log('   ✅ DEBERÍA volver a dificultad normal');
    }
  } else {
    console.log('   ⚠️  adaptiveMode = false, NO SE EVALÚA ADAPTACIÓN');
  }

  console.log('');
});

console.log('='.repeat(80));
console.log('\n📊 RESULTADO DEL TEST:\n');

const finalAccuracy = (answeredQuestions.filter(q => q.correct).length / answeredQuestions.length) * 100;

console.log(`Accuracy final: ${finalAccuracy.toFixed(1)}%`);
console.log(`Total respuestas: ${answeredQuestions.length}`);
console.log(`Correctas: ${answeredQuestions.filter(q => q.correct).length}`);
console.log(`Incorrectas: ${answeredQuestions.filter(q => !q.correct).length}`);

console.log('\n\n🔍 DIAGNÓSTICO:\n');

if (finalAccuracy < 60) {
  console.log('❌ Usuario tiene accuracy bajo (<60%)');
  console.log('❌ DEBERÍA haber activado modo adaptativo');
  console.log('');

  if (!adaptiveMode) {
    console.log('🔴 PROBLEMA DETECTADO:');
    console.log('   adaptiveMode = false');
    console.log('   El bloque if (adaptiveMode) NUNCA se ejecutó');
    console.log('   NO se llamó a adaptDifficulty()');
    console.log('   NO se adaptaron las preguntas');
    console.log('');
    console.log('💡 CAUSA:');
    console.log('   Para que adaptiveMode = true, necesita:');
    console.log('   1. questions.isAdaptive = true (NO existe)');
    console.log('   2. questions.adaptiveCatalog (NO existe)');
    console.log('   3. Se genera en fetchQuestionsByTopicScope (NO implementado)');
    console.log('');
    console.log('❌ CONCLUSIÓN: El modo adaptativo NO FUNCIONA');
  } else {
    console.log('✅ adaptiveMode está activo');

    if (!adaptiveCatalog) {
      console.log('⚠️  PERO no hay catálogo adaptativo');
      console.log('   adaptDifficultyLegacy() está VACÍO');
      console.log('   NO se hace adaptación real');
    } else {
      console.log('✅ Catálogo disponible, adaptación funcional');
    }
  }
} else {
  console.log('✅ Usuario tiene buen accuracy, no necesita adaptación');
}

console.log('\n' + '='.repeat(80));
console.log('\n🎯 VERIFICACIÓN CON NUEVA global_difficulty_category:\n');

console.log('Para que funcione con global_difficulty_category:');
console.log('');
console.log('1. ✅ Los filtros ya usan .or() con global_difficulty_category');
console.log('   - Ya implementado en testFetchers.js');
console.log('   - Funciona con fallback a difficulty estática');
console.log('');
console.log('2. ❌ PERO el catálogo adaptativo NO se genera');
console.log('   - fetchQuestionsByTopicScope NO crea el catálogo');
console.log('   - NO clasifica preguntas por global_difficulty_category');
console.log('   - NO separa en neverSeen vs answered');
console.log('');
console.log('3. ❌ Por tanto, adaptDifficulty() NUNCA se llama');
console.log('   - El cambio de dificultad NUNCA ocurre');
console.log('   - El usuario sigue viendo preguntas aleatorias');
console.log('');
console.log('✅ COMPATIBILIDAD: SI se implementara el catálogo,');
console.log('   SÍ funcionaría con global_difficulty_category porque:');
console.log('   - adaptDifficulty() usa targetDifficulty = "easy" | "medium" | "hard"');
console.log('   - Esos valores coinciden con global_difficulty_category');
console.log('   - Los filtros OR ya están implementados');
console.log('');
console.log('❌ ESTADO ACTUAL: NO funciona porque falta el catálogo');

console.log('\n' + '='.repeat(80) + '\n');
