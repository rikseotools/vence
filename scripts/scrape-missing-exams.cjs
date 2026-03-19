// Script para capturar convocatorias y supuestos que faltan
const fs = require('fs');
const path = require('path');

const JWT = fs.readFileSync(path.join(__dirname, 'jwt-token.txt'), 'utf8').trim();
const OUTPUT_BASE = '/home/manuel/Documentos/github/vence/preguntas-para-subir/tramitacion-procesal';

// Convocatorias ya capturadas (por examId)
const CAPTURED_CONVOCATORIAS = [
  707425,   // 2016 (OEP 2015)
  1143624,  // 2018 (OEP 2016)
  7215420,  // 2020 (OEP 2017/2018)
  35968319, // Estabilización 2024 (OEP 2021)
  40195044, // 28 Sep 2024 (OEP 2023)
  49481489  // Tercer Ejercicio 2024 (OEP 2024)
];

// Supuestos ya capturados
const CAPTURED_SUPUESTOS = [
  49478717  // Supuesto Práctico 2025 (OEP 2024)
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

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`API Error ${response.status}: ${text.slice(0, 200)}`);
  }

  return response.json();
}

async function getTestsGuardados() {
  const data = await api('https://api.opositatest.com/api/v2.0/tests/saved?pageSize=25&sort=-createdAt');
  return data.resources || [];
}

async function createOrGetTest(examId) {
  // Primero verificar si ya existe un test para este exam
  const saved = await getTestsGuardados();
  const existing = saved.find(t => t.exam?.id === examId);

  if (existing) {
    console.log(`   Reutilizando test existente: ${existing.id}`);
    return existing.id;
  }

  // Verificar límite de tests (NO borrar, solo avisar)
  if (saved.length >= 10) {
    console.log(`   ⚠️ Límite de 10 tests alcanzado. Tests guardados: ${saved.length}`);
    console.log(`   Por favor elimina algunos tests manualmente en:`);
    console.log(`   https://aula.opositatest.com/classroom/saved-tests`);
    throw new Error('TestLimitReached');
  }

  // Crear nuevo test
  console.log(`   Creando nuevo test para examId ${examId}...`);
  const test = await api('https://api.opositatest.com/api/v2.0/tests', {
    method: 'POST',
    body: JSON.stringify({ examId })
  });

  return test.id;
}

async function getTestQuestions(testId) {
  const data = await api(`https://api.opositatest.com/api/v2.0/tests/${testId}?embedded=questions,responses`);
  return data;
}

