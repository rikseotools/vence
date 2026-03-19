// Script COMPLETO: Recaptura exámenes con epígrafe + explicaciones
// Endpoints:
// - POST /tests {examId, autoStart:true} - Crear test
// - GET /tests/{id}?embedded=questions,responses - Obtener preguntas
// - GET /questions/{id}/reason - Obtener explicación
// - PUT /tests/{id}/discard - Descartar test

const fs = require('fs');
const path = require('path');

const JWT = fs.readFileSync(path.join(__dirname, 'jwt-token.txt'), 'utf-8').trim();
const OUTPUT_DIR = path.join(__dirname, '../preguntas-para-subir/tramitacion-procesal/convocatorias-anteriores');

// TODOS los exámenes (9 convocatorias)
const ALL_EXAMS = [
  { examId: 709137, name: 'Examen_2012_OEP_2011', title: '2012 (OEP 2011)' },
  { examId: 707425, name: 'Examen_Tramitación_Procesal_Turno_Libre,_3_de_Julio_de_2016_(OEP_2015)', title: '2016 (OEP 2015)' },
  { examId: 1143624, name: 'Examen_Tramitación_Procesal_Turno_Libre,_12_de_mayo_de_2018_(OEP_2016)', title: '2018 (OEP 2016)' },
  { examId: 7215420, name: 'Examen_Tramitación_Procesal_Turno_Libre,_2020_(OEP_2017_y_2018)', title: '2020 (OEP 2017-2018)' },
  { examId: 29734933, name: 'Examen_2023_OEP_2020_2021_2022', title: '2023 (OEP 2020-2022)' },
  { examId: 35968319, name: 'Examen_Tramitación_Procesal_Turno_Libre_Estabilización,_2_de_marzo_de_2024_(OEP_', title: '2024 Estabilización (OEP 2021)' },
  { examId: 40195044, name: 'Examen_Tramitación_Procesal_Turno_Libre,_28_de_septiembre_de_2024_(OEP_2023)', title: '2024 (OEP 2023)' },
  { examId: 49485348, name: 'Examen_2025_OEP_2024', title: '2025 (OEP 2024)' },
  { examId: 49481489, name: 'Tercer_Ejercicio_Tramitación_Procesal_turno_libre_(OEP_2024)', title: 'Tercer Ejercicio 2024' }
];

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function createTest(examId) {
  const response = await fetch('https://api.opositatest.com/api/v2.0/tests', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${JWT}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ examId, autoStart: true })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Create test error ${response.status}: ${text.substring(0, 100)}`);
  }

  return response.json();
}

async function getTestQuestions(testId) {
  const response = await fetch(
    `https://api.opositatest.com/api/v2.0/tests/${testId}?embedded=questions,responses`,
    { headers: { 'Authorization': `Bearer ${JWT}` } }
  );

  if (!response.ok) {
    throw new Error(`Get test error ${response.status}`);
  }

  return response.json();
}

async function getExplanation(questionId) {
  try {
    const response = await fetch(
      `https://api.opositatest.com/api/v2.0/questions/${questionId}/reason`,
      { headers: { 'Authorization': `Bearer ${JWT}` } }
    );

    if (!response.ok) {
      return { title: null, content: null };
    }

    return response.json();
  } catch (e) {
    return { title: null, content: null };
  }
}

async function discardTest(testId) {
  await fetch(`https://api.opositatest.com/api/v2.0/tests/${testId}/discard`, {
    method: 'PUT',
    headers: { 'Authorization': `Bearer ${JWT}`, 'Content-Type': 'application/json' }
  });
}

function transformQuestion(q, position, explanation) {
  const answers = q.answers || [];
  const correctIdx = answers.findIndex(a => a.id === q.correctAnswerId);
  const correctLetter = correctIdx >= 0 ? ['A', 'B', 'C', 'D'][correctIdx] : null;
  const correctAnswer = correctIdx >= 0 ? answers[correctIdx].declaration : null;

  return {
    id: q.id,
    position: position,
    question: q.declaration || '',
    organization: q.organization || null,
    options: answers.map(a => ({
      id: a.id,
      text: a.declaration || '',
      isCorrect: a.id === q.correctAnswerId
    })),
    correctAnswerId: q.correctAnswerId || null,
    correctAnswer: correctAnswer,
    correctLetter: correctLetter,
    explanation: explanation?.content || null,
    explanationTitle: explanation?.title || null,
    isAnnulled: q.isAnnulled || false,
    isRepealed: q.isRepealed || false,
    isDeleted: q.isDeleted || false,
    answeredId: q.answeredId || null,
    isDoubtful: q.isDoubtful || false,
    isHighlighted: q.isHighlighted || false,
    image: q.image || null,
    contents: q.contents || [],
    rawAnswers: answers
  };
}

