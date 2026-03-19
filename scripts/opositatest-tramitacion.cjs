#!/usr/bin/env node
// Scraper para Tramitación Procesal (estructura plana: temas → epígrafes)
// Uso: node scripts/opositatest-tramitacion.cjs

const { chromium } = require('playwright');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const BASE_URL = 'https://aula.opositatest.com/classroom/test-configurator?mainContentId=7';
const OUTPUT_DIR = '/home/manuel/Documentos/github/vence/preguntas-para-subir/tramitacion-procesal';
const USER_DATA_DIR = path.join(__dirname, '.opositatest-session');
const PROGRESS_FILE = path.join(__dirname, 'scrape-progress-tramitacion.json');

// Progreso
function loadProgress() {
  try {
    if (fs.existsSync(PROGRESS_FILE)) {
      return JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf-8'));
    }
  } catch (e) {}
  return { temas: [], scrapeados: {} };
}

function saveProgress(progress) {
  progress.lastUpdate = new Date().toISOString();
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

let context = null;
let page = null;

const sleep = ms => new Promise(r => setTimeout(r, ms));

const sanitizeFilename = (name) => {
  return name.replace(/[<>:"/\\|?*]/g, '').replace(/\s+/g, '_').substring(0, 100);
};

function getChromePath() {
  try {
    return execSync('which google-chrome || which google-chrome-stable || which chromium-browser || which chromium 2>/dev/null').toString().trim();
  } catch (e) {
    return '/usr/bin/google-chrome';
  }
}

async function initBrowser() {
  console.log('\n🚀 Abriendo navegador...');
  const chromePath = getChromePath();

  context = await chromium.launchPersistentContext(USER_DATA_DIR, {
    headless: false,
    slowMo: 100,
    viewport: { width: 1280, height: 900 },
    executablePath: chromePath,
    channel: 'chrome',
    args: ['--disable-blink-features=AutomationControlled', '--no-first-run', '--disable-infobars'],
    ignoreDefaultArgs: ['--enable-automation']
  });

  page = context.pages()[0] || await context.newPage();
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
  });
  page.setDefaultTimeout(30000);
  console.log('✅ Navegador listo\n');
}

async function waitForLogin() {
  console.log('📝 Verificando sesión...');
  await page.goto('https://aula.opositatest.com', { waitUntil: 'domcontentloaded', timeout: 60000 });

  if (page.url().includes('login')) {
    console.log('⚠️  No hay sesión. Inicia sesión manualmente...');
    while (page.url().includes('login')) {
      await sleep(2000);
    }
  }
  console.log('✅ Sesión activa\n');
}

async function goToConfigurator() {
  console.log('   🔄 Navegando al configurador...');
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await sleep(1500);

  // Cerrar modal si aparece
  try {
    await page.keyboard.press('Escape');
    await sleep(500);
  } catch (e) {}

  // Seleccionar "Personalizado"
  try {
    await page.click('#exam-random', { timeout: 3000 });
  } catch (e) {
    try {
      await page.click('label:has-text("Personalizado")', { timeout: 3000 });
    } catch (e2) {}
  }
  await sleep(500);

  // 100 preguntas
  try {
    await page.fill('[data-testid="num-of-questions-value"]', '100');
  } catch (e) {}
  await sleep(500);

  // Continuar
  try {
    await page.click('button:has-text("Continuar")', { timeout: 5000 });
  } catch (e) {}
  await sleep(2000);
}

// Obtener lista de temas con "Configurar epígrafes" o "Configurar bloques"
async function getTemas() {
  const temas = await page.evaluate(() => {
    const results = [];
    const buttons = document.querySelectorAll('button');
    let idxEpigrafes = 0;
    let idxBloques = 0;

    buttons.forEach((btn) => {
      const btnText = btn.textContent.trim();

      if (btnText === 'Configurar epígrafes') {
        const container = btn.closest('[data-testid^="list-item-"]');
        if (container) {
          const title = container.querySelector('.ContentSelectorItem-title')?.textContent?.trim() || '';
          const text = container.textContent || '';
          const match = text.match(/(\d+)\/(\d+)\s*epígrafes/i);

          if (title) {
            results.push({
              index: idxEpigrafes,
              title: title,
              epigrafesCount: match ? parseInt(match[2]) : 0,
              type: 'epigrafes'
            });
          }
          idxEpigrafes++;
        }
      } else if (btnText === 'Configurar bloques' || btnText === 'Configurar bloque') {
        const container = btn.closest('[data-testid^="list-item-"]');
        if (container) {
          const title = container.querySelector('.ContentSelectorItem-title')?.textContent?.trim() || '';
          const text = container.textContent || '';
          const match = text.match(/(\d+)\/(\d+)\s*bloques?/i);

          if (title) {
            results.push({
              index: idxBloques,
              title: title,
              epigrafesCount: match ? parseInt(match[2]) : 0,
              type: 'bloques'
            });
          }
          idxBloques++;
        }
      }
    });
    return results;
  });
  return temas;
}

// Obtener epígrafes de un tema
async function getEpigrafes() {
  const epigrafes = await page.evaluate(() => {
    const results = [];
    const checkboxes = document.querySelectorAll('[data-testid^="list-item-"] input[type="checkbox"]');

    checkboxes.forEach((checkbox, idx) => {
      const container = checkbox.closest('[data-testid^="list-item-"]');
      if (container) {
        const title = container.querySelector('.ContentSelectorItem-title')?.textContent?.trim();
        if (title) {
          results.push({ index: idx, title: title });
        }
      }
    });
    return results;
  });
  return epigrafes;
}

// Extraer preguntas
async function extractQuestions() {
  console.log('   📖 Expandiendo explicaciones...');

  const explanationButtons = await page.$$('.ExamQuestion-reason summary');
  for (let i = 0; i < explanationButtons.length; i++) {
    try {
      await explanationButtons[i].click();
      if (i % 10 === 0) await sleep(300);
    } catch (e) {}
  }
  await sleep(1500);

  const questions = await page.evaluate(() => {
    const results = [];
    const questionDivs = document.querySelectorAll('[data-testid="question"]');

    questionDivs.forEach((questionDiv) => {
      try {
        const questionText = questionDiv.querySelector('.ExamQuestion-title-text span')?.innerText?.trim() || '';
        const options = [];
        let correctAnswer = null;

        questionDiv.querySelectorAll('.List-item').forEach((item) => {
          const input = item.querySelector('input[data-answer-index]');
          const letter = input?.getAttribute('data-answer-index') || '';
          const optionText = item.querySelector('.ExamQuestion-question-label span')?.innerText?.trim() || '';
          options.push({ letter, text: optionText });

          if (item.querySelector('.ExamQuestion-question')?.classList.contains('is-correct')) {
            correctAnswer = letter;
          }
        });

        const explanation = questionDiv.querySelector('.ExamQuestion-reason-content span')?.innerText
          ?.replace(/https?:\/\/[^\s]+/g, '')
          ?.replace(/[ \t]+/g, ' ')
          ?.trim() || '';

        if (questionText && options.length >= 2 && correctAnswer) {
          results.push({ question: questionText, options, correctAnswer, explanation: explanation || null });
        }
      } catch (e) {}
    });
    return results;
  });

  return questions;
}

function saveQuestions(questions, tema, epigrafe) {
  const temaDir = path.join(OUTPUT_DIR, sanitizeFilename(tema));
  if (!fs.existsSync(temaDir)) {
    fs.mkdirSync(temaDir, { recursive: true });
  }

  const filename = sanitizeFilename(epigrafe) + '.json';
  const filepath = path.join(temaDir, filename);

  fs.writeFileSync(filepath, JSON.stringify({
    tema, subtema: epigrafe, source: 'opositatest',
    scrapedAt: new Date().toISOString(),
    questionCount: questions.length,
    questions
  }, null, 2));

  console.log(`   💾 Guardado: ${questions.length} preguntas`);
  return filepath;
}

// Scrapear un tema completo
async function scrapeTema(temaIdx) {
  const progress = loadProgress();

  await goToConfigurator();
  const temas = await getTemas();

  if (temaIdx < 0 || temaIdx >= temas.length) {
    console.log(`❌ Tema ${temaIdx + 1} no existe. Hay ${temas.length} temas.`);
    return;
  }

  const tema = temas[temaIdx];
  const tipoLabel = tema.type === 'bloques' ? 'bloques' : 'epígrafes';
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`📚 TEMA ${temaIdx + 1}: ${tema.title}`);
  console.log(`   Tipo: ${tipoLabel}`);
  console.log(`${'═'.repeat(60)}`);

  // Click en el botón correspondiente según el tipo
  const buttonSelector = tema.type === 'bloques'
    ? 'button:has-text("Configurar bloque")'
    : 'button:has-text("Configurar epígrafes")';
  const buttons = await page.$$(buttonSelector);
  if (buttons[tema.index]) {
    await buttons[tema.index].click();
  }
  await sleep(2000);

  // Obtener epígrafes
  const epigrafes = await getEpigrafes();
  console.log(`   📄 ${epigrafes.length} epígrafes encontrados\n`);

  for (let i = 0; i < epigrafes.length; i++) {
    const epigrafe = epigrafes[i];
    const key = `${tema.title}::${epigrafe.title}`;

    if (progress.scrapeados[key]) {
      console.log(`   ⏭️ [${i + 1}/${epigrafes.length}] ${epigrafe.title} (ya hecho)`);
      continue;
    }

    console.log(`\n   🎯 [${i + 1}/${epigrafes.length}] ${epigrafe.title}`);

    try {
      // Seleccionar solo este epígrafe
      const checkboxes = await page.$$('[data-testid^="list-item-"] input[type="checkbox"]');
      if (checkboxes[i]) {
        await checkboxes[i].click();
      }
      await sleep(500);

      // Confirmar
      try {
        await page.click('button:has-text("Confirmar")', { timeout: 3000 });
      } catch (e) {
        await page.click('button:has-text("Continuar")', { timeout: 3000 });
      }
      await sleep(2000);

      // Empezar test
      await page.click('button:has-text("Empezar")', { timeout: 5000 });
      await sleep(3000);

      // Terminar
      await page.click('button:has-text("Terminar")', { timeout: 10000 });
      await sleep(2000);

      // Confirmar corrección
      try {
        await page.click('button:has-text("Sí")', { timeout: 5000 });
      } catch (e) {}
      await sleep(3000);

      // Esperar resultados
      await page.waitForSelector('[data-testid="question"]', { timeout: 15000 });

      // Extraer
      const questions = await extractQuestions();
      console.log(`   ✅ ${questions.length} preguntas extraídas`);

      if (questions.length > 0) {
        saveQuestions(questions, tema.title, epigrafe.title);
        progress.scrapeados[key] = { done: true, questions: questions.length, date: new Date().toISOString() };
        saveProgress(progress);
      }

      // Volver para siguiente epígrafe/bloque
      if (i < epigrafes.length - 1) {
        await goToConfigurator();
        const btns = await page.$$(buttonSelector);
        if (btns[tema.index]) await btns[tema.index].click();
        await sleep(2000);
      }

    } catch (error) {
      console.error(`   ❌ Error: ${error.message}`);
      // Intentar recuperar
      try {
        await goToConfigurator();
        const btns = await page.$$(buttonSelector);
        if (btns[tema.index]) await btns[tema.index].click();
        await sleep(2000);
      } catch (e) {}
    }
  }

  console.log(`\n✅ Tema completado\n`);
}

