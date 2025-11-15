// scripts/propose-intelligent-adaptation.js
// Proponer lógica inteligente de adaptación que respete "nunca vistas"

console.log('🧠 PROPUESTA: ADAPTACIÓN INTELIGENTE QUE RESPETA NUNCA VISTAS');
console.log('='.repeat(70));

console.log('\n📋 LÓGICA PROPUESTA:');

console.log('\n1️⃣ AL CARGAR TEST:');
console.log('   • fetchQuestionsByTopicScope obtiene TODAS las preguntas disponibles');
console.log('   • Las clasifica: neverSeen vs answered');
console.log('   • Las sub-clasifica por dificultad: easy/medium/hard');
console.log('   • Pasa TODO el catálogo clasificado a TestLayout');

console.log('\n2️⃣ SELECCIÓN INICIAL:');
console.log('   • Empezar con preguntas nunca vistas de dificultad normal');
console.log('   • adaptiveMode = false inicialmente');

console.log('\n3️⃣ ADAPTACIÓN DINÁMICA (cuando accuracy < 60%):');
console.log(`
   function adaptDifficultyIntelligently() {
     // 🎯 PRIORIDAD 1: Nunca vistas fáciles
     const neverSeenEasy = catalog.neverSeen.filter(q => q.difficulty === 'easy')
     
     if (neverSeenEasy.length >= remainingQuestions) {
       console.log('✅ Suficientes nunca vistas fáciles disponibles')
       return neverSeenEasy.slice(0, remainingQuestions)
     }
     
     // 🎯 PRIORIDAD 2: Nunca vistas medium (mejor que ya vistas)  
     const neverSeenMedium = catalog.neverSeen.filter(q => q.difficulty === 'medium')
     const combined = [...neverSeenEasy, ...neverSeenMedium]
     
     if (combined.length >= remainingQuestions) {
       console.log('✅ Combinando nunca vistas easy + medium')
       return combined.slice(0, remainingQuestions)
     }
     
     // 🎯 PRIORIDAD 3: Solo si no hay suficientes nunca vistas
     const answeredEasy = catalog.answered.filter(q => q.difficulty === 'easy')
     console.log('⚠️ FALLBACK: Incluyendo algunas ya vistas fáciles')
     return [...combined, ...answeredEasy].slice(0, remainingQuestions)
   }
`);

console.log('\n4️⃣ VENTAJAS DE ESTA LÓGICA:');
console.log('   ✅ NUNCA muestra vistas si hay suficientes nunca vistas');
console.log('   ✅ Respeta la priorización inteligente del fetcher');
console.log('   ✅ Adaptación es realmente dinámica');
console.log('   ✅ Mantiene la integridad del aprendizaje');
console.log('   ✅ Solo usa "ya vistas" como último recurso');

console.log('\n' + '='.repeat(70));
console.log('💡 IMPLEMENTACIÓN TÉCNICA:');

console.log('\n📦 ESTRUCTURA DE DATOS:');
console.log(`
   const questionCatalog = {
     neverSeen: {
       easy: [...],
       medium: [...], 
       hard: [...]
     },
     answered: {
       easy: [...],
       medium: [...],
       hard: [...] 
     }
   }
`);

console.log('\n🔄 FLUJO MODIFICADO:');
console.log('   1. fetchQuestionsByTopicScope retorna catálogo clasificado');
console.log('   2. TestLayout inicia con neverSeen.medium');
console.log('   3. Si accuracy < 60%, adapta a neverSeen.easy');
console.log('   4. Solo usa answered.easy si no quedan nunca vistas');

console.log('\n⚡ BENEFICIOS:');
console.log('   • Usuario nunca ve repetidas si hay opciones');
console.log('   • Adaptación real basada en rendimiento'); 
console.log('   • Máximo aprovechamiento del banco de preguntas');
console.log('   • Experiencia de usuario optimizada');

console.log('\n🎯 ¿Te parece la solución correcta?');