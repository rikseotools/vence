// Script para descartar tests ya capturados y capturar los faltantes
const fs = require('fs');
const path = require('path');

const JWT = fs.readFileSync(path.join(__dirname, 'jwt-token.txt'), 'utf8').trim();
const OUTPUT_BASE = '/home/manuel/Documentos/github/vence/preguntas-para-subir/tramitacion-procesal';

// ExamIds ya capturados en JSON (se pueden descartar)
const CAPTURED_EXAM_IDS = [
  707425,   // 2016 (OEP 2015)
  1143624,  // 2018 (OEP 2016)
  7215420,  // 2020 (OEP 2017/2018)
  35968319, // Estabilización 2024 (OEP 2021)
  40195044, // 28 Sep 2024 (OEP 2023)
  49481489, // Tercer Ejercicio 2024 (OEP 2024)
  49478717  // Supuesto Práctico 2025 (OEP 2024)
];

// Convocatorias que faltan por capturar
const MISSING_EXAMS = [
  { id: 709137, title: 'Examen 2012 (OEP 2011)' },
  { id: 29734933, title: 'Examen 2023 (OEP 2020/2021/2022)' },
  { id: 49485348, title: 'Examen 27 Sep 2025 (OEP 2024)' }
];

async function api(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Authorization': `Bearer ${JWT}`,
      'Content-Type': 'application/json',
      ...options.headers
    }
  });

  const text = await response.text();

  if (!response.ok) {
    throw new Error(`API Error ${response.status}: ${text.slice(0, 200)}`);
  }

  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

async function getTestsGuardados() {
  const data = await api('https://api.opositatest.com/api/v2.0/tests/saved?pageSize=25&sort=-createdAt');
  return data.resources || [];
}

async function discardTest(testId) {
  // Intentar varios métodos para descartar
  const methods = [
    // Método 1: DELETE directo
    { method: 'DELETE', url: `https://api.opositatest.com/api/v2.0/tests/${testId}` },
    // Método 2: PUT con estado "discarded"
    { method: 'PUT', url: `https://api.opositatest.com/api/v2.0/tests/${testId}`, body: { state: 'discarded' } },
    // Método 3: PATCH
    { method: 'PATCH', url: `https://api.opositatest.com/api/v2.0/tests/${testId}`, body: { state: 'discarded' } },
    // Método 4: POST a /discard
    { method: 'POST', url: `https://api.opositatest.com/api/v2.0/tests/${testId}/discard` },
  ];

  for (const m of methods) {
    try {
      const options = { method: m.method };
      if (m.body) options.body = JSON.stringify(m.body);

      await api(m.url, options);
      return true;
    } catch (e) {
      // Continuar con el siguiente método
    }
  }

  return false;
}

async function createTest(examId) {
  const test = await api('https://api.opositatest.com/api/v2.0/tests', {
    method: 'POST',
    body: JSON.stringify({ examId })
  });
  return test;
}

async function getTestWithQuestions(testId) {
  return await api(`https://api.opositatest.com/api/v2.0/tests/${testId}?embedded=questions,responses`);
}

function processQuestions(test, examInfo) {
  const questions = (test.questions || []).map((q, i) => {
    const correctAnswer = q.answers?.find(a => a.id === q.correctAnswerId);
    const correctIndex = q.answers?.findIndex(a => a.id === q.correctAnswerId);
    const letters = ['A', 'B', 'C', 'D'];

    return {
      id: q.id,
      position: i + 1,
      question: q.organization || '',
      declaration: q.declaration || null,
      options: (q.answers || []).map((a) => ({
        id: a.id,
        text: a.declaration || '',
        isCorrect: a.id === q.correctAnswerId
      })),
      correctAnswerId: q.correctAnswerId,
      correctAnswer: correctAnswer?.declaration || '',
      correctLetter: letters[correctIndex] || '?',
      explanation: q.reason || null,
      isAnnulled: q.isAnnulled || false,
      isRepealed: q.isRepealed || false,
      isDeleted: q.isDeleted || false,
      image: q.image || null,
      contents: q.contents || [],
      rawAnswers: q.answers
    };
  });

  return {
    metadata: {
      examId: examInfo.id,
      testId: test.id,
      title: examInfo.title,
      type: 'previousCall'
    },
    testMetadata: {
      oppositionId: test.oppositionId,
      state: test.state,
      statement: test.statement || null,
      createdAt: test.createdAt
    },
    scrapedAt: new Date().toISOString(),
    source: 'opositatest-api',
    oppositionName: 'tramitacion-procesal',
    questionCount: questions.length,
    questions
  };
}

