// Script para capturar convocatorias faltantes usando Playwright
// Usa el navegador para hacer las requests autenticadas

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const SESSION_DIR = path.join(__dirname, '.opositatest-session');
const OUTPUT_BASE = '/home/manuel/Documentos/github/vence/preguntas-para-subir/tramitacion-procesal';

// Convocatorias que faltan por capturar
const MISSING_CONVOCATORIAS = [
  { id: 709137, title: 'Examen Tramitación Procesal Turno Libre, 11 de Marzo de 2012 (OEP 2011)' },
  { id: 29734933, title: 'Examen Tramitación Procesal Turno Libre, 2023 (OEP 2020, 2021, 2022)' },
  { id: 49485348, title: 'Examen Tramitación Procesal Turno Libre, 27 de septiembre de 2025 (OEP 2024)' }
];

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
      options: (q.answers || []).map((a, idx) => ({
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
    .replace(/,/g, ',')
    .replace(/\s+/g, '_')
    .substring(0, 100);
}

async function main() {
  console.log('🚀 SCRAPER DE CONVOCATORIAS FALTANTES (Browser)\n');

  const { execSync } = require('child_process');
  let chromePath;
  try {
    chromePath = execSync('which google-chrome 2>/dev/null').toString().trim();
  } catch (e) {
    chromePath = '/usr/bin/google-chrome';
  }

  const context = await chromium.launchPersistentContext(SESSION_DIR, {
    headless: false,
    viewport: { width: 1280, height: 800 },
    executablePath: chromePath,
    args: ['--disable-blink-features=AutomationControlled']
  });

  const page = await context.newPage();

  // Interceptar responses de la API
  const capturedTests = new Map();

  page.on('response', async response => {
    const url = response.url();
    try {
      // Capturar respuestas de tests con preguntas
      if (url.includes('/tests/') && url.includes('embedded=questions')) {
        const data = await response.json();
        if (data.questions && data.questions.length > 0) {
          capturedTests.set(data.id, data);
          console.log(`   📦 Capturado test ${data.id} con ${data.questions.length} preguntas`);
        }
      }
    } catch (e) {}
  });

  // Verificar sesión
  console.log('🔍 Verificando sesión...');
  await page.goto('https://aula.opositatest.com/dashboard', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  if (page.url().includes('login')) {
    console.log('❌ No hay sesión activa. Por favor haz login manualmente.');
    await page.waitForTimeout(30000);
  }

  console.log('✅ Sesión activa\n');

  // Procesar cada convocatoria
  for (const exam of MISSING_CONVOCATORIAS) {
    console.log(`\n📥 Procesando: ${exam.title}`);
    console.log(`   ExamId: ${exam.id}`);

    // Navegar al configurador
    await page.goto('https://aula.opositatest.com/classroom/test-configurator?mainContentId=7', {
      waitUntil: 'networkidle'
    });
    await page.waitForTimeout(2000);

    // Click en "Convocatorias anteriores"
    try {
      await page.click('text=Convocatorias anteriores');
      await page.waitForTimeout(2000);
    } catch (e) {
      console.log('   ⚠️ No se encontró pestaña de convocatorias');
    }

    // Buscar y hacer clic en el examen específico
    const examSelector = `[data-exam-id="${exam.id}"], text=${exam.title.substring(0, 30)}`;
    try {
      // Buscar por título parcial
      const titlePart = exam.title.includes('2012') ? '2012' :
                        exam.title.includes('2023') ? '2023' :
                        exam.title.includes('2025') ? '2025' : '';

      if (titlePart) {
        const examLink = await page.$(`text=${titlePart}`);
        if (examLink) {
          await examLink.click();
          console.log(`   ✅ Click en examen ${titlePart}`);
          await page.waitForTimeout(2000);

          // Buscar botón "Empezar" o "Reanudar"
          const startBtn = await page.$('text=Empezar');
          const resumeBtn = await page.$('text=Reanudar');

          if (startBtn) {
            await startBtn.click();
            console.log('   ✅ Click en Empezar');
          } else if (resumeBtn) {
            await resumeBtn.click();
            console.log('   ✅ Click en Reanudar');
          }

          await page.waitForTimeout(3000);

          // Terminar test inmediatamente
          const finishBtn = await page.$('text=Terminar');
          if (finishBtn) {
            await finishBtn.click();
            await page.waitForTimeout(1000);

            // Confirmar
            const confirmBtn = await page.$('text=Sí');
            if (confirmBtn) {
              await confirmBtn.click();
              await page.waitForTimeout(3000);
            }
          }
        }
      }
    } catch (e) {
      console.log(`   ❌ Error navegando: ${e.message}`);
    }

    // Verificar si se capturó el test
    await page.waitForTimeout(2000);
  }

  // Guardar todos los tests capturados
  console.log('\n\n📊 GUARDANDO RESULTADOS\n');

  const outputDir = path.join(OUTPUT_BASE, 'convocatorias-anteriores');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  for (const [testId, testData] of capturedTests) {
    // Buscar el examInfo correspondiente
    const examInfo = MISSING_CONVOCATORIAS.find(e =>
      testData.exam?.id === e.id ||
      testData.examId === e.id
    ) || { id: testData.examId || 'unknown', title: testData.exam?.title || testId };

    const processed = processQuestions(testData, examInfo);
    const filename = sanitizeFilename(examInfo.title) + '.json';
    const filepath = path.join(outputDir, filename);

    fs.writeFileSync(filepath, JSON.stringify(processed, null, 2));
    console.log(`✅ Guardado: ${filename} (${processed.questionCount} preguntas)`);
  }

  // Mantener navegador abierto para inspección manual
  console.log('\n⏳ Navegador abierto. Puedes capturar manualmente los exámenes faltantes.');
  console.log('   Instrucciones:');
  console.log('   1. Ve a "Convocatorias anteriores"');
  console.log('   2. Click en el examen');
  console.log('   3. Click "Empezar" → "Terminar" → "Sí"');
  console.log('   4. El test se capturará automáticamente');
  console.log('\n   Presiona Ctrl+C para cerrar cuando termines.\n');

  // Mantener abierto
  await new Promise(() => {});
}

main().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
