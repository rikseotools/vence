// scripts/opositatest-scraper.js
// Scraper para extraer tests propios de OpositaTest usando Playwright
// Uso:
//   1. Primera vez: node scripts/opositatest-scraper.js --login
//   2. Despues:     node scripts/opositatest-scraper.js <url-del-test>

const { chromium } = require('playwright');
const path = require('path');

// Configuracion
const CONFIG = {
  headless: false, // true para ejecutar sin ventana visible
  slowMo: 100, // ms entre acciones
  userDataDir: path.join(__dirname, '.opositatest-session') // Carpeta para guardar sesion
};

// Modo login: usa tu Chrome real para evitar bloqueo de Google
async function loginMode() {
  console.log('🔐 MODO LOGIN - Usando tu Chrome real');
  console.log('');
  console.log('👉 Se abrira Chrome. Haz login con Google en OpositaTest.');
  console.log('👉 Cuando estes en el dashboard, cierra el navegador.');
  console.log('');

  // Detectar ruta de Chrome en Linux
  const { execSync } = require('child_process');
  let chromePath;
  try {
    chromePath = execSync('which google-chrome || which google-chrome-stable || which chromium-browser || which chromium 2>/dev/null').toString().trim();
  } catch (e) {
    chromePath = '/usr/bin/google-chrome';
  }

  console.log('🌐 Usando Chrome en:', chromePath);

  const context = await chromium.launchPersistentContext(CONFIG.userDataDir, {
    headless: false,
    slowMo: CONFIG.slowMo,
    viewport: { width: 1280, height: 800 },
    executablePath: chromePath,
    channel: 'chrome', // Usar Chrome instalado
    args: [
      '--disable-blink-features=AutomationControlled',
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-infobars'
    ],
    ignoreDefaultArgs: ['--enable-automation']
  });

  const page = await context.newPage();

  // Ocultar que es automatizado
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
    delete navigator.__proto__.webdriver;
  });

  await page.goto('https://aula.opositatest.com/login');

  console.log('⏳ Esperando a que hagas login y cierres el navegador...');

  // Esperar a que el usuario cierre el navegador
  await new Promise((resolve) => {
    context.on('close', resolve);
  });

  console.log('✅ Sesion guardada! Ahora puedes ejecutar el scraper con una URL.');
  return;
}