function sanitizeFilename(title) {
  return title
    .replace(/[\/\\?%*:|"<>]/g, '')
    .replace(/\s+/g, '_')
    .substring(0, 100);
}

async function main() {
  console.log('🧹 LIMPIEZA Y CAPTURA DE EXÁMENES\n');
  console.log('='.repeat(60));

  // 1. Obtener tests guardados
  console.log('\n📋 Obteniendo tests guardados...');
  const saved = await getTestsGuardados();
  console.log(`   Total guardados: ${saved.length}/10`);

  // 2. Identificar tests que ya están capturados y se pueden descartar
  const toDiscard = saved.filter(t => {
    const examId = t.exam?.id;
    return CAPTURED_EXAM_IDS.includes(examId);
  });

  console.log(`\n🗑️ Tests ya capturados que se pueden descartar: ${toDiscard.length}`);
  toDiscard.forEach(t => {
    console.log(`   - [${t.id}] ${t.exam?.title || 'Sin título'}`);
  });

  // 3. Descartar tests
  if (toDiscard.length > 0) {
    console.log('\n🗑️ Descartando tests...');

    for (const test of toDiscard) {
      console.log(`   Descartando: ${test.exam?.title?.substring(0, 50) || test.id}...`);
      const success = await discardTest(test.id);
      if (success) {
        console.log(`   ✅ Descartado`);
      } else {
        console.log(`   ❌ No se pudo descartar automáticamente`);
      }
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  // 4. Verificar espacio disponible
  console.log('\n📋 Verificando espacio...');
  const savedAfter = await getTestsGuardados();
  const espacioDisponible = 10 - savedAfter.length;
  console.log(`   Tests guardados: ${savedAfter.length}/10`);
  console.log(`   Espacio disponible: ${espacioDisponible}`);

  if (espacioDisponible < MISSING_EXAMS.length) {
    console.log(`\n⚠️ No hay suficiente espacio para capturar ${MISSING_EXAMS.length} exámenes.`);
    console.log(`   Por favor descarta manualmente algunos tests en:`);
    console.log(`   https://aula.opositatest.com/classroom/test/saved-test`);

    // Mostrar tests actuales
    console.log('\n   Tests actuales:');
    savedAfter.forEach(t => {
      const isCaptured = CAPTURED_EXAM_IDS.includes(t.exam?.id);
      const mark = isCaptured ? '✅ (capturado)' : '❓';
      console.log(`   - ${t.exam?.title?.substring(0, 60) || t.id} ${mark}`);
    });

    return;
  }

  // 5. Capturar exámenes faltantes
  console.log('\n' + '='.repeat(60));
  console.log('📥 CAPTURANDO EXÁMENES FALTANTES');
  console.log('='.repeat(60));

  const outputDir = path.join(OUTPUT_BASE, 'convocatorias-anteriores');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  for (const exam of MISSING_EXAMS) {
    console.log(`\n📥 Capturando: ${exam.title}`);

    try {
      // Verificar si ya existe un test para este exam
      const currentSaved = await getTestsGuardados();
      let testId = currentSaved.find(t => t.exam?.id === exam.id)?.id;

      if (!testId) {
        console.log(`   Creando test...`);
        const newTest = await createTest(exam.id);
        testId = newTest.id;
        console.log(`   ✅ Test creado: ${testId}`);
      } else {
        console.log(`   Reutilizando test existente: ${testId}`);
      }

      await new Promise(r => setTimeout(r, 1000));

      // Obtener preguntas
      console.log(`   Obteniendo preguntas...`);
      const testData = await getTestWithQuestions(testId);

      const processed = processQuestions(testData, exam);
      const filename = sanitizeFilename(exam.title) + '.json';
      const filepath = path.join(outputDir, filename);

      fs.writeFileSync(filepath, JSON.stringify(processed, null, 2));

      console.log(`   ✅ Guardado: ${filename}`);
      console.log(`   📊 ${processed.questionCount} preguntas`);

      await new Promise(r => setTimeout(r, 2000));

    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
    }
  }

  // 6. Resumen final
  console.log('\n' + '='.repeat(60));
  console.log('📊 RESUMEN FINAL');
  console.log('='.repeat(60));

  const files = fs.readdirSync(outputDir).filter(f => f.endsWith('.json'));
  console.log(`\n   Archivos en convocatorias-anteriores: ${files.length}`);
  files.forEach(f => console.log(`   - ${f}`));

  console.log('\n✅ Proceso completado');
}

main().catch(err => {
  console.error('❌ Error fatal:', err.message);
  process.exit(1);
});
