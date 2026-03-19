// Script para investigar el endpoint de descarte de tests
// Captura las requests cuando el usuario descarta un test manualmente

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const SESSION_DIR = path.join(__dirname, '.opositatest-session');

async function main() {
  console.log('🔍 INVESTIGACIÓN DEL ENDPOINT DE DESCARTE\n');
  console.log('Este script capturará todas las requests cuando descartes un test.\n');

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
  const capturedRequests = [];

  page.on('request', request => {
    const url = request.url();
    const method = request.method();

    // Filtrar solo requests a la API
    if (url.includes('opositatest.com/api') || url.includes('admin.opositatest')) {
      const data = {
        timestamp: new Date().toISOString(),
        method,
        url,
        headers: request.headers(),
        postData: request.postData()
      };

      capturedRequests.push(data);

      // Mostrar en consola requests importantes
      if (method !== 'GET' || url.includes('test')) {
        console.log(`📤 ${method} ${url}`);
        if (request.postData()) {
          console.log(`   Body: ${request.postData()}`);
        }
      }
    }
  });

  page.on('response', async response => {
    const url = response.url();
    const method = response.request().method();

    if ((url.includes('test') || url.includes('discard')) && method !== 'GET') {
      console.log(`📥 ${response.status()} ${method} ${url}`);
      try {
        const body = await response.text();
        console.log(`   Response: ${body.substring(0, 200)}`);
      } catch (e) {}
    }
  });

  // Navegar a tests guardados
  console.log('📄 Navegando a tests guardados...');
  console.log('   https://aula.opositatest.com/classroom/test/saved-test\n');

  await page.goto('https://aula.opositatest.com/classroom/test/saved-test', {
    waitUntil: 'networkidle'
  });

  console.log('='.repeat(60));
  console.log('⚡ INSTRUCCIONES:');
  console.log('='.repeat(60));
  console.log('1. Haz click en la flecha de uno de los tests guardados');
  console.log('2. Haz click en "Descartar Test"');
  console.log('3. Confirma si te lo pide');
  console.log('');
  console.log('📝 Las requests se mostrarán aquí automáticamente.');
  console.log('   Cuando termines, presiona Ctrl+C para ver el resumen.');
  console.log('='.repeat(60) + '\n');

  // Guardar requests periódicamente
  setInterval(() => {
    if (capturedRequests.length > 0) {
      fs.writeFileSync('/tmp/discard-requests.json', JSON.stringify(capturedRequests, null, 2));
    }
  }, 2000);

  // Mantener abierto
  await new Promise(() => {});
}

main().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
