#!/usr/bin/env node
// Scraper automático de OpositaTest
// Uso: node scripts/opositatest-auto.cjs

const { chromium } = require('playwright');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const BASE_URL = 'https://aula.opositatest.com/classroom/test-configurator?mainContentId=33';
const OUTPUT_DIR = '/home/manuel/Documentos/github/vence/preguntas-para-subir';
const USER_DATA_DIR = path.join(__dirname, '.opositatest-session');
const PROGRESS_FILE = path.join(__dirname, 'scrape-progress.json');

// Cargar/guardar progreso
function loadProgress() {
  try {
    if (fs.existsSync(PROGRESS_FILE)) {
      return JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf-8'));
    }
  } catch (e) {}
  return { estructura: null, scrapeados: {}, lastUpdate: null };
}

function saveProgress(progress) {
  progress.lastUpdate = new Date().toISOString();
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

function isApartadoScrapeado(progress, temaTitle, apartadoTitle) {
  const key = `${temaTitle}::${apartadoTitle}`;
  return progress.scrapeados[key]?.done === true;
}

function marcarApartadoScrapeado(progress, temaTitle, apartadoTitle, questionCount) {
  const key = `${temaTitle}::${apartadoTitle}`;
  progress.scrapeados[key] = {
    done: true,
    questions: questionCount,
    date: new Date().toISOString()
  };
  saveProgress(progress);
}

let browser = null;
let context = null;
let page = null;

// Utilidades
const sleep = ms => new Promise(r => setTimeout(r, ms));

const sanitizeFilename = (name) => {
  return name
    .replace(/[<>:"/\\|?*]/g, '')
    .replace(/\s+/g, '_')
    .substring(0, 100);
};

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

  // Usar contexto persistente con Chrome real (igual que el scraper original)
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

    // Esperar hasta que no estemos en la página de login
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

// Cerrar modal de "cargar último test" si aparece
async function closeLastConfigModal() {
  try {
    const modal = await page.$('[data-testid="load-last-config-modal"]');
    if (modal) {
      console.log('   🔄 Cerrando modal de último test...');
      // Buscar botón "No" o botón de cerrar
      const noBtn = await page.$('[data-testid="load-last-config-modal"] button:has-text("No")');
      if (noBtn) {
        await noBtn.click();
        await sleep(500);
        return true;
      }
      // Intentar cerrar con X o botón secundario
      const closeBtn = await page.$('[data-testid="load-last-config-modal"] button:not(:has-text("Sí"))');
      if (closeBtn) {
        await closeBtn.click();
        await sleep(500);
        return true;
      }
      // Click fuera del modal para cerrarlo
      await page.keyboard.press('Escape');
      await sleep(500);
      return true;
    }
  } catch (e) {
    // Modal no existe, continuar
  }
  return false;
}

// Navegar al configurador (flujo completo: tipo test → 100 preguntas → continuar → selector contenido)
async function goToConfigurator(force = false) {
  const currentUrl = page.url();

  // Si ya estamos en el selector de contenido y no forzamos, no hacer nada
  if (!force && currentUrl.includes('testType=random') && currentUrl.includes('numQuestions=')) {
    await closeLastConfigModal();
    await sleep(500);
    return;
  }

  console.log('   🔄 Navegando al configurador...');
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await sleep(1000);

  // Cerrar modal si aparece
  await closeLastConfigModal();

  // Paso 1: Seleccionar "Personalizado" (primer opción, id="exam-random")
  console.log('   📝 Seleccionando test Personalizado...');
  try {
    // Intentar click en el radio button o su label
    const personalizadoClicked = await page.evaluate(() => {
      // Buscar por id del radio
      const radio = document.querySelector('#exam-random');
      if (radio) {
        radio.click();
        return true;
      }
      // Buscar por el primer item de la lista
      const firstItem = document.querySelector('[data-testid="list-item-0"] label');
      if (firstItem) {
        firstItem.click();
        return true;
      }
      // Buscar por texto "Personalizado"
      const labels = Array.from(document.querySelectorAll('label'));
      const label = labels.find(l => l.textContent.includes('Personalizado'));
      if (label) {
        label.click();
        return true;
      }
      return false;
    });

    if (!personalizadoClicked) {
      console.log('   ⚠️ No se encontró opción Personalizado, intentando continuar...');
    }
    await sleep(500);
  } catch (e) {
    console.log('   ⚠️ Error seleccionando Personalizado:', e.message);
  }

  // Paso 2: Establecer 100 preguntas
  console.log('   🔢 Configurando 100 preguntas...');
  try {
    // Buscar el input de número de preguntas
    await page.evaluate(() => {
      // Buscar por data-testid
      const input = document.querySelector('[data-testid="num-of-questions-value"]');
      if (input) {
        input.value = '';
        input.focus();
      }
    });

    // Escribir 100
    const inputSelector = '[data-testid="num-of-questions-value"]';
    const inputExists = await page.$(inputSelector);
    if (inputExists) {
      await page.fill(inputSelector, '100');
    } else {
      // Buscar por tipo number o name
      const altInput = await page.$('input[type="number"], input[name*="question"]');
      if (altInput) {
        await altInput.fill('100');
      }
    }
    await sleep(500);
  } catch (e) {
    console.log('   ⚠️ Error configurando preguntas:', e.message);
  }

  // Paso 3: Click en "Continuar"
  console.log('   ▶️ Continuando al selector de contenido...');
  try {
    // Cerrar modal si aparece
    await closeLastConfigModal();

    // Esperar a que el botón sea visible
    await page.waitForSelector('button:has-text("Continuar")', { timeout: 5000 });
    await sleep(500);

    // Cerrar modal de nuevo por si apareció
    await closeLastConfigModal();

    // Click directo con Playwright
    await page.click('button:has-text("Continuar")');
    console.log('   ✅ Click en Continuar');
  } catch (e) {
    console.log('   ⚠️ Error clickeando Continuar:', e.message);
    // Cerrar modal si está bloqueando
    await closeLastConfigModal();
    // Intento alternativo
    try {
      await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const btn = buttons.find(b => b.textContent.trim() === 'Continuar');
        if (btn) btn.click();
      });
    } catch (e2) {
      console.log('   ⚠️ Intento alternativo también falló');
    }
  }

  // Esperar a que cargue el selector de contenido
  await sleep(2000);

  // Verificar que estamos en el selector de contenido
  const finalUrl = page.url();
  if (finalUrl.includes('numQuestions=')) {
    console.log('   ✅ Selector de contenido cargado');
  } else {
    console.log('   📍 URL actual:', finalUrl);
  }
}

// Obtener estructura de bloques (solo los que tienen nombre y botón "Configurar temas")
async function getStructure() {
  const bloques = await page.evaluate(() => {
    const results = [];

    // Buscar todos los botones "Configurar temas" y sus contenedores padre
    const buttons = document.querySelectorAll('button');
    let btnIndex = 0;

    buttons.forEach((btn) => {
      if (btn.textContent.trim() === 'Configurar temas') {
        // Encontrar el contenedor del bloque
        const container = btn.closest('[data-testid^="list-item-"]');
        if (container) {
          const title = container.querySelector('.ContentSelectorItem-title')?.textContent?.trim() || '';
          const text = container.textContent || '';
          const temasMatch = text.match(/(\d+)\/(\d+)\s*[Tt]emas/);

          if (title) {  // Solo bloques con título
            results.push({
              index: btnIndex,
              title: title,
              temasCount: temasMatch ? parseInt(temasMatch[2]) : 0
            });
          }
          btnIndex++;
        }
      }
    });

    return results;
  });

  return bloques;
}

// Extraer preguntas de la página de resultados (usando selectores del scraper original)
async function extractQuestions() {
  // Expandir explicaciones con selector del scraper original
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

  // Extraer preguntas con selectores del scraper original
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

        if (questionText && options.length >= 2 && correctAnswer) {
          results.push({
            question: questionText,
            options: options,
            correctAnswer: correctAnswer,
            explanation: explanation || null
          });
        }
      } catch (e) {}
    });

    return results;
  });

  return questions;
}

