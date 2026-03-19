// Script para recapturar exámenes usando Playwright + API
// Crea los tests vía navegador, captura con API, luego descarta

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const SESSION_DIR = path.join(__dirname, '.opositatest-session');
const OUTPUT_DIR = path.join(__dirname, '../preguntas-para-subir/tramitacion-procesal/convocatorias-anteriores');

// Exámenes a recapturar
const EXAMS_TO_RECAPTURE = [
  { examId: 709137, name: 'Examen_2012_OEP_2011', title: 'Examen 2012 (OEP 2011)' },
  { examId: 29734933, name: 'Examen_2023_OEP_2020_2021_2022', title: 'Examen 2023 (OEP 2020-2022)' },
  { examId: 49485348, name: 'Examen_2025_OEP_2024', title: 'Examen 2025 (OEP 2024)' }
];

let capturedJWT = null;

async function main() {
  console.log('🔄 RECAPTURANDO EXÁMENES VÍA NAVEGADOR');
  console.log('======================================\n');

  const { execSync } = require('child_process');
  let chromePath;
  try {
    chromePath = execSync('which google-chrome 2>/dev/null').toString().trim();
  } catch (e) {
    chromePath = '/usr/bin/google-chrome';
  }

  const context = await chromium.launchPersistentContext(SESSION_DIR, {
    headless: false,
    viewport: { width: 1400, height: 900 },
    executablePath: chromePath,
    args: ['--disable-blink-features=AutomationControlled']
  });

  const page = await context.newPage();

  // Capturar JWT de cualquier request
  page.on('request', request => {
    const auth = request.headers()['authorization'];
    if (auth && auth.startsWith('Bearer ') && !capturedJWT) {
      capturedJWT = auth.replace('Bearer ', '');
      console.log('✅ JWT capturado');
    }
  });

  // Navegar a convocatorias anteriores
  console.log('📄 Navegando a convocatorias anteriores...');
  await page.goto('https://aula.opositatest.com/classroom/test-configurator?mainContentId=a5bf8e33-09ad-4e6f-9d1a-d33a2a7e5f98', {
    waitUntil: 'networkidle'
  });
  await page.waitForTimeout(3000);

  // Esperar a que tengamos JWT
  let attempts = 0;
  while (!capturedJWT && attempts < 10) {
    await page.waitForTimeout(1000);
    attempts++;
  }

  if (!capturedJWT) {
    // Intentar cargar de archivo
    try {
      capturedJWT = fs.readFileSync(path.join(__dirname, 'jwt-token.txt'), 'utf-8').trim();
      console.log('✅ JWT cargado de archivo');
    } catch (e) {
      console.error('❌ No se pudo obtener JWT');
      await context.close();
      return;
    }
  }

  // Procesar cada examen
  for (const exam of EXAMS_TO_RECAPTURE) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📋 ${exam.title}`);
    console.log(`${'='.repeat(60)}`);

    try {
      // 1. Navegar a la página del examen específico y crearlo
      console.log('  🔍 Buscando examen en la lista...');

      // Ir a la sección de convocatorias anteriores
      await page.goto('https://aula.opositatest.com/classroom/test-configurator?mainContentId=a5bf8e33-09ad-4e6f-9d1a-d33a2a7e5f98&selectedTab=previous-call', {
        waitUntil: 'networkidle'
      });
      await page.waitForTimeout(2000);

      // Buscar el card del examen por su título
      const examTitles = {
        709137: '11 de Marzo de 2012',
        29734933: '2023',
        49485348: '27 de septiembre de 2025'
      };

      const searchText = examTitles[exam.examId];
      console.log(`  🔍 Buscando: "${searchText}"...`);

      // Hacer click en el examen
      const examCard = await page.locator(`text=${searchText}`).first();
      if (await examCard.isVisible()) {
        await examCard.click();
        await page.waitForTimeout(2000);

        // Buscar el botón de "Comenzar" o "Iniciar"
        const startBtn = await page.locator('button:has-text("Comenzar"), button:has-text("Iniciar"), button:has-text("Empezar")').first();
        if (await startBtn.isVisible()) {
          // Capturar la URL después del click para obtener el testId
          let createdTestId = null;

          page.on('response', async response => {
            const url = response.url();
            if (url.includes('/exams') && response.request().method() === 'POST') {
              try {
                const data = await response.json();
                if (data.id) {
                  createdTestId = data.id;
                  console.log(`  ✅ Test creado: ${createdTestId}`);
                }
              } catch (e) {}
            }
          });

          await startBtn.click();
          await page.waitForTimeout(3000);

          // Obtener testId de la URL si no lo capturamos
          if (!createdTestId) {
            const url = page.url();
            const match = url.match(/doing-test\/([a-f0-9-]+)/);
            if (match) {
              createdTestId = match[1];
              console.log(`  ✅ Test ID de URL: ${createdTestId}`);
            }
          }

          if (createdTestId) {
            // 2. Obtener preguntas con metadatos completos vía API
            console.log('  📥 Obteniendo preguntas con metadatos completos...');

            const response = await fetch(
              `https://api.opositatest.com/api/v2.0/tests/${createdTestId}?embedded=questions,responses`,
              {
                headers: {
                  'Authorization': `Bearer ${capturedJWT}`,
                  'Content-Type': 'application/json'
                }
              }
            );

            if (!response.ok) {
              throw new Error(`API Error: ${response.status}`);
            }

            const testData = await response.json();

            // 3. Transformar y guardar
            const questions = (testData.questions || []).map((q, i) => ({
              id: q.id,
              position: i + 1,
              question: q.organization || q.question || '',
              organization: q.organization || null,
              options: (q.answers || []).map(a => ({
                id: a.id,
                text: a.declaration || a.text || '',
                isCorrect: a.id === q.correctAnswerId
              })),
              correctAnswerId: q.correctAnswerId,
              correctAnswer: q.correctAnswer || null,
              correctLetter: ['A', 'B', 'C', 'D'][(q.answers || []).findIndex(a => a.id === q.correctAnswerId)] || null,
              explanation: q.reason || q.explanation || null,
              isAnnulled: q.isAnnulled || false,
              isRepealed: q.isRepealed || false,
              isDeleted: q.isDeleted || false,
              answeredId: q.answeredId || null,
              isDoubtful: q.isDoubtful || false,
              isHighlighted: q.isHighlighted || false,
              image: q.image || null,
              contents: q.contents || [],
              rawAnswers: q.answers || null
            }));

            // Verificar metadatos
            const hasContents = questions.some(q => q.contents && q.contents.length > 0);
            const repealedCount = questions.filter(q => q.isRepealed).length;

            console.log(`  📊 Preguntas: ${questions.length}`);
            console.log(`  📊 Con tema/epígrafe: ${hasContents ? '✅' : '❌'}`);
            console.log(`  📊 Derogadas: ${repealedCount}`);

            // 4. Guardar JSON
            const output = {
              metadata: {
                examId: exam.examId,
                testId: createdTestId,
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

            // 5. Descartar test
            console.log('  🗑️  Descartando test...');
            await fetch(`https://api.opositatest.com/api/v2.0/tests/${createdTestId}/discard`, {
              method: 'PUT',
              headers: {
                'Authorization': `Bearer ${capturedJWT}`,
                'Content-Type': 'application/json'
              }
            });

            console.log('  ✅ Completado');
          } else {
            console.log('  ❌ No se pudo obtener testId');
          }
        } else {
          console.log('  ❌ No se encontró botón de inicio');
        }
      } else {
        console.log(`  ❌ No se encontró el examen "${searchText}"`);
      }

    } catch (error) {
      console.error(`  ❌ Error: ${error.message}`);
    }

    await page.waitForTimeout(2000);
  }

  console.log('\n\n✅ Proceso completado');
  console.log('Cerrando navegador en 5 segundos...');
  await page.waitForTimeout(5000);
  await context.close();
}

main().catch(console.error);
