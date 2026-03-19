/**
 * Auditoría automática de seguridad OpositaTest
 * Prueba mainContentIds para detectar fallos de autorización
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'https://aula.opositatest.com/classroom/test-configurator';
const SESSION_DIR = path.join(__dirname, '.opositatest-session');
const RESULTS_FILE = path.join(__dirname, 'audit-results.json');

// IDs a probar (empezamos con pocos)
const IDS_TO_TEST = [7, 1, 2, 3, 4, 5, 6, 8, 9, 10];

// Delay entre pruebas (30-45 segundos)
const MIN_DELAY = 30000;
const MAX_DELAY = 45000;

function randomDelay() {
  return Math.floor(Math.random() * (MAX_DELAY - MIN_DELAY)) + MIN_DELAY;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

let results = [];

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

async function testMainContentId(page, id) {
  const url = `${BASE_URL}?mainContentId=${id}`;
  console.log(`\n🔎 Probando mainContentId=${id}...`);

  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    await sleep(2000);

    const currentUrl = page.url();
    const pageContent = await page.content();

    let status = 'unknown';
    let oposicionName = null;
    let temasCount = 0;

    // Buscar título
    const h1 = await page.$eval('h1', el => el.textContent).catch(() => null);

    // Contar botones de configurar
    const configButtons = await page.$$eval('button', buttons =>
      buttons.filter(b => b.textContent.includes('Configurar')).length
    );
    temasCount = configButtons;

    // Detectar estado
    if (currentUrl.includes('login') || currentUrl.includes('acceso')) {
      status = 'REDIRECT_LOGIN';
    } else if (pageContent.includes('No tienes acceso') ||
               pageContent.includes('no tiene acceso') ||
               pageContent.includes('Acceso denegado')) {
      status = 'NO_ACCESS';
    } else if (temasCount > 0) {
      status = 'ACCESS_OK';
      oposicionName = h1?.trim();
    } else if (pageContent.length < 5000) {
      status = 'EMPTY';
    } else {
      status = 'PARTIAL';
      oposicionName = h1?.trim();
    }

    const icons = {
      'ACCESS_OK': '✅',
      'NO_ACCESS': '🔒',
      'REDIRECT_LOGIN': '🔐',
      'EMPTY': '📭',
      'PARTIAL': '⚠️',
      'unknown': '❓'
    };

    console.log(`${icons[status]} mainContentId=${id}: ${status}`);
    if (oposicionName) console.log(`   📚 Oposición: ${oposicionName}`);
    if (temasCount > 0) console.log(`   📖 Temas: ${temasCount}`);

    return { mainContentId: id, status, oposicionName, temasCount, timestamp: new Date().toISOString() };

  } catch (error) {
    console.log(`❌ Error en mainContentId=${id}: ${error.message}`);
    return { mainContentId: id, status: 'ERROR', error: error.message, timestamp: new Date().toISOString() };
  }
}

async function main() {
  console.log('🔐 AUDITORÍA DE SEGURIDAD OPOSITATEST');
  console.log('=====================================\n');
  console.log('Oposición contratada: Tramitación Procesal (mainContentId=7)');
  console.log(`IDs a probar: ${IDS_TO_TEST.join(', ')}`);
  console.log(`Tiempo estimado: ${(IDS_TO_TEST.length * 0.6).toFixed(1)} minutos\n`);

  loadResults();
  const testedIds = new Set(results.map(r => r.mainContentId));

  console.log('🚀 Abriendo navegador...');
  const browser = await chromium.launchPersistentContext(SESSION_DIR, {
    headless: false,
    executablePath: '/usr/bin/google-chrome',
    args: [
      '--no-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--no-first-run',
      '--disable-infobars'
    ]
  });

  const page = browser.pages()[0] || await browser.newPage();

  // Verificar login
  console.log('🔐 Verificando sesión...');
  await page.goto('https://aula.opositatest.com', { waitUntil: 'domcontentloaded', timeout: 60000 });

  if (page.url().includes('login') || page.url().includes('acceso')) {
    console.log('⚠️  Necesitas iniciar sesión. Hazlo manualmente en el navegador...');
    while (page.url().includes('login') || page.url().includes('acceso')) {
      await sleep(2000);
    }
    console.log('✅ Sesión iniciada correctamente');
  } else {
    console.log('✅ Ya hay sesión activa');
  }

  await sleep(2000);

  for (let i = 0; i < IDS_TO_TEST.length; i++) {
    const id = IDS_TO_TEST[i];

    if (testedIds.has(id)) {
      console.log(`⏭️  mainContentId=${id} ya probado, saltando...`);
      continue;
    }

    const result = await testMainContentId(page, id);
    results.push(result);
    saveResults();
    testedIds.add(id);

    if (i < IDS_TO_TEST.length - 1) {
      const delay = randomDelay();
      console.log(`   ⏳ Esperando ${(delay/1000).toFixed(0)}s...`);
      await sleep(delay);
    }
  }

  // Resumen final
  console.log('\n' + '='.repeat(50));
  console.log('📊 RESUMEN DE LA AUDITORÍA');
  console.log('='.repeat(50));

  const accessible = results.filter(r => r.status === 'ACCESS_OK');
  const blocked = results.filter(r => r.status === 'NO_ACCESS' || r.status === 'REDIRECT_LOGIN');

  console.log(`\n✅ ACCESIBLES (${accessible.length}):`);
  accessible.forEach(r => {
    console.log(`   [${r.mainContentId}] ${r.oposicionName || 'N/A'} - ${r.temasCount} temas`);
  });

  console.log(`\n🔒 BLOQUEADAS (${blocked.length}):`);
  blocked.forEach(r => {
    console.log(`   [${r.mainContentId}]`);
  });

  // Detectar vulnerabilidad
  const unauthorized = accessible.filter(r => r.mainContentId !== 7);
  if (unauthorized.length > 0) {
    console.log('\n⚠️  ¡¡VULNERABILIDAD DETECTADA!!');
    console.log('   Tienes acceso a oposiciones NO contratadas:');
    unauthorized.forEach(r => {
      console.log(`   🚨 [${r.mainContentId}] ${r.oposicionName}`);
    });
  } else {
    console.log('\n✅ No se detectaron fallos de autorización');
  }

  console.log('\n📁 Resultados guardados en: audit-results.json');

  await browser.close();
  console.log('👋 Navegador cerrado');
}

main().catch(console.error);
