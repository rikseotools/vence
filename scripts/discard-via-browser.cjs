// Script para descartar tests via navegador y luego capturar los faltantes
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const SESSION_DIR = path.join(__dirname, '.opositatest-session');
const OUTPUT_BASE = '/home/manuel/Documentos/github/vence/preguntas-para-subir/tramitacion-procesal';

// Títulos de tests ya capturados que se pueden descartar (buscar por texto parcial)
const TITLES_TO_DISCARD = [
  '2016',           // Examen 2016 (OEP 2015)
  '2018',           // Examen 2018 (OEP 2016)
  '2020',           // Examen 2020 (OEP 2017/2018)
  'Estabilización', // Estabilización 2024
  '28 de septiembre', // 28 Sep 2024
  'Tercer Ejercicio', // Tercer Ejercicio 2024
  'Supuesto'        // Supuesto Práctico
];

// Exámenes faltantes que queremos capturar
const EXAMS_TO_CAPTURE = [
  { searchText: '2012', title: 'Examen 2012 (OEP 2011)' },
  { searchText: '2023', title: 'Examen 2023 (OEP 2020/2021/2022)' },
  { searchText: '27 de septiembre de 2025', title: 'Examen 27 Sep 2025 (OEP 2024)' }
];

async function main() {
  console.log('🚀 DESCARTE Y CAPTURA VIA NAVEGADOR\n');

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

  // Capturar JWT actualizado
  page.on('request', request => {
    const auth = request.headers()['authorization'];
    if (auth && auth.startsWith('Bearer ')) {
      fs.writeFileSync(path.join(__dirname, 'jwt-token.txt'), auth.replace('Bearer ', ''));
    }
  });

  // Capturar tests con preguntas
  const capturedTests = new Map();
  page.on('response', async response => {
    const url = response.url();
    try {
      if (url.includes('/tests/') && url.includes('embedded=questions')) {
        const data = await response.json();
        if (data.questions && data.questions.length > 0) {
          capturedTests.set(data.id, data);
          console.log(`   📦 Capturado: ${data.questions.length} preguntas`);
        }
      }
    } catch (e) {}
  });

  // 1. Navegar a tests guardados
  console.log('📄 Navegando a tests guardados...');
  await page.goto('https://aula.opositatest.com/classroom/test/saved-test', {
    waitUntil: 'networkidle'
  });
  await page.waitForTimeout(3000);

  // 2. Descartar tests ya capturados
  console.log('\n🗑️ DESCARTANDO TESTS YA CAPTURADOS\n');

  let discardedCount = 0;
  const maxDiscards = 3; // Solo necesitamos 3 espacios

  for (const titlePart of TITLES_TO_DISCARD) {
    if (discardedCount >= maxDiscards) break;

    try {
      // Buscar el card que contiene el texto
      const cards = await page.$$('.Card, [class*="Card"]');

      for (const card of cards) {
        if (discardedCount >= maxDiscards) break;

        const cardText = await card.textContent();
        if (cardText && cardText.includes(titlePart)) {
          console.log(`   Descartando test con "${titlePart}"...`);

          // Buscar el botón de menú (flecha hacia abajo)
          const menuBtn = await card.$('button[aria-expanded], [class*="dropdown"] button, svg[class*="chevron"]');
          if (menuBtn) {
            await menuBtn.click();
            await page.waitForTimeout(500);

            // Buscar "Descartar Test"
            const discardBtn = await page.$('text=Descartar Test');
            if (discardBtn) {
              await discardBtn.click();
              await page.waitForTimeout(500);

              // Confirmar si hay modal
              const confirmBtn = await page.$('text=Confirmar, text=Sí, text=Aceptar');
              if (confirmBtn) {
                await confirmBtn.click();
              }

              await page.waitForTimeout(2000);
              discardedCount++;
              console.log(`   ✅ Descartado (${discardedCount}/${maxDiscards})`);

              // Recargar página para actualizar lista
              await page.reload({ waitUntil: 'networkidle' });
              await page.waitForTimeout(2000);
              break;
            }
          }
        }
      }
    } catch (e) {
      console.log(`   ⚠️ Error descartando "${titlePart}": ${e.message}`);
    }
  }

  console.log(`\n✅ Tests descartados: ${discardedCount}`);

  // 3. Capturar exámenes faltantes
  if (discardedCount > 0) {
    console.log('\n' + '='.repeat(60));
    console.log('📥 CAPTURANDO EXÁMENES FALTANTES');
    console.log('='.repeat(60));

    for (const exam of EXAMS_TO_CAPTURE) {
      console.log(`\n📥 Buscando: ${exam.title}`);

      // Navegar al configurador
      await page.goto('https://aula.opositatest.com/classroom/test-configurator?mainContentId=7', {
        waitUntil: 'networkidle'
      });
      await page.waitForTimeout(2000);

      // Click en "Convocatorias anteriores"
      try {
        const convTab = await page.$('text=Convocatorias anteriores');
        if (convTab) {
          await convTab.click();
          await page.waitForTimeout(2000);
        }
      } catch (e) {}

      // Buscar el examen por texto
      try {
        const examLink = await page.$(`text=${exam.searchText}`);
        if (examLink) {
          await examLink.click();
          console.log(`   ✅ Click en "${exam.searchText}"`);
          await page.waitForTimeout(2000);

          // Buscar botón Empezar
          const startBtn = await page.$('text=Empezar');
          if (startBtn) {
            await startBtn.click();
            console.log(`   ✅ Click en Empezar`);
            await page.waitForTimeout(3000);

            // Terminar inmediatamente
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
        } else {
          console.log(`   ⚠️ No se encontró "${exam.searchText}"`);
        }
      } catch (e) {
        console.log(`   ❌ Error: ${e.message}`);
      }
    }
  }

  // 4. Guardar tests capturados
  console.log('\n' + '='.repeat(60));
  console.log('💾 GUARDANDO RESULTADOS');
  console.log('='.repeat(60));

  const outputDir = path.join(OUTPUT_BASE, 'convocatorias-anteriores');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  for (const [testId, testData] of capturedTests) {
    const title = testData.exam?.title || `test_${testId}`;
    const questions = (testData.questions || []).map((q, i) => {
      const correctIndex = q.answers?.findIndex(a => a.id === q.correctAnswerId);
      const letters = ['A', 'B', 'C', 'D'];
      return {
        id: q.id,
        position: i + 1,
        question: q.organization || '',
        options: (q.answers || []).map(a => ({
          id: a.id,
          text: a.declaration || '',
          isCorrect: a.id === q.correctAnswerId
        })),
        correctLetter: letters[correctIndex] || '?',
        explanation: q.reason || null,
        isAnnulled: q.isAnnulled || false
      };
    });

    const output = {
      metadata: { testId, title, type: 'previousCall' },
      scrapedAt: new Date().toISOString(),
      questionCount: questions.length,
      questions
    };

    const filename = title.replace(/[\/\\?%*:|"<>]/g, '').replace(/\s+/g, '_').substring(0, 80) + '.json';
    fs.writeFileSync(path.join(outputDir, filename), JSON.stringify(output, null, 2));
    console.log(`\n✅ Guardado: ${filename} (${questions.length} preguntas)`);
  }

  console.log('\n⏳ Navegador abierto para verificación manual.');
  console.log('   Presiona Ctrl+C para cerrar.\n');

  await new Promise(() => {});
}

main().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
