/**
 * Auditoría de seguridad OpositaTest
 * Prueba si mainContentId permite acceso a oposiciones no autorizadas
 *
 * USO: node scripts/opositatest-audit.cjs
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Configuración
const BASE_URL = 'https://aula.opositatest.com/classroom/test-configurator';
const SESSION_DIR = path.join(__dirname, '.opositatest-session');
const RESULTS_FILE = path.join(__dirname, 'audit-results.json');

// Delay entre pruebas (30-60 segundos aleatorio para parecer humano)
const MIN_DELAY = 30000;
const MAX_DELAY = 60000;

function randomDelay() {
  return Math.floor(Math.random() * (MAX_DELAY - MIN_DELAY)) + MIN_DELAY;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

let browser, context, page;
let results = [];

// Cargar resultados previos si existen
function loadResults() {
  try {
    if (fs.existsSync(RESULTS_FILE)) {
      results = JSON.parse(fs.readFileSync(RESULTS_FILE, 'utf8'));
      console.log(`📂 Cargados ${results.length} resultados previos`);
    }
  } catch (e) {
    results = [];
  }
}

function saveResults() {
  fs.writeFileSync(RESULTS_FILE, JSON.stringify(results, null, 2));
}

async function init() {
  console.log('🔍 Iniciando auditoría de seguridad OpositaTest...\n');

  browser = await chromium.launchPersistentContext(SESSION_DIR, {
    headless: false,
    args: [
      '--no-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--no-first-run',
      '--disable-infobars'
    ]
  });

  page = browser.pages()[0] || await browser.newPage();
  loadResults();
}

async function testMainContentId(id) {
  const url = `${BASE_URL}?mainContentId=${id}`;
  console.log(`\n🔎 Probando mainContentId=${id}...`);

  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    await sleep(2000); // Esperar a que cargue JS

    // Analizar la respuesta
    const pageContent = await page.content();
    const pageTitle = await page.title();
    const currentUrl = page.url();

    // Detectar diferentes estados
    let status = 'unknown';
    let oposicionName = null;
    let temasCount = 0;

    // Buscar nombre de oposición en la página
    const h1 = await page.$eval('h1', el => el.textContent).catch(() => null);
    const h2 = await page.$eval('h2', el => el.textContent).catch(() => null);

    // Contar temas/contenido disponible
    const buttons = await page.$$('button');
    const configButtons = [];
    for (const btn of buttons) {
      const text = await btn.textContent();
      if (text.includes('Configurar')) {
        configButtons.push(text);
      }
    }
    temasCount = configButtons.length;

    // Detectar si hay acceso o no
    if (currentUrl.includes('login') || currentUrl.includes('acceso')) {
      status = 'REDIRECT_LOGIN';
    } else if (pageContent.includes('No tienes acceso') || pageContent.includes('suscripción')) {
      status = 'NO_ACCESS';
    } else if (pageContent.includes('error') || pageContent.includes('Error')) {
      status = 'ERROR';
    } else if (temasCount > 0) {
      status = 'ACCESS_OK';
      oposicionName = h1 || h2 || 'Desconocida';
    } else if (pageContent.includes('oposición') || pageContent.includes('tema')) {
      status = 'PARTIAL';
      oposicionName = h1 || h2;
    } else {
      status = 'EMPTY';
    }

    const result = {
      mainContentId: id,
      status,
      oposicionName: oposicionName?.trim(),
      temasCount,
      url: currentUrl,
      timestamp: new Date().toISOString()
    };

    // Icono según estado
    const icons = {
      'ACCESS_OK': '✅',
      'NO_ACCESS': '🔒',
      'REDIRECT_LOGIN': '🔐',
      'ERROR': '❌',
      'PARTIAL': '⚠️',
      'EMPTY': '📭',
      'unknown': '❓'
    };

    console.log(`${icons[status]} mainContentId=${id}: ${status}`);
    if (oposicionName) console.log(`   📚 Oposición: ${oposicionName}`);
    if (temasCount > 0) console.log(`   📖 Temas detectados: ${temasCount}`);

    results.push(result);
    saveResults();

    return result;

  } catch (error) {
    console.log(`❌ Error en mainContentId=${id}: ${error.message}`);
    const result = {
      mainContentId: id,
      status: 'ERROR',
      error: error.message,
      timestamp: new Date().toISOString()
    };
    results.push(result);
    saveResults();
    return result;
  }
}

async function showResults() {
  console.log('\n' + '='.repeat(60));
  console.log('📊 RESULTADOS DE LA AUDITORÍA');
  console.log('='.repeat(60));

  const byStatus = {};
  results.forEach(r => {
    if (!byStatus[r.status]) byStatus[r.status] = [];
    byStatus[r.status].push(r);
  });

  console.log('\n📈 Resumen por estado:');
  Object.entries(byStatus).forEach(([status, items]) => {
    console.log(`   ${status}: ${items.length}`);
  });

  if (byStatus['ACCESS_OK']?.length > 0) {
    console.log('\n✅ OPOSICIONES ACCESIBLES:');
    byStatus['ACCESS_OK'].forEach(r => {
      console.log(`   [${r.mainContentId}] ${r.oposicionName} (${r.temasCount} temas)`);
    });
  }

  if (byStatus['NO_ACCESS']?.length > 0) {
    console.log('\n🔒 OPOSICIONES BLOQUEADAS (correcto):');
    byStatus['NO_ACCESS'].forEach(r => {
      console.log(`   [${r.mainContentId}] ${r.oposicionName || 'N/A'}`);
    });
  }

  console.log('\n📁 Resultados guardados en: audit-results.json');
}

async function prompt(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  return new Promise(resolve => {
    rl.question(question, answer => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function main() {
  await init();

  console.log('='.repeat(60));
  console.log('🔐 AUDITORÍA DE AUTORIZACIÓN OPOSITATEST');
  console.log('='.repeat(60));
  console.log('\nComandos disponibles:');
  console.log('  probar <id>      - Prueba un mainContentId específico');
  console.log('  rango <ini> <fin> - Prueba un rango (lento, 30-60s entre cada uno)');
  console.log('  resultados       - Muestra resultados actuales');
  console.log('  salir            - Termina la auditoría');
  console.log('');

  // IDs ya probados
  const testedIds = new Set(results.map(r => r.mainContentId));
  if (testedIds.size > 0) {
    console.log(`📝 IDs ya probados: ${[...testedIds].sort((a,b) => a-b).join(', ')}`);
  }

  while (true) {
    const input = await prompt('\n🔍 audit> ');
    const parts = input.toLowerCase().split(/\s+/);
    const cmd = parts[0];

    if (cmd === 'salir' || cmd === 'exit' || cmd === 'q') {
      break;
    }

    if (cmd === 'resultados' || cmd === 'results' || cmd === 'r') {
      await showResults();
      continue;
    }

    if (cmd === 'probar' || cmd === 'test' || cmd === 'p') {
      const id = parseInt(parts[1]);
      if (isNaN(id)) {
        console.log('❌ Uso: probar <id>');
        continue;
      }
      await testMainContentId(id);
      continue;
    }

    if (cmd === 'rango' || cmd === 'range') {
      const start = parseInt(parts[1]);
      const end = parseInt(parts[2]);
      if (isNaN(start) || isNaN(end)) {
        console.log('❌ Uso: rango <inicio> <fin>');
        continue;
      }

      console.log(`\n⏳ Probando rango ${start}-${end} (${end - start + 1} IDs)`);
      console.log(`   Tiempo estimado: ${((end - start + 1) * 45 / 60).toFixed(1)} minutos`);
      console.log('   Presiona Ctrl+C para cancelar\n');

      for (let id = start; id <= end; id++) {
        if (testedIds.has(id)) {
          console.log(`⏭️  mainContentId=${id} ya probado, saltando...`);
          continue;
        }

        await testMainContentId(id);
        testedIds.add(id);

        if (id < end) {
          const delay = randomDelay();
          console.log(`   ⏳ Esperando ${(delay/1000).toFixed(0)}s antes de la siguiente prueba...`);
          await sleep(delay);
        }
      }

      await showResults();
      continue;
    }

    // Si es solo un número, probarlo directamente
    const directId = parseInt(cmd);
    if (!isNaN(directId)) {
      await testMainContentId(directId);
      continue;
    }

    console.log('❓ Comando no reconocido. Usa: probar, rango, resultados, salir');
  }

  await showResults();
  console.log('\n👋 Cerrando navegador...');
  await browser.close();
}

main().catch(console.error);