async function processExam(exam) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`📋 ${exam.title}`);
  console.log(`${'='.repeat(60)}`);

  try {
    // 1. Crear test
    console.log('  📝 Creando test...');
    const testData = await createTest(exam.examId);
    const testId = testData.id;
    console.log(`  ✅ Test: ${testId}`);

    // 2. Obtener preguntas
    console.log('  📥 Obteniendo preguntas...');
    const fullTest = await getTestQuestions(testId);
    const rawQuestions = fullTest.questions || [];
    console.log(`  📊 ${rawQuestions.length} preguntas`);

    // 3. Obtener explicaciones (una por una)
    console.log('  📖 Obteniendo explicaciones...');
    const questions = [];
    let withExplanation = 0;

    for (let i = 0; i < rawQuestions.length; i++) {
      const q = rawQuestions[i];

      // Obtener explicación
      const explanation = await getExplanation(q.id);
      if (explanation.content) withExplanation++;

      // Transformar pregunta
      questions.push(transformQuestion(q, i + 1, explanation));

      // Progreso cada 10 preguntas
      if ((i + 1) % 10 === 0) {
        process.stdout.write(`\r  📖 Explicaciones: ${i + 1}/${rawQuestions.length}`);
      }

      // Rate limit
      await sleep(50);
    }
    console.log(`\r  📖 Explicaciones: ${rawQuestions.length}/${rawQuestions.length} (${withExplanation} con contenido)`);

    // 4. Estadísticas
    const hasContents = questions.some(q => q.contents?.[0]?.child);
    const repealedCount = questions.filter(q => q.isRepealed).length;

    console.log(`  📊 Con epígrafe: ${hasContents ? '✅' : '❌'}`);
    console.log(`  📊 Derogadas: ${repealedCount}`);
    console.log(`  📊 Con explicación: ${withExplanation}`);

    // 5. Guardar JSON
    const output = {
      metadata: {
        examId: exam.examId,
        testId: testId,
        title: fullTest.title || exam.title,
        type: 'previousCall'
      },
      testMetadata: {
        oppositionId: fullTest.oppositionId || 7,
        state: fullTest.state,
        createdAt: fullTest.createdAt
      },
      scrapedAt: new Date().toISOString(),
      source: 'opositatest-api-complete-v2',
      oppositionName: 'tramitacion-procesal',
      questionCount: questions.length,
      questions: questions
    };

    const outputPath = path.join(OUTPUT_DIR, `${exam.name}.json`);
    fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
    console.log(`  💾 Guardado: ${exam.name.substring(0, 50)}...`);

    // 6. Descartar test
    console.log('  🗑️  Descartando...');
    await discardTest(testId);
    console.log('  ✅ Completado');

    return { success: true, questions: questions.length, explanations: withExplanation, repealed: repealedCount };

  } catch (error) {
    console.error(`  ❌ Error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function main() {
  console.log('🔄 RECAPTURA COMPLETA: EPÍGRAFES + EXPLICACIONES');
  console.log('='.repeat(60));
  console.log(`Total exámenes: ${ALL_EXAMS.length}`);
  console.log(`Estimado: ~${ALL_EXAMS.length * 100} preguntas, ~${ALL_EXAMS.length * 100 * 0.05}s = ~${Math.round(ALL_EXAMS.length * 100 * 0.05 / 60)} minutos\n`);

  const results = [];

  for (const exam of ALL_EXAMS) {
    const result = await processExam(exam);
    results.push({ ...exam, ...result });

    // Pausa entre exámenes
    await sleep(2000);
  }

  // Resumen final
  console.log('\n\n' + '='.repeat(60));
  console.log('📊 RESUMEN FINAL');
  console.log('='.repeat(60));

  let totalQ = 0, totalExp = 0, totalRep = 0;

  for (const r of results) {
    if (r.success) {
      console.log(`  ✅ ${r.title}: ${r.questions} preguntas, ${r.explanations} explicaciones, ${r.repealed} derogadas`);
      totalQ += r.questions;
      totalExp += r.explanations;
      totalRep += r.repealed;
    } else {
      console.log(`  ❌ ${r.title}: ${r.error}`);
    }
  }

  console.log(`\n  TOTAL: ${totalQ} preguntas, ${totalExp} explicaciones, ${totalRep} derogadas`);
}

main().catch(console.error);
