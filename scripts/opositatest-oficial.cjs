#!/usr/bin/env node
// Scraper de exámenes OFICIALES de OpositaTest
// Uso: node scripts/opositatest-oficial.cjs

const { chromium } = require('playwright');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const OFICIAL_URL = 'https://aula.opositatest.com/classroom/test-configurator?mainContentId=33&testType=oficial';
const OUTPUT_DIR = '/home/manuel/Documentos/github/vence/preguntas-para-subir/examenes-oficiales';
const USER_DATA_DIR = path.join(__dirname, '.opositatest-session');

let context = null;
let page = null;

const sleep = ms => new Promise(r => setTimeout(r, ms));

// Detectar ruta de Chrome
function getChromePath() {
  try {
    return execSync('which google-chrome || which google-chrome-stable || which chromium-browser || which chromium 2>/dev/null').toString().trim();
  } catch (e) {
    return '/usr/bin/google-chrome';
  }
}

// Inicializar navegador con sesión persistente
async function initBrowser() {
  console.log('\n🚀 Abriendo navegador...');

  const chromePath = getChromePath();
  console.log('🌐 Usando Chrome en:', chromePath);

  context = await chromium.launchPersistentContext(USER_DATA_DIR, {
    headless: false,
    slowMo: 100,
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

  page = context.pages()[0] || await context.newPage();

  // Ocultar que es automatizado
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
    delete navigator.__proto__.webdriver;
  });

  page.setDefaultTimeout(30000);
  console.log('✅ Navegador listo\n');
}

// Esperar a que el usuario inicie sesión
async function waitForLogin() {
  console.log('📝 Verificando sesión...');
  await page.goto('https://aula.opositatest.com', { waitUntil: 'domcontentloaded', timeout: 60000 });

  const url = page.url();
  if (url.includes('login')) {
    console.log('⚠️  No hay sesión. Inicia sesión manualmente en el navegador...');

    while (true) {
      await sleep(2000);
      const currentUrl = page.url();
      if (!currentUrl.includes('login') && currentUrl.includes('opositatest.com')) {
        break;
      }
    }
  }

  console.log('✅ Sesión activa\n');
}

// Extraer preguntas de la página de resultados
async function extractQuestions() {
  console.log('   📖 Expandiendo explicaciones...');

  const explanationButtons = await page.$$('.ExamQuestion-reason summary');
  for (let i = 0; i < explanationButtons.length; i++) {
    try {
      await explanationButtons[i].click();
      if (i % 10 === 0) await sleep(500);
    } catch (e) {}
  }
  await sleep(2000);
  console.log(`   ✅ ${explanationButtons.length} paneles expandidos`);

  // Extraer preguntas
  const questions = await page.evaluate(() => {
    const results = [];
    const questionDivs = document.querySelectorAll('[data-testid="question"]');

    questionDivs.forEach((questionDiv, idx) => {
      try {
        // Texto de la pregunta
        const questionTextEl = questionDiv.querySelector('.ExamQuestion-title-text span');
        const questionText = questionTextEl?.innerText?.trim() || '';

        // Opciones de respuesta
        const options = [];
        let correctAnswer = null;

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

          // Detectar respuesta correcta
          const labelEl = item.querySelector('.ExamQuestion-question');
          if (labelEl?.classList.contains('is-correct')) {
            correctAnswer = letter;
          }
        });

        // Explicación
        const explanationEl = questionDiv.querySelector('.ExamQuestion-reason-content span');
        let explanation = '';
        if (explanationEl) {
          explanation = explanationEl.innerText
            ?.replace(/https?:\/\/[^\s]+/g, '')
            ?.replace(/[ \t]+/g, ' ')
            ?.replace(/\n\s*\n/g, '\n')
            ?.trim() || '';
        }

        // Tema/categoría
        const topicEl = questionDiv.querySelector('.ExamQuestion-metainfo-left div');
        const topic = topicEl?.innerText?.trim() || '';

        if (questionText && options.length >= 2 && correctAnswer) {
          results.push({
            question: questionText,
            options: options,
            correctAnswer: correctAnswer,
            explanation: explanation || null,
            topic: topic
          });
        }
      } catch (e) {}
    });

    return results;
  });

  return questions;
}

// Guardar preguntas
function saveQuestions(questions, examName) {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const timestamp = new Date().toISOString().split('T')[0];
  const filename = `oficial_${timestamp}.json`;
  const filepath = path.join(OUTPUT_DIR, filename);

  const data = {
    tipo: 'examen_oficial',
    nombre: examName,
    source: 'opositatest',
    scrapedAt: new Date().toISOString(),
    questionCount: questions.length,
    questions: questions
  };

  fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
  console.log(`💾 Guardado: ${filepath}`);
  return filepath;
}

