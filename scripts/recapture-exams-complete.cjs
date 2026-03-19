// Script para recapturar exámenes con TODOS los metadatos
// Usa el endpoint correcto: GET /tests/{testId}?embedded=questions,responses

const fs = require('fs');
const path = require('path');

const JWT = fs.readFileSync(path.join(__dirname, 'jwt-token.txt'), 'utf-8').trim();
const OUTPUT_DIR = path.join(__dirname, '../preguntas-para-subir/tramitacion-procesal/convocatorias-anteriores');

// Exámenes a recapturar (examId de OpositaTest)
const EXAMS_TO_RECAPTURE = [
  { examId: 709137, name: 'Examen_2012_OEP_2011', title: 'Examen 2012 (OEP 2011)' },
  { examId: 29734933, name: 'Examen_2023_OEP_2020_2021_2022', title: 'Examen 2023 (OEP 2020-2022)' },
  { examId: 49485348, name: 'Examen_2025_OEP_2024', title: 'Examen 2025 (OEP 2024)' }
];

async function apiCall(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Authorization': `Bearer ${JWT}`,
      'Content-Type': 'application/json',
      ...options.headers
    }
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`API Error ${response.status}: ${text.substring(0, 200)}`);
  }

  return response.json();
}

async function createTest(examId) {
  console.log(`  📝 Creando test para examId: ${examId}...`);

  // Probar diferentes tipos de API
  const types = ['past_exam', 'previousCall', 'official'];

  for (const type of types) {
    try {
      console.log(`     Probando type: ${type}...`);
      const result = await apiCall('https://api.opositatest.com/api/v2.0/exams', {
        method: 'POST',
        body: JSON.stringify({
          type: type,
          oppositionId: 7,
          examId: examId
        })
      });
      console.log(`  ✅ Test creado con type=${type}: ${result.id}`);
      return result.id;
    } catch (e) {
      console.log(`     ❌ type=${type} falló: ${e.message.substring(0, 50)}`);
    }
  }

  throw new Error('No se pudo crear el test con ningún tipo');
}

async function getTestWithFullMetadata(testId) {
  console.log(`  📥 Obteniendo preguntas con metadatos completos...`);

  // ENDPOINT CRÍTICO: ?embedded=questions,responses devuelve TODOS los metadatos
  const result = await apiCall(
    `https://api.opositatest.com/api/v2.0/tests/${testId}?embedded=questions,responses`
  );

  return result;
}

async function discardTest(testId) {
  console.log(`  🗑️  Descartando test ${testId}...`);

  await fetch(`https://api.opositatest.com/api/v2.0/tests/${testId}/discard`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${JWT}`,
      'Content-Type': 'application/json'
    }
  });
}

function transformQuestion(q, position) {
  // Transformar al formato estándar con TODOS los metadatos
  return {
    id: q.id,
    position: position,
    question: q.question || q.organization || '',  // texto de la pregunta
    organization: q.organization || null,
    options: (q.answers || q.options || []).map((a, idx) => ({
      id: a.id,
      text: a.declaration || a.text || '',
      isCorrect: a.id === q.correctAnswerId || a.isCorrect || false
    })),
    correctAnswerId: q.correctAnswerId || null,
    correctAnswer: q.correctAnswer || null,
    correctLetter: q.correctLetter || ['A', 'B', 'C', 'D'][(q.answers || []).findIndex(a => a.id === q.correctAnswerId)] || null,
    explanation: q.reason || q.explanation || null,
    isAnnulled: q.isAnnulled || false,
    isRepealed: q.isRepealed || false,  // 🔥 CAMPO "DEROGADA"
    isDeleted: q.isDeleted || false,
    answeredId: q.answeredId || null,
    isDoubtful: q.isDoubtful || false,
    isHighlighted: q.isHighlighted || false,
    image: q.image || null,
    contents: q.contents || [],  // 🔥 TEMA Y EPÍGRAFE
    rawAnswers: q.answers || null
  };
}

async function recaptureExam(exam) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`📋 ${exam.title}`);
  console.log(`${'='.repeat(60)}`);

  try {
    // 1. Crear test
    const testId = await createTest(exam.examId);

    // 2. Obtener con metadatos completos
    const testData = await getTestWithFullMetadata(testId);

    // 3. Transformar preguntas
    const questions = (testData.questions || []).map((q, i) => transformQuestion(q, i + 1));

    // 4. Verificar metadatos
    const hasContents = questions.some(q => q.contents && q.contents.length > 0);
    const hasRepealed = questions.some(q => q.isRepealed !== undefined);
    const hasExplanation = questions.some(q => q.explanation);

    console.log(`  📊 Preguntas: ${questions.length}`);
    console.log(`  📊 Con tema/epígrafe: ${hasContents ? '✅' : '❌'}`);
    console.log(`  📊 Con campo derogada: ${hasRepealed ? '✅' : '❌'}`);
    console.log(`  📊 Con explicaciones: ${hasExplanation ? '✅' : '❌'}`);

    // Contar derogadas
    const repealedCount = questions.filter(q => q.isRepealed).length;
    if (repealedCount > 0) {
      console.log(`  ⚠️  Preguntas derogadas: ${repealedCount}`);
    }

    // 5. Guardar JSON
    const output = {
      metadata: {
        examId: exam.examId,
        testId: testId,
        title: testData.title || exam.title,
        type: 'previousCall'
      },
      testMetadata: {
        oppositionId: testData.oppositionId || 7,
        state: testData.state,
        statement: testData.statement || null,
        createdAt: testData.createdAt
      },
      scrapedAt: new Date().toISOString(),
      source: 'opositatest-api-v2-complete',
      oppositionName: 'tramitacion-procesal',
      questionCount: questions.length,
      questions: questions
    };

    const outputPath = path.join(OUTPUT_DIR, `${exam.name}.json`);
    fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
    console.log(`  💾 Guardado: ${outputPath}`);

    // 6. Descartar test
    await discardTest(testId);
    console.log(`  ✅ Completado`);

    return { success: true, questions: questions.length };

  } catch (error) {
    console.error(`  ❌ Error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function main() {
  console.log('🔄 RECAPTURANDO EXÁMENES CON METADATOS COMPLETOS');
  console.log('================================================\n');

  const results = [];

  for (const exam of EXAMS_TO_RECAPTURE) {
    const result = await recaptureExam(exam);
    results.push({ ...exam, ...result });

    // Pequeña pausa entre exámenes
    await new Promise(r => setTimeout(r, 1000));
  }

  console.log('\n\n📊 RESUMEN FINAL');
  console.log('================');
  for (const r of results) {
    const status = r.success ? `✅ ${r.questions} preguntas` : `❌ ${r.error}`;
    console.log(`  ${r.title}: ${status}`);
  }
}

main().catch(console.error);
