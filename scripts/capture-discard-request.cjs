// Script para capturar la request real de "Descartar Test"
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const SESSION_DIR = path.join(__dirname, '.opositatest-session');

async function main() {
  console.log('🔍 CAPTURANDO REQUEST DE DESCARTAR TEST\n');

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

  // Capturar TODAS las requests
  console.log('📡 Capturando requests...\n');

  page.on('request', request => {
    const url = request.url();
    const method = request.method();

    // Mostrar requests relevantes (no GET, o que contengan test/discard)
    if (method !== 'GET' || url.includes('discard') || url.includes('delete')) {
      console.log(`📤 ${method} ${url}`);
      if (request.postData()) {
        console.log(`   Body: ${request.postData()}`);
      }
      console.log(`   Headers:`, JSON.stringify(request.headers(), null, 2).substring(0, 500));
      console.log('');
    }
  });

  page.on('response', async response => {
    const url = response.url();
    const method = response.request().method();

    // Mostrar respuestas de requests no-GET
    if (method !== 'GET') {
      console.log(`📥 ${response.status()} ${method} ${url}`);
      try {
        const body = await response.text();
        if (body) console.log(`   Response: ${body.substring(0, 300)}`);
      } catch (e) {}
      console.log('');
    }
  });

  // Navegar a tests guardados
  console.log('📄 Navegando a tests guardados...\n');
  await page.goto('https://aula.opositatest.com/classroom/test/saved-test', {
    waitUntil: 'networkidle'
  });
  await page.waitForTimeout(3000);

  // Buscar el primer test y hacer click en el menú
  console.log('🔍 Buscando botón de menú del primer test...\n');

  // Buscar el botón con el chevron/flecha
  const menuButtons = await page.$$('button:has(svg), [role="button"]:has(svg)');
  console.log(`   Encontrados ${menuButtons.length} botones con SVG`);

  // Intentar encontrar el botón de expandir en el primer card
  const cards = await page.$$('[class*="Card"], [class*="card"]');
  console.log(`   Encontradas ${cards.length} cards\n`);

  if (cards.length > 0) {
    // Buscar el botón dentro del primer card
    const firstCard = cards[0];
    const expandBtn = await firstCard.$('button:last-of-type, [class*="chevron"], [class*="dropdown"]');

    if (expandBtn) {
      console.log('📍 Haciendo click en el menú del primer test...');
      await expandBtn.click();
      await page.waitForTimeout(1000);

      // Buscar "Descartar Test"
      console.log('🔍 Buscando opción "Descartar Test"...\n');
      const discardBtn = await page.$('text=Descartar Test');

      if (discardBtn) {
        console.log('📍 Haciendo click en "Descartar Test"...');
        console.log('='.repeat(60));
        console.log('CAPTURANDO REQUEST DE DESCARTE:');
        console.log('='.repeat(60) + '\n');

        await discardBtn.click();
        await page.waitForTimeout(2000);

        // Confirmar si hay modal
        const confirmBtn = await page.$('text=Confirmar');
        const yesBtn = await page.$('text=Sí');
        const acceptBtn = await page.$('text=Aceptar');

        if (confirmBtn) {
          console.log('📍 Confirmando...');
          await confirmBtn.click();
        } else if (yesBtn) {
          console.log('📍 Confirmando (Sí)...');
          await yesBtn.click();
        } else if (acceptBtn) {
          console.log('📍 Confirmando (Aceptar)...');
          await acceptBtn.click();
        }

        await page.waitForTimeout(3000);
      } else {
        console.log('❌ No se encontró "Descartar Test"');
        // Tomar screenshot para debug
        await page.screenshot({ path: '/tmp/discard-debug.png' });
        console.log('   Screenshot guardado en /tmp/discard-debug.png');
      }
    } else {
      console.log('❌ No se encontró botón de menú');
    }
  }

  console.log('\n⏳ Esperando 10 segundos más para capturar cualquier request adicional...');
  await page.waitForTimeout(10000);

  console.log('\n✅ Captura completada. Cerrando navegador...');
  await context.close();
}

main().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