// Scrapear examen oficial
async function scrapeOficial() {
  console.log('🎯 Scrapeando examen OFICIAL...\n');

  // 1. Ir a la URL del examen oficial
  console.log('📄 Navegando al configurador oficial...');
  await page.goto(OFICIAL_URL, { waitUntil: 'networkidle', timeout: 60000 });

  // Esperar a que desaparezca el loading "Casi listo..."
  console.log('⏳ Esperando carga completa...');
  try {
    await page.waitForSelector('button:has-text("Empezar")', { timeout: 30000 });
  } catch (e) {
    // Esperar más si no aparece
    await sleep(10000);
  }
  await sleep(2000);

  // Debug: ver qué botones hay
  const buttons = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('button')).map(b => b.textContent.trim()).slice(0, 10);
  });
  console.log('🔍 Botones encontrados:', buttons);

  // Capturar screenshot para debug
  await page.screenshot({ path: 'debug-oficial.png', fullPage: true });
  console.log('📸 Screenshot guardado en debug-oficial.png');

  // 2. Click en "Empezar test"
  console.log('▶️  Buscando botón Empezar...');

  // Intentar varios selectores
  let clicked = false;

  // Método 1: Selector directo
  try {
    const empezarBtn = await page.$('button:has-text("Empezar test")');
    if (empezarBtn) {
      console.log('   ✓ Encontrado con selector directo');
      await empezarBtn.click();
      clicked = true;
    }
  } catch (e) {}

  // Método 2: Buscar por texto parcial
  if (!clicked) {
    try {
      const empezarBtn = await page.$('button:has-text("Empezar")');
      if (empezarBtn) {
        console.log('   ✓ Encontrado con texto parcial');
        await empezarBtn.click();
        clicked = true;
      }
    } catch (e) {}
  }

  // Método 3: Evaluate
  if (!clicked) {
    clicked = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const btn = buttons.find(b => b.textContent.toLowerCase().includes('empezar'));
      if (btn) {
        console.log('Botón encontrado:', btn.textContent);
        btn.click();
        return true;
      }
      return false;
    });
    if (clicked) console.log('   ✓ Encontrado con evaluate');
  }

  if (!clicked) {
    console.log('❌ No se encontró botón Empezar');
    return null;
  }

  // Esperar navegación
  console.log('⏳ Esperando navegación...');
  await sleep(5000);

  // 3. Verificar que estamos en la página del examen
  const examUrl = page.url();
  console.log(`📍 URL examen: ${examUrl}`);

  if (!examUrl.includes('/exams/take/')) {
    console.log('❌ No se pudo iniciar el examen');
    return null;
  }

  // 4. Click en "Terminar y corregir"
  console.log('⏹️  Terminando examen...');
  await page.waitForSelector('button:has-text("Terminar")', { timeout: 15000 });
  await page.click('button:has-text("Terminar")');
  await sleep(2000);

  // 5. Confirmar "Sí, quiero corregirlo"
  console.log('✓  Confirmando corrección...');
  try {
    await page.waitForSelector('button:has-text("Sí")', { timeout: 5000 });
    await page.click('button:has-text("Sí")');
  } catch (e) {
    // Intentar con otros textos
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const btn = buttons.find(b =>
        b.textContent.toLowerCase().includes('sí') ||
        b.textContent.toLowerCase().includes('corregir')
      );
      if (btn) btn.click();
    });
  }
  await sleep(3000);

  // 6. Esperar página de resultados
  const resultsUrl = page.url();
  console.log(`📍 URL resultados: ${resultsUrl}`);

  if (!resultsUrl.includes('/test-results/')) {
    console.log('❌ No se llegó a la página de resultados');
    return null;
  }

  // 7. Esperar a que carguen las preguntas
  console.log('⏳ Esperando carga de resultados...');
  await page.waitForSelector('[data-testid="question"]', { timeout: 20000 });
  await sleep(2000);

  // 8. Extraer preguntas
  console.log('🔍 Extrayendo preguntas...');
  const questions = await extractQuestions();
  console.log(`✅ ${questions.length} preguntas extraídas`);

  // 9. Guardar
  if (questions.length > 0) {
    const examId = resultsUrl.split('/').pop();
    saveQuestions(questions, `Examen Oficial - ${examId}`);
  }

  // Resumen por tema
  console.log('\n📊 RESUMEN POR TEMA:');
  const byTopic = {};
  questions.forEach(q => {
    const topic = q.topic || 'Sin tema';
    byTopic[topic] = (byTopic[topic] || 0) + 1;
  });
  Object.entries(byTopic).sort((a, b) => b[1] - a[1]).forEach(([topic, count]) => {
    console.log(`   ${count} - ${topic.substring(0, 60)}`);
  });

  return questions;
}

// Main
async function main() {
  try {
    await initBrowser();
    await waitForLogin();

    console.log('═'.repeat(50));
    console.log('📋 SCRAPER DE EXÁMENES OFICIALES');
    console.log('═'.repeat(50));

    const questions = await scrapeOficial();

    if (questions && questions.length > 0) {
      console.log(`\n🎉 ¡Completado! ${questions.length} preguntas oficiales extraídas`);
    } else {
      console.log('\n❌ No se pudieron extraer preguntas');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    if (context) {
      await context.close();
    }
    process.exit(0);
  }
}

main();