function processQuestions(test, examInfo) {
  const questions = (test.questions || []).map((q, i) => {
    const correctAnswer = q.answers.find(a => a.id === q.correctAnswerId);
    const correctIndex = q.answers.findIndex(a => a.id === q.correctAnswerId);
    const letters = ['A', 'B', 'C', 'D'];

    return {
      id: q.id,
      position: i + 1,
      question: q.organization || '',
      declaration: q.declaration || null,
      options: q.answers.map((a, idx) => ({
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
      type: examInfo.type,
      editionId: examInfo.editionId
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
    .replace(/,/g, ',')
    .replace(/\s+/g, '_')
    .substring(0, 100);
}

async function captureExam(examInfo, type) {
  console.log(`\n📥 Capturando: ${examInfo.title}`);

  try {
    const testId = await createOrGetTest(examInfo.id);
    await new Promise(r => setTimeout(r, 1000));

    const test = await getTestQuestions(testId);
    const processed = processQuestions(test, examInfo);

    // Determinar carpeta de destino
    const folder = type === 'previousCall' ? 'convocatorias-anteriores' : 'supuestos-practicos';
    const outputDir = path.join(OUTPUT_BASE, folder);

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const filename = sanitizeFilename(examInfo.title) + '.json';
    const filepath = path.join(outputDir, filename);

    fs.writeFileSync(filepath, JSON.stringify(processed, null, 2));

    console.log(`   ✅ Guardado: ${folder}/${filename}`);
    console.log(`   📊 ${processed.questionCount} preguntas`);

    return true;
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
    return false;
  }
}

async function main() {
  console.log('🚀 SCRAPER DE EXÁMENES FALTANTES\n');
  console.log('='.repeat(60));

  // 1. Obtener lista de convocatorias
  console.log('\n📋 Obteniendo lista de convocatorias...');
  const convocatoriasData = await api('https://admin.opositatest.com/api/v2.0/exams?filters[opposition]=7&filters[type]=previousCall&pageSize=50');
  const convocatorias = convocatoriasData.resources || [];

  // Filtrar las que faltan
  const convocatoriasFaltantes = convocatorias.filter(c => !CAPTURED_CONVOCATORIAS.includes(c.id));

  console.log(`   Total disponibles: ${convocatorias.length}`);
  console.log(`   Ya capturadas: ${CAPTURED_CONVOCATORIAS.length}`);
  console.log(`   Faltan: ${convocatoriasFaltantes.length}`);

  if (convocatoriasFaltantes.length > 0) {
    console.log('\n   Convocatorias a capturar:');
    convocatoriasFaltantes.forEach((c, i) => {
      console.log(`   ${i + 1}. [${c.id}] ${c.title}`);
    });
  }

  // 2. Obtener lista de supuestos (solo oposición 7)
  console.log('\n📋 Obteniendo lista de supuestos prácticos...');
  const supuestosData = await api('https://admin.opositatest.com/api/v2.0/exams?filters[type]=alleged&pageSize=25');

  // Filtrar solo los de Tramitación Procesal (oppositionId 7)
  // Nota: Los supuestos no tienen oppositionId directo, hay que verificar
  const supuestosTramitacion = (supuestosData.resources || []).filter(s => {
    // Verificar si el título menciona Tramitación
    return s.title && (
      s.title.toLowerCase().includes('tramitación') ||
      s.title.toLowerCase().includes('tramitacion') ||
      s.oppositionId === 7
    );
  });

  const supuestosFaltantes = supuestosTramitacion.filter(s => !CAPTURED_SUPUESTOS.includes(s.id));

  console.log(`   Total supuestos en API: ${supuestosData.resources?.length || 0}`);
  console.log(`   De Tramitación Procesal: ${supuestosTramitacion.length}`);
  console.log(`   Ya capturados: ${CAPTURED_SUPUESTOS.length}`);
  console.log(`   Faltan: ${supuestosFaltantes.length}`);

  if (supuestosFaltantes.length > 0) {
    console.log('\n   Supuestos a capturar:');
    supuestosFaltantes.forEach((s, i) => {
      console.log(`   ${i + 1}. [${s.id}] ${s.title}`);
    });
  }

  // 3. Capturar convocatorias faltantes
  if (convocatoriasFaltantes.length > 0) {
    console.log('\n' + '='.repeat(60));
    console.log('📥 CAPTURANDO CONVOCATORIAS FALTANTES');
    console.log('='.repeat(60));

    for (const exam of convocatoriasFaltantes) {
      await captureExam(exam, 'previousCall');
      await new Promise(r => setTimeout(r, 2000)); // Pausa entre requests
    }
  }

  // 4. Capturar supuestos faltantes
  if (supuestosFaltantes.length > 0) {
    console.log('\n' + '='.repeat(60));
    console.log('📥 CAPTURANDO SUPUESTOS FALTANTES');
    console.log('='.repeat(60));

    for (const exam of supuestosFaltantes) {
      await captureExam(exam, 'alleged');
      await new Promise(r => setTimeout(r, 2000));
    }
  }

  // 5. Resumen final
  console.log('\n' + '='.repeat(60));
  console.log('📊 RESUMEN FINAL');
  console.log('='.repeat(60));

  const convDir = path.join(OUTPUT_BASE, 'convocatorias-anteriores');
  const supDir = path.join(OUTPUT_BASE, 'supuestos-practicos');

  const convFiles = fs.existsSync(convDir) ? fs.readdirSync(convDir).filter(f => f.endsWith('.json')) : [];
  const supFiles = fs.existsSync(supDir) ? fs.readdirSync(supDir).filter(f => f.endsWith('.json')) : [];

  console.log(`\n   Convocatorias capturadas: ${convFiles.length}/${convocatorias.length}`);
  convFiles.forEach(f => console.log(`   - ${f}`));

  console.log(`\n   Supuestos capturados: ${supFiles.length}`);
  supFiles.forEach(f => console.log(`   - ${f}`));

  console.log('\n✅ Proceso completado');
}

main().catch(err => {
  console.error('❌ Error fatal:', err.message);
  process.exit(1);
});