// Guardar preguntas
function saveQuestions(questions, tema, apartado) {
  const temaDir = path.join(OUTPUT_DIR, sanitizeFilename(tema));
  if (!fs.existsSync(temaDir)) {
    fs.mkdirSync(temaDir, { recursive: true });
  }

  const filename = sanitizeFilename(apartado) + '.json';
  const filepath = path.join(temaDir, filename);

  const data = {
    tema: tema,
    subtema: apartado,
    source: 'opositatest',
    scrapedAt: new Date().toISOString(),
    questionCount: questions.length,
    questions: questions
  };

  fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
  console.log(`   💾 Guardado: ${tema}/${filename}`);
  return filepath;
}

// Scrapear un apartado específico
async function scrapeApartado(bloqueIdx, temaIdx, apartadoIdx) {
  try {
    // Ir al configurador
    await goToConfigurator();

    console.log(`\n🎯 Navegando: Bloque ${bloqueIdx} → Tema ${temaIdx} → Apartado ${apartadoIdx}`);

    // 1. Click en "Configurar temas" del bloque
    console.log(`   📂 Entrando en bloque ${bloqueIdx}...`);
    const bloqueButtons = await page.$$('button:has-text("Configurar temas")');
    if (bloqueButtons.length > bloqueIdx) {
      await bloqueButtons[bloqueIdx].click();
    } else {
      throw new Error(`No se encontró bloque ${bloqueIdx}`);
    }
    await sleep(2000);

    // Obtener nombre del tema
    const temaName = await page.evaluate((idx) => {
      const items = document.querySelectorAll('[data-testid^="list-item-"]');
      return items[idx]?.querySelector('.ContentSelectorItem-title')?.textContent?.trim() || `Tema_${idx}`;
    }, temaIdx);

    // 2. Click en "Configurar apartados" del tema
    console.log(`   📚 Entrando en tema ${temaIdx}: ${temaName}...`);
    const temaButtons = await page.$$('button:has-text("Configurar apartados")');
    if (temaButtons.length > temaIdx) {
      await temaButtons[temaIdx].click();
    } else {
      throw new Error(`No se encontró tema ${temaIdx}`);
    }
    await sleep(2000);

    // Obtener nombre del apartado
    const apartadoName = await page.evaluate((idx) => {
      const items = document.querySelectorAll('[data-testid^="list-item-"]');
      return items[idx]?.querySelector('.ContentSelectorItem-title')?.textContent?.trim() || `Apartado_${idx}`;
    }, apartadoIdx);

    console.log(`   📚 ${temaName}`);
    console.log(`   📄 ${apartadoName}`);

    // 3. Click en checkbox del apartado
    await page.click(`[data-testid="list-item-${apartadoIdx}"] input[type="checkbox"]`);
    await sleep(500);

    // 4. Click en "Confirmar selección"
    console.log('   ✓ Confirmando selección...');
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const btn = buttons.find(b => b.textContent.toLowerCase().includes('confirmar'));
      if (btn) btn.click();
    });
    await sleep(2000);

    // 5. Click en "Empezar test"
    console.log('   ▶️ Iniciando test...');
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const btn = buttons.find(b => b.textContent.toLowerCase().includes('empezar'));
      if (btn) btn.click();
    });
    await sleep(3000);

    // 6. Click en "Terminar y corregir"
    console.log('   ⏹️ Terminando test...');
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const btn = buttons.find(b =>
        b.textContent.toLowerCase().includes('terminar') ||
        b.textContent.toLowerCase().includes('corregir')
      );
      if (btn) btn.click();
    });
    await sleep(2000);

    // 7. Confirmar "Sí, quiero corregirlo"
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const btn = buttons.find(b =>
        b.textContent.toLowerCase().includes('sí') ||
        b.textContent.toLowerCase().includes('si,') ||
        b.textContent.toLowerCase().includes('corregirlo')
      );
      if (btn) btn.click();
    });
    await sleep(3000);

    // Esperar a que cargue la página de resultados
    await page.waitForSelector('.QuestionResultPanel', { timeout: 15000 });

    const resultsUrl = page.url();
    console.log(`   📍 ${resultsUrl}`);

    // 8. Extraer preguntas
    console.log('   🔍 Extrayendo preguntas...');
    const questions = await extractQuestions();
    console.log(`   ✅ ${questions.length} preguntas extraídas`);

    // 9. Guardar
    if (questions.length > 0) {
      saveQuestions(questions, temaName, apartadoName);
    }

    return { success: true, count: questions.length, tema: temaName, apartado: apartadoName };

  } catch (error) {
    console.error(`   ❌ Error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

// Scrapear todos los apartados de un tema
async function scrapeTemaCompleto(bloqueIdx, temaIdx) {
  // Primero obtener info del tema
  await goToConfigurator();

  // Navegar al bloque - click en "Configurar temas"
  console.log(`   📂 Entrando en bloque ${bloqueIdx}...`);
  const bloqueButtons = await page.$$('button:has-text("Configurar temas")');
  if (bloqueButtons.length > bloqueIdx) {
    await bloqueButtons[bloqueIdx].click();
    console.log(`   ✅ Click en "Configurar temas" del bloque ${bloqueIdx}`);
  } else {
    throw new Error(`No se encontró bloque ${bloqueIdx}`);
  }
  await sleep(2000);

  // Obtener info del tema ANTES de entrar en él
  const temaInfo = await page.evaluate((idx) => {
    const items = document.querySelectorAll('[data-testid^="list-item-"]');
    const item = items[idx];
    if (!item) return { title: `Tema_${idx}`, apartadosCount: 0 };

    // Buscar título en diferentes selectores
    let title = item.querySelector('.ContentSelectorItem-title')?.textContent?.trim();
    if (!title) {
      // Buscar en span o div dentro del item
      title = item.querySelector('span, div')?.textContent?.trim();
    }
    if (!title || title.includes('/')) {
      // Si el título contiene "/" probablemente es el contador, buscar otro elemento
      const allText = item.textContent?.trim() || '';
      const titleMatch = allText.match(/^(Tema\s+\d+[^0-9\/]+)/i);
      if (titleMatch) title = titleMatch[1].trim();
    }

    // Buscar "X/Y apartados" en el texto
    const childrenText = item.textContent || '';
    const match = childrenText.match(/(\d+)\/(\d+)\s*apartados/i);
    return {
      title: title || `Tema_${idx}`,
      apartadosCount: match ? parseInt(match[2]) : 0
    };
  }, temaIdx);

  console.log(`   📚 Tema encontrado: ${temaInfo.title} (${temaInfo.apartadosCount} apartados)`);

  // Click en "Configurar apartados" del tema
  console.log(`   📂 Entrando en tema ${temaIdx}...`);
  const temaButtons = await page.$$('button:has-text("Configurar apartados")');
  if (temaButtons.length > temaIdx) {
    await temaButtons[temaIdx].click();
    console.log(`   ✅ Click en "Configurar apartados" del tema ${temaIdx}`);
  } else {
    throw new Error(`No se encontró tema ${temaIdx}. Botones disponibles: ${temaButtons.length}`);
  }
  await sleep(2000);

  // Ahora obtener la lista de apartados
  const apartados = await page.evaluate(() => {
    const items = document.querySelectorAll('[data-testid^="list-item-"]');
    return Array.from(items).map((item, idx) => {
      const title = item.querySelector('.ContentSelectorItem-title')?.textContent?.trim();
      return { index: idx, title: title || `Apartado_${idx}` };
    });
  });

  console.log(`   📄 Apartados encontrados: ${apartados.length}`);

  // Filtrar solo apartados reales (que tienen título, no los breadcrumbs)
  const apartadosReales = apartados.filter(a => !a.title.startsWith('Apartado_'));
  const numApartados = apartadosReales.length;

  console.log(`\n${'═'.repeat(50)}`);
  console.log(`📚 SCRAPEANDO: ${temaInfo.title}`);
  console.log(`   ${numApartados} apartados reales`);
  apartadosReales.forEach((a, i) => console.log(`      [${i}] ${a.title}`));
  console.log(`${'═'.repeat(50)}`);

  const results = [];

  for (let i = 0; i < numApartados; i++) {
    const apartado = apartadosReales[i];
    console.log(`\n── Apartado ${i + 1}/${numApartados}: ${apartado.title} ──`);

    try {
      // 1. Seleccionar checkbox del apartado (usar índice i, no apartado.index)
      console.log(`   ☑️ Seleccionando apartado ${i} (${apartado.title})...`);
      const checkboxes = await page.$$('[data-testid^="list-item-"] input[type="checkbox"]');
      if (checkboxes.length > i) {
        await checkboxes[i].click();
      } else {
        // Intentar click directo en el item
        await page.click(`[data-testid="list-item-${i}"] input[type="checkbox"]`);
      }
      await sleep(500);

      // 2. Click en "Seguir eligiendo" o desmarcar otros si es necesario
      // Primero verificar que solo este apartado esté seleccionado

      // 3. Click en "Confirmar selección" o "Continuar con todo el contenido"
      console.log(`   ✓ Confirmando selección...`);
      const confirmarBtn = await page.$('button:has-text("Confirmar")');
      if (confirmarBtn) {
        await confirmarBtn.click();
      } else {
        // Buscar botón naranja de continuar
        await page.click('button:has-text("Continuar")');
      }
      await sleep(2000);

      // 4. Click en "Empezar test"
      console.log(`   ▶️ Iniciando test...`);
      await page.waitForSelector('button:has-text("Empezar")', { timeout: 5000 });
      await page.click('button:has-text("Empezar")');
      await sleep(3000);

      // 5. Click en "Terminar y corregir"
      console.log(`   ⏹️ Terminando test...`);
      await page.waitForSelector('button:has-text("Terminar")', { timeout: 10000 });
      await page.click('button:has-text("Terminar")');
      await sleep(2000);

      // 6. Confirmar en el modal - esperar a que aparezca
      console.log(`   ✓ Confirmando corrección...`);
      try {
        await page.waitForSelector('button:has-text("Sí")', { timeout: 5000 });
        await page.click('button:has-text("Sí")');
        await sleep(3000);
      } catch (e) {
        // Intentar con otros textos del botón
        const confirmBtn = await page.$('button:has-text("corregir"), button:has-text("Corregir")');
        if (confirmBtn) {
          await confirmBtn.click();
          await sleep(3000);
        }
      }

      // 7. Esperar resultados (usar selector del scraper original)
      await page.waitForSelector('[data-testid="question"]', { timeout: 15000 });
      console.log(`   📍 ${page.url()}`);

      // 8. Extraer preguntas
      console.log(`   🔍 Extrayendo preguntas...`);
      const questions = await extractQuestions();
      console.log(`   ✅ ${questions.length} preguntas extraídas`);

      // 9. Guardar
      if (questions.length > 0) {
        saveQuestions(questions, temaInfo.title, apartado.title);
      }

      results.push({ success: true, count: questions.length, apartado: apartado.title });

      // 10. Volver al configurador para el siguiente apartado
      if (i < numApartados - 1) {
        console.log(`   🔙 Volviendo al configurador...`);
        await goToConfigurator();

        // Navegar de nuevo al bloque y tema
        const bloqueButtons2 = await page.$$('button:has-text("Configurar temas")');
        if (bloqueButtons2.length > bloqueIdx) {
          await bloqueButtons2[bloqueIdx].click();
        }
        await sleep(2000);

        const temaButtons2 = await page.$$('button:has-text("Configurar apartados")');
        if (temaButtons2.length > temaIdx) {
          await temaButtons2[temaIdx].click();
        }
        await sleep(2000);
      }

    } catch (error) {
      console.error(`   ❌ Error: ${error.message}`);
      results.push({ success: false, error: error.message, apartado: apartado.title });

      // Intentar volver al configurador para continuar
      try {
        await goToConfigurator();
        const bloqueButtons2 = await page.$$('button:has-text("Configurar temas")');
        if (bloqueButtons2.length > bloqueIdx) await bloqueButtons2[bloqueIdx].click();
        await sleep(2000);
        const temaButtons2 = await page.$$('button:has-text("Configurar apartados")');
        if (temaButtons2.length > temaIdx) await temaButtons2[temaIdx].click();
        await sleep(2000);
      } catch (e) {
        console.log(`   ⚠️ No se pudo recuperar, continuando...`);
      }
    }

    if (i < numApartados - 1) {
      console.log(`   ⏳ Esperando antes del siguiente...`);
      await sleep(2000);
    }
  }

  // Resumen
  const successful = results.filter(r => r.success).length;
  const totalQuestions = results.filter(r => r.success).reduce((sum, r) => sum + r.count, 0);

  console.log(`\n${'═'.repeat(50)}`);
  console.log(`📊 RESUMEN`);
  console.log(`   ✅ ${successful}/${numApartados} apartados completados`);
  console.log(`   📝 ${totalQuestions} preguntas totales`);
  console.log(`${'═'.repeat(50)}\n`);

  return results;
}

// Mostrar menú de bloques
async function showBloques() {
  await goToConfigurator();
  const bloques = await getStructure();

  console.log('\n📂 BLOQUES DISPONIBLES:\n');
  bloques.forEach((b, i) => {
    console.log(`  [${i}] ${b.title} (${b.temasCount} temas)`);
  });
  console.log('');

  return bloques;
}

// Mostrar menú de temas
async function showTemas(bloqueIdx) {
  await goToConfigurator();

  // Click en "Configurar temas" del bloque
  const bloqueButtons = await page.$$('button:has-text("Configurar temas")');
  if (bloqueButtons.length > bloqueIdx) {
    await bloqueButtons[bloqueIdx].click();
  } else {
    console.log(`⚠️ No se encontró bloque ${bloqueIdx}`);
    return [];
  }
  await sleep(2000);

  const temas = await page.evaluate(() => {
    const items = document.querySelectorAll('[data-testid="list"] > [data-testid^="list-item-"]');
    const result = [];

    items.forEach((item, idx) => {
      const title = item.querySelector('.ContentSelectorItem-title')?.textContent?.trim() || '';
      const childrenText = item.querySelector('.ContentSelectorItem-children')?.textContent || '';
      const apartadosMatch = childrenText.match(/(\d+)\/(\d+)\s*Apartados/);

      result.push({
        index: idx,
        title: title,
        apartadosCount: apartadosMatch ? parseInt(apartadosMatch[2]) : 0
      });
    });

    return result;
  });

  console.log('\n📚 TEMAS:\n');
  temas.forEach((t, i) => {
    console.log(`  [${i}] ${t.title} (${t.apartadosCount} apartados)`);
  });
  console.log('');

  return temas;
}

// Scrapear tema inteligente (salta los ya scrapeados)
async function scrapeTemaCompletoInteligente(bloqueIdx, temaIdx, temaTitle, progress) {
  await goToConfigurator();

  // Navegar al bloque
  console.log(`   📂 Entrando en bloque ${bloqueIdx}...`);
  const bloqueButtons = await page.$$('button:has-text("Configurar temas")');
  if (bloqueButtons.length > bloqueIdx) {
    await bloqueButtons[bloqueIdx].click();
  } else {
    throw new Error(`No se encontró bloque ${bloqueIdx}`);
  }
  await sleep(2000);

  // Navegar al tema
  console.log(`   📚 Entrando en tema ${temaIdx}...`);
  const temaButtons = await page.$$('button:has-text("Configurar apartados")');
  if (temaButtons.length > temaIdx) {
    await temaButtons[temaIdx].click();
  } else {
    throw new Error(`No se encontró tema ${temaIdx}`);
  }
  await sleep(2000);

  // Obtener apartados
  const apartados = await page.evaluate(() => {
    const items = document.querySelectorAll('[data-testid^="list-item-"]');
    return Array.from(items).map((item, idx) => {
      const title = item.querySelector('.ContentSelectorItem-title')?.textContent?.trim();
      return { index: idx, title: title || `Apartado_${idx}` };
    });
  });

  const apartadosReales = apartados.filter(a => !a.title.startsWith('Apartado_'));

  console.log(`\n${'═'.repeat(50)}`);
  console.log(`📚 ${temaTitle}`);
  console.log(`   ${apartadosReales.length} apartados`);

  let pendientes = 0;
  let yaHechos = 0;
  for (const a of apartadosReales) {
    if (isApartadoScrapeado(progress, temaTitle, a.title)) {
      console.log(`   ✅ ${a.title}`);
      yaHechos++;
    } else {
      console.log(`   ⏳ ${a.title}`);
      pendientes++;
    }
  }
  console.log(`${'═'.repeat(50)}`);

  if (pendientes === 0) {
    console.log(`\n✅ Todos los apartados ya están scrapeados!\n`);
    return;
  }

  console.log(`\n🎯 Scrapeando ${pendientes} apartados pendientes...\n`);

  const results = [];
  for (let i = 0; i < apartadosReales.length; i++) {
    const apartado = apartadosReales[i];

    if (isApartadoScrapeado(progress, temaTitle, apartado.title)) {
      console.log(`⏭️ Saltando "${apartado.title}" (ya scrapeado)`);
      continue;
    }

    console.log(`\n── ${apartado.title} ──`);

    try {
      // Seleccionar checkbox
      console.log(`   ☑️ Seleccionando...`);
      const checkboxes = await page.$$('[data-testid^="list-item-"] input[type="checkbox"]');
      if (checkboxes.length > i) {
        await checkboxes[i].click();
      }
      await sleep(500);

      // Confirmar
      console.log(`   ✓ Confirmando...`);
      const confirmarBtn = await page.$('button:has-text("Confirmar")');
      if (confirmarBtn) {
        await confirmarBtn.click();
      } else {
        await page.click('button:has-text("Continuar")');
      }
      await sleep(2000);

      // Empezar test
      console.log(`   ▶️ Iniciando test...`);
      await page.waitForSelector('button:has-text("Empezar")', { timeout: 5000 });
      await page.click('button:has-text("Empezar")');
      await sleep(3000);

      // Terminar
      console.log(`   ⏹️ Terminando...`);
      await page.waitForSelector('button:has-text("Terminar")', { timeout: 10000 });
      await page.click('button:has-text("Terminar")');
      await sleep(2000);

      // Confirmar
      try {
        await page.waitForSelector('button:has-text("Sí")', { timeout: 5000 });
        await page.click('button:has-text("Sí")');
        await sleep(3000);
      } catch (e) {}

      // Esperar resultados
      await page.waitForSelector('[data-testid="question"]', { timeout: 15000 });

      // Extraer
      console.log(`   🔍 Extrayendo...`);
      const questions = await extractQuestions();
      console.log(`   ✅ ${questions.length} preguntas`);

      // Guardar
      if (questions.length > 0) {
        saveQuestions(questions, temaTitle, apartado.title);
        marcarApartadoScrapeado(progress, temaTitle, apartado.title, questions.length);
      }

      results.push({ success: true, count: questions.length });

      // Volver para siguiente
      if (i < apartadosReales.length - 1) {
        console.log(`   🔙 Volviendo...`);
        await goToConfigurator();
        const bb = await page.$$('button:has-text("Configurar temas")');
        if (bb[bloqueIdx]) await bb[bloqueIdx].click();
        await sleep(2000);
        const tb = await page.$$('button:has-text("Configurar apartados")');
        if (tb[temaIdx]) await tb[temaIdx].click();
        await sleep(2000);
      }

    } catch (error) {
      console.error(`   ❌ Error: ${error.message}`);
      results.push({ success: false });

      // Recuperar
      try {
        await goToConfigurator();
        const bb = await page.$$('button:has-text("Configurar temas")');
        if (bb[bloqueIdx]) await bb[bloqueIdx].click();
        await sleep(2000);
        const tb = await page.$$('button:has-text("Configurar apartados")');
        if (tb[temaIdx]) await tb[temaIdx].click();
        await sleep(2000);
      } catch (e) {}
    }
  }

  const ok = results.filter(r => r.success).length;
  const total = results.reduce((s, r) => s + (r.count || 0), 0);
  console.log(`\n✅ Completado: ${ok} apartados, ${total} preguntas\n`);
}

// Scrapear todo lo pendiente
async function scrapearTodoPendiente() {
  const progress = loadProgress();

  if (!progress.estructura) {
    console.log('⚠️ Primero ejecuta "escanear" para conocer la estructura');
    return;
  }

  console.log('\n🚀 SCRAPEANDO TODO LO PENDIENTE\n');

  for (const bloque of progress.estructura.bloques) {
    console.log(`\n📂 ${bloque.title}`);

    for (const tema of bloque.temas) {
      const apartados = tema.apartados || [];

      // Contar pendientes
      let pendientes = 0;
      for (const apartado of apartados) {
        if (!isApartadoScrapeado(progress, tema.title, apartado.title)) {
          pendientes++;
        }
      }

      if (pendientes > 0) {
        console.log(`\n   📚 ${tema.title} - ${pendientes} apartados pendientes`);
        await scrapeTemaCompletoInteligente(bloque.index, tema.index, tema.title, progress);
      } else if (apartados.length > 0) {
        console.log(`   ✅ ${tema.title} - completo`);
      }
    }
  }

  console.log('\n🎉 ¡TODO COMPLETADO!\n');
  mostrarEstado();
}

// Escanear estructura completa (bloques → temas → apartados)
async function escanearEstructura() {
  console.log('\n📊 ESCANEANDO ESTRUCTURA COMPLETA...\n');
  const progress = loadProgress();
  const estructura = { bloques: [] };

  await goToConfigurator();

  // Obtener bloques
  const bloques = await getStructure();
  console.log(`📂 Encontrados ${bloques.length} bloques\n`);

  for (let b = 0; b < bloques.length; b++) {
    const bloque = bloques[b];
    console.log(`\n${'═'.repeat(60)}`);
    console.log(`📂 BLOQUE ${b + 1}: ${bloque.title} (${bloque.temasCount} temas)`);
    console.log(`${'═'.repeat(60)}`);

    const bloqueData = {
      index: bloque.index,  // Usar el índice real del botón
      title: bloque.title,
      temas: []
    };

    // Entrar al bloque usando índice b (forzar navegación)
    await goToConfigurator(true);

    const bloqueButtons = await page.$$('button:has-text("Configurar temas")');
    if (!bloqueButtons[b]) {
      console.log(`   ⚠️ No se encontró bloque ${b} (hay ${bloqueButtons.length} botones)`);
      estructura.bloques.push(bloqueData);
      continue;
    }

    await bloqueButtons[b].click();
    await sleep(2000);

    // Obtener temas del bloque
    const temas = await page.evaluate(() => {
      const results = [];
      const buttons = document.querySelectorAll('button');
      let btnIndex = 0;

      buttons.forEach((btn) => {
        if (btn.textContent.trim() === 'Configurar apartados') {
          const container = btn.closest('[data-testid^="list-item-"]');
          if (container) {
            const title = container.querySelector('.ContentSelectorItem-title')?.textContent?.trim() || '';
            const text = container.textContent || '';
            const match = text.match(/(\d+)\/(\d+)\s*apartados/i);

            if (title && title.toLowerCase().startsWith('tema')) {
              results.push({
                index: btnIndex,
                title: title,
                apartadosCount: match ? parseInt(match[2]) : 0
              });
            }
            btnIndex++;
          }
        }
      });

      return results;
    });

    console.log(`   📚 ${temas.length} temas encontrados\n`);

    // Para cada tema, entrar y obtener apartados
    for (let t = 0; t < temas.length; t++) {
      const tema = temas[t];
      console.log(`   📚 ${tema.title} (${tema.apartadosCount} apartados)`);

      const temaData = {
        index: tema.index,
        title: tema.title,
        apartados: []
      };

      // Navegar al tema para obtener apartados (forzar navegación completa)
      await goToConfigurator(true);

      try {
        // Click en bloque (buscar por índice b)
        const bloqueButtons2 = await page.$$('button:has-text("Configurar temas")');
        if (bloqueButtons2[b]) {
          await bloqueButtons2[b].click();
          await sleep(1500);

          // Click en tema (buscar por índice t)
          const temaButtons = await page.$$('button:has-text("Configurar apartados")');
          if (temaButtons[t]) {
            await temaButtons[t].click();
            await sleep(1500);

            // Obtener apartados (buscar por checkboxes)
            const apartados = await page.evaluate(() => {
              const results = [];
              const checkboxes = document.querySelectorAll('[data-testid^="list-item-"] input[type="checkbox"]');

              checkboxes.forEach((checkbox, idx) => {
                const container = checkbox.closest('[data-testid^="list-item-"]');
                if (container) {
                  const title = container.querySelector('.ContentSelectorItem-title')?.textContent?.trim();
                  if (title && !title.includes('/')) {
                    results.push({ index: idx, title: title });
                  }
                }
              });

              return results;
            });

            for (const apartado of apartados) {
              const yaHecho = isApartadoScrapeado(progress, tema.title, apartado.title);
              const status = yaHecho ? '✅' : '⏳';
              console.log(`      ${status} ${apartado.title}`);
              temaData.apartados.push({
                index: apartado.index,
                title: apartado.title
              });
            }
          } else {
            console.log(`      ⚠️ No se encontró botón del tema ${t}`);
          }
        } else {
          console.log(`      ⚠️ No se encontró botón del bloque ${b}`);
        }
      } catch (e) {
        console.log(`      ⚠️ Error: ${e.message}`);
      }

      bloqueData.temas.push(temaData);
    }

    estructura.bloques.push(bloqueData);
  }

  progress.estructura = estructura;
  saveProgress(progress);

  // Resumen
  let totalTemas = 0;
  let totalApartados = 0;
  for (const bloque of estructura.bloques) {
    totalTemas += bloque.temas.length;
    for (const tema of bloque.temas) {
      totalApartados += tema.apartados?.length || 0;
    }
  }

  console.log(`\n${'═'.repeat(60)}`);
  console.log(`✅ ESCANEO COMPLETADO`);
  console.log(`   📂 ${estructura.bloques.length} bloques`);
  console.log(`   📚 ${totalTemas} temas`);
  console.log(`   📄 ${totalApartados} apartados`);
  console.log(`${'═'.repeat(60)}\n`);

  return estructura;
}

// Mostrar estado actual
function mostrarEstado() {
  const progress = loadProgress();

  if (!progress.estructura) {
    console.log('\n⚠️ No hay estructura escaneada. Usa "escanear" primero.\n');
    return;
  }

  console.log('\n📊 ESTADO DEL SCRAPING\n');

  let totalApartados = 0;
  let totalScrapeados = 0;
  let totalPreguntas = 0;

  for (const bloque of progress.estructura.bloques) {
    console.log(`\n📂 ${bloque.title}`);

    for (const tema of bloque.temas) {
      const apartados = tema.apartados || [];
      let temaScrapeados = 0;
      let temaPreguntas = 0;

      for (const apartado of apartados) {
        const key = `${tema.title}::${apartado.title}`;
        if (progress.scrapeados[key]?.done) {
          temaScrapeados++;
          temaPreguntas += progress.scrapeados[key].questions || 0;
        }
      }

      totalApartados += apartados.length;
      totalScrapeados += temaScrapeados;
      totalPreguntas += temaPreguntas;

      const status = apartados.length > 0 && temaScrapeados === apartados.length ? '✅' :
                     temaScrapeados > 0 ? '🔄' : '⏳';
      console.log(`   ${status} ${tema.title}: ${temaScrapeados}/${apartados.length} (${temaPreguntas} preguntas)`);

      // Mostrar apartados detallados
      for (const apartado of apartados) {
        const key = `${tema.title}::${apartado.title}`;
        const info = progress.scrapeados[key];
        if (info?.done) {
          console.log(`      ✅ ${apartado.title} (${info.questions} preg)`);
        } else {
          console.log(`      ⏳ ${apartado.title}`);
        }
      }
    }
  }

  console.log(`\n${'═'.repeat(50)}`);
  console.log(`📈 TOTAL: ${totalScrapeados}/${totalApartados} apartados`);
  console.log(`📝 ${totalPreguntas} preguntas extraídas`);
  console.log(`${'═'.repeat(50)}\n`);
}

// Mostrar lista numerada para seleccionar
function mostrarLista() {
  const progress = loadProgress();

  if (!progress.estructura) {
    console.log('\n⚠️ No hay estructura escaneada. Usa "escanear" primero.\n');
    return null;
  }

  console.log('\n📋 LISTA DE TEMAS (para scrapear usa: scrapear <número>)\n');

  const temasList = [];  // Array para mapear número → tema
  let num = 1;

  for (const bloque of progress.estructura.bloques) {
    console.log(`\n${'═'.repeat(60)}`);
    console.log(`📂 ${bloque.title}`);
    console.log(`${'═'.repeat(60)}`);

    for (const tema of bloque.temas) {
      const apartados = tema.apartados || [];
      let scrapeados = 0;
      let preguntas = 0;

      for (const apartado of apartados) {
        const key = `${tema.title}::${apartado.title}`;
        if (progress.scrapeados[key]?.done) {
          scrapeados++;
          preguntas += progress.scrapeados[key].questions || 0;
        }
      }

      const status = apartados.length > 0 && scrapeados === apartados.length ? '✅' :
                     scrapeados > 0 ? '🔄' : '⏳';

      const numStr = String(num).padStart(2, ' ');
      console.log(`  ${status} [${numStr}] ${tema.title}`);
      console.log(`         ${scrapeados}/${apartados.length} apartados ${preguntas > 0 ? `(${preguntas} preg)` : ''}`);

      temasList.push({
        num,
        bloqueIndex: bloque.index,
        temaIndex: tema.index,
        title: tema.title,
        bloqueTitle: bloque.title,
        apartados: apartados.length,
        scrapeados,
        preguntas
      });

      num++;
    }
  }

  const totalTemas = temasList.length;
  const temasCompletos = temasList.filter(t => t.scrapeados === t.apartados && t.apartados > 0).length;
  const temasPendientes = temasList.filter(t => t.scrapeados < t.apartados).length;

  console.log(`\n${'═'.repeat(60)}`);
  console.log(`📊 RESUMEN: ${temasCompletos}/${totalTemas} temas completos, ${temasPendientes} pendientes`);
  console.log(`\n💡 Comandos:`);
  console.log(`   scrapear 1      → Scrapea el tema [1]`);
  console.log(`   scrapear 1-5    → Scrapea temas del 1 al 5`);
  console.log(`   todo            → Scrapea todos los pendientes`);
  console.log(`${'═'.repeat(60)}\n`);

  return temasList;
}

// Variable global para la lista de temas (para usar en comandos)
let temasListCache = null;

// Scrapear por número de lista
async function scrapearPorNumero(numeros) {
  // Generar lista si no existe
  if (!temasListCache) {
    temasListCache = mostrarLista();
    if (!temasListCache) return;
  }

  const progress = loadProgress();

  for (const num of numeros) {
    const tema = temasListCache.find(t => t.num === num);
    if (!tema) {
      console.log(`⚠️ No existe tema [${num}]`);
      continue;
    }

    console.log(`\n🎯 Scrapeando [${num}] ${tema.title}`);
    console.log(`   📂 Bloque: ${tema.bloqueTitle}`);

    await scrapeTemaCompletoInteligente(tema.bloqueIndex, tema.temaIndex, tema.title, progress);
  }
}

// Menú interactivo
async function interactiveMenu() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const ask = (q) => new Promise(r => rl.question(q, r));

  console.log('\n📋 Scraper Automático de OpositaTest');
  console.log('────────────────────────────────────────\n');
  console.log('Comandos:');
  console.log('  escanear           - Escanear toda la estructura');
  console.log('  lista              - Ver lista numerada de temas');
  console.log('  estado             - Ver progreso detallado');
  console.log('  scrapear <n>       - Scrapear tema por número (ej: scrapear 5)');
  console.log('  scrapear <a>-<b>   - Scrapear rango (ej: scrapear 1-10)');
  console.log('  todo               - Scrapear todo lo pendiente');
  console.log('  salir              - Cerrar\n');

  // Mostrar lista automáticamente si ya hay estructura
  const progress = loadProgress();
  if (progress.estructura) {
    temasListCache = mostrarLista();
  } else {
    console.log('💡 Tip: Ejecuta "escanear" primero para ver la estructura\n');
  }

  while (true) {
    const input = await ask('🔧 Comando: ');
    const parts = input.trim().split(/\s+/);
    const cmd = parts[0].toLowerCase();

    if (cmd === 'salir' || cmd === 'exit' || cmd === 'q') {
      break;
    }

    try {
      if (cmd === 'escanear' || cmd === 'scan') {
        await escanearEstructura();
        temasListCache = mostrarLista();
      }
      else if (cmd === 'lista' || cmd === 'list' || cmd === 'l') {
        temasListCache = mostrarLista();
      }
      else if (cmd === 'estado' || cmd === 'status') {
        mostrarEstado();
      }
      else if (cmd === 'scrapear' || cmd === 's') {
        const arg = parts[1];
        if (!arg) {
          console.log('⚠️ Uso:');
          console.log('   scrapear 5       → Scrapea tema [5]');
          console.log('   scrapear 1-10    → Scrapea temas del [1] al [10]');
          continue;
        }

        // Verificar si hay estructura
        if (!loadProgress().estructura) {
          console.log('⚠️ Primero ejecuta "escanear" para conocer la estructura');
          continue;
        }

        // Parsear argumento (puede ser número o rango)
        const rangeMatch = arg.match(/^(\d+)-(\d+)$/);
        if (rangeMatch) {
          const start = parseInt(rangeMatch[1]);
          const end = parseInt(rangeMatch[2]);
          const nums = [];
          for (let i = start; i <= end; i++) nums.push(i);
          console.log(`\n🚀 Scrapeando temas ${start} a ${end}...`);
          await scrapearPorNumero(nums);
        } else {
          const num = parseInt(arg);
          if (isNaN(num)) {
            console.log('⚠️ Número inválido. Usa: scrapear 5 o scrapear 1-10');
            continue;
          }
          await scrapearPorNumero([num]);
        }

        // Actualizar cache después de scrapear
        temasListCache = null;
      }
      else if (cmd === 'todo' || cmd === 'all') {
        await scrapearTodoPendiente();
        temasListCache = null;
      }
      else if (cmd) {
        console.log('❓ Comandos: escanear, lista, estado, scrapear <n>, todo, salir');
      }
    } catch (error) {
      console.error('❌ Error:', error.message);
    }
  }

  rl.close();
}

// Main
async function main() {
  try {
    await initBrowser();
    await waitForLogin();
    await interactiveMenu();
  } catch (error) {
    console.error('❌ Error fatal:', error.message);
  } finally {
    if (context) {
      await context.close();
    }
    process.exit(0);
  }
}

main();
