// Script para recapturar exámenes con la API CORRECTA
// POST /api/v2.0/tests con {"examId": X, "autoStart": true}

const fs = require('fs');
const path = require('path');

const JWT = fs.readFileSync(path.join(__dirname, 'jwt-token.txt'), 'utf-8').trim();
const OUTPUT_DIR = path.join(__dirname, '../preguntas-para-subir/tramitacion-procesal/convocatorias-anteriores');

// Exámenes a recapturar (los 3 con formato incompleto)
const EXAMS_TO_RECAPTURE = [
  { examId: 709137, name: 'Examen_2012_OEP_2011', title: 'Examen 2012 (OEP 2011)' },
  { examId: 29734933, name: 'Examen_2023_OEP_2020_2021_2022', title: 'Examen 2023 (OEP 2020-2022)' },
  { examId: 49485348, name: 'Examen_2025_OEP_2024', title: 'Examen 2025 (OEP 2024)' }
];

async function createTest(examId) {
  console.log(`  📝 Creando test para examId: ${examId}...`);

  const response = await fetch('https://api.opositatest.com/api/v2.0/tests', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${JWT}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      examId: examId,
      autoStart: true
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`API Error ${response.status}: ${text.substring(0, 200)}`);
  }

  const data = await response.json();
  console.log(`  ✅ Test creado: ${data.id}`);
  return data.id;
}

async function getTestWithFullMetadata(testId) {
  console.log(`  📥 Obteniendo preguntas con metadatos completos...`);

  const response = await fetch(
    `https://api.opositatest.com/api/v2.0/tests/${testId}?embedded=questions,responses`,
    {
      headers: {
        'Authorization': `Bearer ${JWT}`,
        'Content-Type': 'application/json'
      }
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`API Error ${response.status}: ${text.substring(0, 200)}`);
  }

  return response.json();
}

async function discardTest(testId) {
  console.log(`  🗑️  Descartando test...`);

  const response = await fetch(`https://api.opositatest.com/api/v2.0/tests/${testId}/discard`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${JWT}`,
      'Content-Type': 'application/json'
    }
  });

  // 204 = éxito, 409 = ya completado (también ok)
  if (response.status === 204 || response.status === 409) {
    console.log(`  ✅ Test descartado`);
  } else {
    console.log(`  ⚠️  Discard status: ${response.status}`);
  }
}

function transformQuestion(q, position) {
  // Determinar la letra correcta
  let correctLetter = null;
  const answers = q.answers || [];
  const correctIdx = answers.findIndex(a => a.id === q.correctAnswerId);
  if (correctIdx >= 0) {
    correctLetter = ['A', 'B', 'C', 'D'][correctIdx];
  }

  // Obtener respuesta correcta text
  const correctAnswer = correctIdx >= 0 ? answers[correctIdx].declaration : null;

  return {
    id: q.id,
    position: position,
    question: q.declaration || '',  // 🔥 CORREGIDO: declaration es el texto de la pregunta
    organization: q.organization || null,  // Objeto con info de OpositaTest
    options: answers.map((a, idx) => ({
      id: a.id,
      text: a.declaration || '',
      isCorrect: a.id === q.correctAnswerId
    })),
    correctAnswerId: q.correctAnswerId || null,
    correctAnswer: correctAnswer,
    correctLetter: correctLetter,
    explanation: q.reason || null,
    isAnnulled: q.isAnnulled || false,
    isRepealed: q.isRepealed || false,  // 🔥 Campo "DEROGADA"
    isDeleted: q.isDeleted || false,
    answeredId: q.answeredId || null,
    isDoubtful: q.isDoubtful || false,
    isHighlighted: q.isHighlighted || false,
    image: q.image || null,
    contents: q.contents || [],  // 🔥 Tema y epígrafe
    rawAnswers: answers
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
    const repealedCount = questions.filter(q => q.isRepealed === true).length;
    const hasExplanation = questions.some(q => q.explanation);

    console.log(`  📊 Preguntas: ${questions.length}`);
    console.log(`  📊 Con tema/epígrafe: ${hasContents ? '✅' : '❌'}`);
    console.log(`  📊 Con campo derogada: ${hasRepealed ? '✅' : '❌'}`);
    console.log(`  📊 Preguntas derogadas: ${repealedCount}`);
    console.log(`  📊 Con explicaciones: ${hasExplanation ? '✅' : '❌'}`);

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
      source: 'opositatest-api-complete',
      oppositionName: 'tramitacion-procesal',
      questionCount: questions.length,
      questions: questions
    };

    const outputPath = path.join(OUTPUT_DIR, `${exam.name}.json`);
    fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
    console.log(`  💾 Guardado: ${exam.name}.json`);

    // 6. Descartar test
    await discardTest(testId);

    return { success: true, questions: questions.length, repealed: repealedCount };

  } catch (error) {
    console.error(`  ❌ Error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function main() {
  console.log('🔄 RECAPTURANDO EXÁMENES CON API CORRECTA');
  console.log('==========================================');
  console.log('Endpoint: POST /api/v2.0/tests');
  console.log('Body: {"examId": X, "autoStart": true}\n');

  const results = [];

  for (const exam of EXAMS_TO_RECAPTURE) {
    const result = await recaptureExam(exam);
    results.push({ ...exam, ...result });

    // Pausa entre exámenes para no saturar
    await new Promise(r => setTimeout(r, 2000));
  }

  console.log('\n\n' + '='.repeat(60));
  console.log('📊 RESUMEN FINAL');
  console.log('='.repeat(60));

  let totalQuestions = 0;
  let totalRepealed = 0;

  for (const r of results) {
    if (r.success) {
      console.log(`  ✅ ${r.title}: ${r.questions} preguntas (${r.repealed} derogadas)`);
      totalQuestions += r.questions;
      totalRepealed += r.repealed;
    } else {
      console.log(`  ❌ ${r.title}: ${r.error}`);
    }
  }

  console.log(`\n  TOTAL: ${totalQuestions} preguntas, ${totalRepealed} derogadas`);
}

main().catch(console.error);