async function scrapeTest(testUrl) {
  console.log('🚀 Iniciando scraper de OpositaTest...');
  console.log('📍 URL:', testUrl);

  // Detectar ruta de Chrome
  const { execSync } = require('child_process');
  let chromePath;
  try {
    chromePath = execSync('which google-chrome || which google-chrome-stable || which chromium-browser || which chromium 2>/dev/null').toString().trim();
  } catch (e) {
    chromePath = '/usr/bin/google-chrome';
  }

  // Usar contexto persistente (sesion guardada)
  const context = await chromium.launchPersistentContext(CONFIG.userDataDir, {
    headless: CONFIG.headless,
    slowMo: CONFIG.slowMo,
    viewport: { width: 1280, height: 800 },
    executablePath: chromePath,
    channel: 'chrome',
    args: [
      '--disable-blink-features=AutomationControlled',
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-infobars'
    ],
    ignoreDefaultArgs: ['--enable-automation']
  });

  const page = await context.newPage();

  // Ocultar que es automatizado
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
  });

  try {
    // Verificar si hay sesion activa
    console.log('🔍 Verificando sesion...');
    await page.goto('https://aula.opositatest.com/dashboard', { waitUntil: 'networkidle' });

    const currentUrl = page.url();
    if (currentUrl.includes('login')) {
      console.log('❌ No hay sesion activa. Ejecuta primero: node scripts/opositatest-scraper.js --login');
      await context.close();
      process.exit(1);
    }

    console.log('✅ Sesion activa detectada');

    // 4. Navegar al test
    console.log('📄 Navegando al test...');
    await page.goto(testUrl, { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);

    // Verificar si nos redirigieron a login
    if (page.url().includes('login')) {
      console.log('🔐 Sesion expirada, reautenticando con Google...');

      // Hacer clic en "Continuar con Google"
      const googleBtn = await page.$('text=Continuar con Google');
      if (googleBtn) {
        await googleBtn.click();
        console.log('   Clic en "Continuar con Google"...');
        await page.waitForTimeout(3000);

        // Buscar y hacer clic en "Continuar como [nombre]" en el popup de Google
        const continueBtn = await page.$('text=Continuar como');
        if (continueBtn) {
          await continueBtn.click();
          console.log('   Clic en "Continuar como Manuel"...');
          await page.waitForTimeout(5000);
        }

        // Esperar a que vuelva a la pagina del test
        await page.waitForURL('**/test-results/**', { timeout: 30000 }).catch(() => {
          console.log('⚠️ No redirigido automaticamente, navegando manualmente...');
        });

        // Navegar al test de nuevo
        await page.goto(testUrl, { waitUntil: 'networkidle' });
        await page.waitForTimeout(3000);
      }
    }

    // Esperar a que cargue el contenido
    console.log('⏳ Esperando a que cargue el contenido...');
    await page.waitForTimeout(5000);

    // Esperar a que aparezca algun elemento de pregunta
    try {
      await page.waitForSelector('.ExamQuestion, .question, [class*="question"], [class*="Question"]', { timeout: 20000 });
      console.log('✅ Contenido de preguntas detectado');
    } catch (e) {
      console.log('⚠️ No se detecto selector de preguntas, esperando mas...');
      await page.waitForTimeout(10000);
    }

    // 5. Debug: capturar screenshot y HTML
    console.log('📸 Capturando screenshot para debug...');
    await page.screenshot({ path: 'debug-opositatest.png', fullPage: true });

    const html = await page.content();
    const fsDebug = require('fs');
    fsDebug.writeFileSync('debug-opositatest.html', html);
    console.log('📄 HTML guardado en debug-opositatest.html');

    // Debug: buscar clases disponibles
    const debugInfo = await page.evaluate(() => {
      const allClasses = [...new Set([...document.querySelectorAll('*')].flatMap(el => [...el.classList]))];
      const examClasses = allClasses.filter(c => c.toLowerCase().includes('exam') || c.toLowerCase().includes('question') || c.toLowerCase().includes('test'));
      return {
        totalElements: document.querySelectorAll('*').length,
        examClasses: examClasses.slice(0, 30),
        bodyText: document.body.innerText.slice(0, 500)
      };
    });

    console.log('🔍 Debug info:');
    console.log('   Elementos totales:', debugInfo.totalElements);
    console.log('   Clases relacionadas:', debugInfo.examClasses);
    console.log('   Texto inicial:', debugInfo.bodyText.slice(0, 200) + '...');

    // 6. Expandir explicaciones y extraer preguntas
    console.log('📖 Expandiendo explicaciones...');
    const explanationButtons = await page.$$('.ExamQuestion-reason summary');
    for (let i = 0; i < explanationButtons.length; i++) {
      try {
        await explanationButtons[i].click();
        if (i % 10 === 0) await page.waitForTimeout(500);
      } catch (e) {}
    }
    await page.waitForTimeout(2000);
    console.log(`   ✅ ${explanationButtons.length} paneles expandidos`);

    console.log('🔍 Extrayendo preguntas...');

    const questions = await page.evaluate(() => {
      const results = [];

      // Buscar todos los contenedores de preguntas por su ID
      const questionDivs = document.querySelectorAll('[data-testid="question"]');

      questionDivs.forEach((questionDiv, idx) => {
        try {
          // Numero de pregunta
          const titleEl = questionDiv.querySelector('.ExamQuestion-title[data-question-index]');
          const questionIndex = titleEl?.getAttribute('data-question-index') || (idx + 1).toString();

          // Texto de la pregunta - esta en .ExamQuestion-title-text span
          const questionTextEl = questionDiv.querySelector('.ExamQuestion-title-text span');
          const questionText = questionTextEl?.innerText?.trim() || '';

          // Opciones de respuesta
          const options = [];
          let correctAnswer = null;
          let userAnswer = null;

          const listItems = questionDiv.querySelectorAll('.List-item');
          listItems.forEach((item) => {
            const input = item.querySelector('input[data-answer-index]');
            const letter = input?.getAttribute('data-answer-index') || '';
            const labelSpan = item.querySelector('.ExamQuestion-question-label span');
            const optionText = labelSpan?.innerText?.trim() || '';

            options.push({
              letter: letter,
              text: optionText
            });

            // Detectar respuesta correcta y del usuario
            const labelEl = item.querySelector('.ExamQuestion-question');
            if (labelEl?.classList.contains('is-correct')) {
              correctAnswer = letter;
            }
            if (labelEl?.classList.contains('is-checked')) {
              userAnswer = letter;
            }
          });

          // Explicacion: convertir HTML a texto legible (tablas, listas, etc.)
          const explanationEl = questionDiv.querySelector('.ExamQuestion-reason-content span');
          let explanation = '';
          if (explanationEl) {
            const htmlToText = (el) => {
              let text = '';
              const walk = (node) => {
                if (node.nodeType === 3) {
                  text += node.textContent;
                } else if (node.nodeType === 1) {
                  const tag = node.tagName.toLowerCase();
                  if (tag === 'a') return;
                  if (tag === 'table') {
                    const rows = node.querySelectorAll('tr');
                    rows.forEach((row) => {
                      const cells = row.querySelectorAll('td, th');
                      const cellTexts = [...cells].map(c => c.innerText.trim());
                      text += cellTexts.join(' | ') + '\n';
                    });
                    return;
                  }
                  if (tag === 'li') text += '• ';
                  node.childNodes.forEach(walk);
                  if (['p', 'br', 'li', 'tr', 'div'].includes(tag)) text += '\n';
                }
              };
              walk(el);
              return text;
            };
            explanation = htmlToText(explanationEl)
              .replace(/https?:\/\/[^\s]+/g, '')
              .replace(/[ \t]+/g, ' ')
              .replace(/\n\s*\n/g, '\n')
              .trim();
          }

          // Tema/Categoria
          const topicEl = questionDiv.querySelector('.ExamQuestion-metainfo-left div');
          const topic = topicEl?.innerText?.trim() || '';

          // Determinar si acerto
          const isCorrect = userAnswer === correctAnswer;

          results.push({
            index: parseInt(questionIndex),
            question: questionText,
            options: options,
            correctAnswer: correctAnswer,
            userAnswer: userAnswer,
            isCorrect: isCorrect,
            explanation: explanation,
            topic: topic
          });

        } catch (err) {
          console.error('Error procesando pregunta:', idx, err);
        }
      });

      return results;
    });

    console.log(`✅ Extraidas ${questions.length} preguntas`);

    // 6. Estadisticas
    const correct = questions.filter(q => q.isCorrect).length;
    const incorrect = questions.filter(q => !q.isCorrect && q.userAnswer).length;
    const unanswered = questions.filter(q => !q.userAnswer).length;

    const result = {
      url: testUrl,
      scrapedAt: new Date().toISOString(),
      stats: {
        total: questions.length,
        correct: correct,
        incorrect: incorrect,
        unanswered: unanswered,
        score: questions.length > 0 ? Math.round((correct / questions.length) * 100) : 0
      },
      questions: questions
    };

    // 7. Guardar resultado
    const fs = require('fs');
    const outputDir = '/home/manuel/Documentos/github/vence/preguntas-para-subir';

    // Crear carpeta si no existe
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Usar el tema de la primera pregunta como nombre del archivo
    const topic = questions[0]?.topic || 'opositatest';
    const safeTopic = topic
      .replace(/[\/\\?%*:|"<>]/g, '-')  // Reemplazar caracteres no validos
      .replace(/\s+/g, '_')              // Espacios por guiones bajos
      .substring(0, 100);                 // Limitar longitud

    const filename = `${outputDir}/${safeTopic}.json`;
    fs.writeFileSync(filename, JSON.stringify(result, null, 2));
    console.log(`💾 Guardado en: ${filename}`);

    // Mostrar resumen
    console.log('\n📊 RESUMEN:');
    console.log(`   Total: ${result.stats.total} preguntas`);
    console.log(`   ✅ Correctas: ${result.stats.correct}`);
    console.log(`   ❌ Incorrectas: ${result.stats.incorrect}`);
    console.log(`   ⏭️ Sin responder: ${result.stats.unanswered}`);
    console.log(`   📈 Puntuacion: ${result.stats.score}%`);

    return result;

  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  }

  return { context, page }; // Devolver para reutilizar
}

// Ejecucion interactiva con navegador persistente
const readline = require('readline');

async function main() {
  const arg = process.argv[2];

  // Si pasan --login directamente
  if (arg === '--login') {
    await loginMode();
    process.exit(0);
  }

  console.log('');
  console.log('📋 Scraper de OpositaTest');
  console.log('─'.repeat(40));
  console.log('Escribe "salir" para cerrar\n');

  // Abrir navegador una sola vez
  console.log('🚀 Abriendo navegador...');

  const { execSync } = require('child_process');
  let chromePath;
  try {
    chromePath = execSync('which google-chrome || which google-chrome-stable || which chromium-browser || which chromium 2>/dev/null').toString().trim();
  } catch (e) {
    chromePath = '/usr/bin/google-chrome';
  }

  const context = await chromium.launchPersistentContext(CONFIG.userDataDir, {
    headless: CONFIG.headless,
    slowMo: CONFIG.slowMo,
    viewport: { width: 1280, height: 800 },
    executablePath: chromePath,
    channel: 'chrome',
    args: [
      '--disable-blink-features=AutomationControlled',
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-infobars'
    ],
    ignoreDefaultArgs: ['--enable-automation']
  });

  const page = await context.newPage();
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
  });

  console.log('✅ Navegador listo\n');

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const ask = (question) => new Promise((resolve) => rl.question(question, resolve));

  // Bucle para scrapear multiples URLs
  while (true) {
    const url = await ask('🔗 URL del test (o "salir"): ');

    if (url.toLowerCase() === 'salir' || url.toLowerCase() === 'exit') {
      break;
    }

    if (!url || !url.includes('opositatest.com')) {
      console.log('❌ URL no valida, intenta de nuevo\n');
      continue;
    }

    try {
      await scrapeTestWithPage(page, url.trim());
    } catch (e) {
      console.error('❌ Error:', e.message);
    }
    console.log('');
  }

  rl.close();
  await context.close();
  console.log('🏁 Navegador cerrado. Hasta luego!');
}