// Escanear estructura
async function escanear() {
  console.log('\n📊 ESCANEANDO ESTRUCTURA...\n');
  await goToConfigurator();

  const temas = await getTemas();
  const progress = loadProgress();
  progress.temas = temas;
  saveProgress(progress);

  console.log(`📚 ${temas.length} TEMAS ENCONTRADOS:\n`);

  for (let i = 0; i < temas.length; i++) {
    const tema = temas[i];
    const tipoLabel = tema.type === 'bloques' ? 'bloques' : 'epígrafes';
    // Contar epígrafes/bloques scrapeados
    let scrapeados = 0;
    for (const key of Object.keys(progress.scrapeados)) {
      if (key.startsWith(tema.title + '::')) scrapeados++;
    }

    const status = scrapeados === tema.epigrafesCount && tema.epigrafesCount > 0 ? '✅' :
                   scrapeados > 0 ? '🔄' : '⏳';
    console.log(`  ${status} [${i + 1}] ${tema.title}`);
    console.log(`       ${scrapeados}/${tema.epigrafesCount} ${tipoLabel}`);
  }

  console.log(`\n💡 Usa: scrapear <número> (ej: scrapear 1)\n`);
}

// Menú interactivo
async function menu() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ask = (q) => new Promise(r => rl.question(q, r));

  console.log('\n📋 Scraper Tramitación Procesal');
  console.log('─'.repeat(40));
  console.log('Comandos:');
  console.log('  escanear        - Ver estructura');
  console.log('  1               - Scrapear tema 1');
  console.log('  1-5             - Scrapear temas 1 al 5');
  console.log('  todos           - Scrapear TODOS los temas');
  console.log('  salir           - Cerrar\n');

  while (true) {
    const input = await ask('🔧 Comando: ');
    const parts = input.trim().split(/\s+/);
    const cmd = parts[0]?.toLowerCase();

    if (cmd === 'salir' || cmd === 'q') break;

    try {
      if (cmd === 'escanear' || cmd === 'e') {
        await escanear();
      } else if (cmd === 'scrapear' || cmd === 's') {
        const arg = parts[1];
        if (!arg) {
          console.log('⚠️ Uso: scrapear 1 o scrapear 1-5');
          continue;
        }

        const rangeMatch = arg.match(/^(\d+)-(\d+)$/);
        if (rangeMatch) {
          const start = parseInt(rangeMatch[1]) - 1;
          const end = parseInt(rangeMatch[2]) - 1;
          for (let i = start; i <= end; i++) {
            await scrapeTema(i);
          }
        } else {
          const num = parseInt(arg) - 1;
          await scrapeTema(num);
        }
      } else if (/^\d+$/.test(cmd)) {
        // Aceptar solo número como atajo
        await scrapeTema(parseInt(cmd) - 1);
      } else if (/^\d+-\d+$/.test(cmd)) {
        // Aceptar rango como atajo (ej: 1-5)
        const rangeMatch = cmd.match(/^(\d+)-(\d+)$/);
        const start = parseInt(rangeMatch[1]) - 1;
        const end = parseInt(rangeMatch[2]) - 1;
        for (let i = start; i <= end; i++) {
          await scrapeTema(i);
        }
      } else if (cmd === 'todos' || cmd === 'todo' || cmd === 'all') {
        // Scrapear todos los temas
        const progress = loadProgress();
        const totalTemas = progress.temas?.length || 31;
        console.log(`\n🚀 Scrapeando TODOS los temas (1-${totalTemas})...\n`);
        for (let i = 0; i < totalTemas; i++) {
          await scrapeTema(i);
        }
        console.log('\n🎉 ¡TODOS LOS TEMAS COMPLETADOS!\n');
      } else if (cmd) {
        console.log('❓ Comandos: escanear, <número>, <rango>, todos, salir');
      }
    } catch (error) {
      console.error('❌ Error:', error.message);
    }
  }

  rl.close();
}

async function main() {
  try {
    await initBrowser();
    await waitForLogin();
    await menu();
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    if (context) await context.close();
    process.exit(0);
  }
}

main();