// Version que recibe page ya abierto
async function scrapeTestWithPage(page, testUrl) {
  console.log('📄 Navegando al test...');
  await page.goto(testUrl, { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);

  // Verificar si nos redirigieron a login
  if (page.url().includes('login')) {
    console.log('🔐 Sesion expirada, reautenticando con Google...');
    const googleBtn = await page.$('text=Continuar con Google');
    if (googleBtn) {
      await googleBtn.click();
      await page.waitForTimeout(3000);
      const continueBtn = await page.$('text=Continuar como');
      if (continueBtn) {
        await continueBtn.click();
        await page.waitForTimeout(5000);
      }
      await page.goto(testUrl, { waitUntil: 'networkidle' });
      await page.waitForTimeout(3000);
    }
  }

  // Esperar contenido
  console.log('⏳ Esperando contenido...');
  await page.waitForTimeout(5000);

  // Debug: verificar URL actual y contenido
  console.log('   📍 URL actual:', page.url());

  try {
    await page.waitForSelector('[data-testid="question"]', { timeout: 20000 });
    console.log('   ✅ Selector de preguntas encontrado');
  } catch (e) {
    console.log('   ⚠️  Selector no encontrado, esperando más...');
    await page.waitForTimeout(10000);

    // Debug: capturar screenshot y HTML
    await page.screenshot({ path: 'debug-scraper.png', fullPage: true });
    const fs = require('fs');
    fs.writeFileSync('debug-scraper.html', await page.content());
    console.log('   📸 Debug guardado en debug-scraper.png y debug-scraper.html');

    // Verificar cuántos elementos hay
    const questionCount = await page.$$eval('[data-testid="question"]', els => els.length).catch(() => 0);
    console.log('   🔍 Preguntas encontradas:', questionCount);
  }

  // Expandir todos los paneles de explicación para que carguen el contenido
  console.log('📖 Expandiendo explicaciones...');
  const explanationButtons = await page.$$('.ExamQuestion-reason summary');
  for (let i = 0; i < explanationButtons.length; i++) {
    try {
      await explanationButtons[i].click();
      // Pequeña pausa para que cargue el contenido
      if (i % 10 === 0) {
        await page.waitForTimeout(500);
      }
    } catch (e) {}
  }
  // Esperar a que carguen todas las explicaciones
  await page.waitForTimeout(2000);
  console.log(`   ✅ ${explanationButtons.length} paneles expandidos`);

  // Extraer preguntas
  console.log('🔍 Extrayendo preguntas...');
  const questions = await page.evaluate(() => {
    const results = [];
    const questionDivs = document.querySelectorAll('[data-testid="question"]');

    questionDivs.forEach((questionDiv, idx) => {
      try {
        const titleEl = questionDiv.querySelector('.ExamQuestion-title[data-question-index]');
        const questionIndex = titleEl?.getAttribute('data-question-index') || (idx + 1).toString();
        const questionTextEl = questionDiv.querySelector('.ExamQuestion-title-text span');
        const questionText = questionTextEl?.innerText?.trim() || '';

        const options = [];
        let correctAnswer = null;
        let userAnswer = null;

        const listItems = questionDiv.querySelectorAll('.List-item');
        listItems.forEach((item) => {
          const input = item.querySelector('input[data-answer-index]');
          const letter = input?.getAttribute('data-answer-index') || '';
          const labelSpan = item.querySelector('.ExamQuestion-question-label span');
          const optionText = labelSpan?.innerText?.trim() || '';

          options.push({ letter, text: optionText });

          const labelEl = item.querySelector('.ExamQuestion-question');
          if (labelEl?.classList.contains('is-correct')) correctAnswer = letter;
          if (labelEl?.classList.contains('is-checked')) userAnswer = letter;
        });

        const explanationEl = questionDiv.querySelector('.ExamQuestion-reason-content span');
        // Convertir HTML a texto legible (tablas, listas, etc.)
        let explanation = '';
        if (explanationEl) {
          // Función para convertir HTML a texto
          const htmlToText = (el) => {
            let text = '';
            const walk = (node) => {
              if (node.nodeType === 3) { // Text node
                text += node.textContent;
              } else if (node.nodeType === 1) { // Element node
                const tag = node.tagName.toLowerCase();

                // Saltar enlaces (URLs)
                if (tag === 'a') return;

                // Tablas: convertir a formato legible
                if (tag === 'table') {
                  const rows = node.querySelectorAll('tr');
                  rows.forEach((row, ri) => {
                    const cells = row.querySelectorAll('td, th');
                    const cellTexts = [...cells].map(c => c.innerText.trim());
                    text += cellTexts.join(' | ') + '\n';
                  });
                  return;
                }

                // Listas
                if (tag === 'li') {
                  text += '• ';
                }

                // Procesar hijos
                node.childNodes.forEach(walk);

                // Saltos de línea
                if (['p', 'br', 'li', 'tr', 'div'].includes(tag)) {
                  text += '\n';
                }
              }
            };
            walk(el);
            return text;
          };

          explanation = htmlToText(explanationEl)
            .replace(/https?:\/\/[^\s]+/g, '') // Quitar URLs restantes
            .replace(/[ \t]+/g, ' ')           // Espacios múltiples a uno
            .replace(/\n\s*\n/g, '\n')         // Líneas vacías múltiples
            .trim();
        }
        const topicEl = questionDiv.querySelector('.ExamQuestion-metainfo-left div');
        const topic = topicEl?.innerText?.trim() || '';

        results.push({
          index: parseInt(questionIndex),
          question: questionText,
          options,
          correctAnswer,
          userAnswer,
          isCorrect: userAnswer === correctAnswer,
          explanation,
          topic
        });
      } catch (err) {}
    });

    return results;
  });

  console.log(`✅ Extraidas ${questions.length} preguntas`);

  // Estadisticas
  const correct = questions.filter(q => q.isCorrect).length;
  const incorrect = questions.filter(q => !q.isCorrect && q.userAnswer).length;
  const withExplanation = questions.filter(q => q.explanation && q.explanation.trim() !== '').length;
  const withoutExplanation = questions.filter(q => !q.explanation || q.explanation.trim() === '');
  console.log(`📖 Con explicación: ${withExplanation}/${questions.length}`);

  // Listar preguntas sin explicación
  if (withoutExplanation.length > 0) {
    console.log(`\n⚠️  PREGUNTAS SIN EXPLICACIÓN (${withoutExplanation.length}):`);
    withoutExplanation.forEach((q, i) => {
      console.log(`   ${i + 1}. ${q.question.substring(0, 60)}...`);
    });
  }

  const result = {
    url: testUrl,
    scrapedAt: new Date().toISOString(),
    stats: { total: questions.length, correct, incorrect, score: questions.length > 0 ? Math.round((correct / questions.length) * 100) : 0 },
    questions
  };

  // Guardar resultado organizado por tema
  const fs = require('fs');
  const path = require('path');
  const baseDir = '/home/manuel/Documentos/github/vence/preguntas-para-subir';

  // Parsear topic: "Subtema / Tema Principal / Categoría"
  const topic = questions[0]?.topic || 'opositatest';
  const parts = topic.split('/').map(p => p.trim());

  // Crear carpeta por tema principal (ej: "Tema 1. Informática básica")
  const mainTopic = parts[1] || parts[0] || 'otros';
  const safeMainTopic = mainTopic.replace(/[\/\\?%*:|"<>]/g, '-').replace(/\./g, '_').replace(/\s+/g, '_');
  const topicDir = path.join(baseDir, safeMainTopic);
  if (!fs.existsSync(topicDir)) fs.mkdirSync(topicDir, { recursive: true });

  // Nombre del archivo: subtema
  const subtopic = parts[0] || 'preguntas';
  const safeSubtopic = subtopic.replace(/[\/\\?%*:|"<>]/g, '-').replace(/\s+/g, '_').substring(0, 80);
  const filename = path.join(topicDir, `${safeSubtopic}.json`);

  fs.writeFileSync(filename, JSON.stringify(result, null, 2));
  console.log(`💾 Guardado: ${safeMainTopic}/${safeSubtopic}.json`);
  console.log(`📊 Resultado: ${correct}/${questions.length} (${result.stats.score}%)`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('❌ Error:', e.message);
    process.exit(1);
  });
