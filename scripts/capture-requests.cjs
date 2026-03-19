// Script para capturar requests mientras el usuario navega
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const SESSION_DIR = path.join(__dirname, '.opositatest-session');

async function main() {
  console.log('🔍 CAPTURANDO REQUESTS DE OPOSITATEST');
  console.log('=====================================\n');
  console.log('Navega y crea un test de convocatoria anterior.');
  console.log('Capturaré todas las requests POST y las guardaré.\n');

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

  const capturedRequests = [];

  // Capturar TODAS las requests POST
  page.on('request', async request => {
    const method = request.method();
    const url = request.url();

    if (method === 'POST' && url.includes('api.opositatest.com')) {
      const postData = request.postData();
      console.log('\n' + '='.repeat(60));
      console.log(`📤 POST ${url}`);
      console.log(`   Body: ${postData}`);
      console.log('='.repeat(60));

      capturedRequests.push({
        url,
        method,
        body: postData,
        timestamp: new Date().toISOString()
      });

      // Guardar inmediatamente
      fs.writeFileSync('/tmp/captured-requests.json', JSON.stringify(capturedRequests, null, 2));
    }
  });

  // Capturar respuestas de POST
  page.on('response', async response => {
    const request = response.request();
    if (request.method() === 'POST' && request.url().includes('api.opositatest.com')) {
      try {
        const body = await response.json();
        console.log(`📥 Response: ${JSON.stringify(body).substring(0, 200)}...`);

        // Si es creación de test, guardar el testId
        if (body.id) {
          console.log(`\n✅ TEST CREADO: ${body.id}`);
        }
      } catch (e) {}
    }
  });

  // Navegar a la página de convocatorias
  console.log('📄 Abriendo página de convocatorias anteriores...\n');
  await page.goto('https://aula.opositatest.com/classroom/test-configurator?mainContentId=a5bf8e33-09ad-4e6f-9d1a-d33a2a7e5f98&selectedTab=previous-call');

  console.log('👆 AHORA NAVEGA Y CREA UN TEST DE CONVOCATORIA ANTERIOR');
  console.log('   (Elige cualquier examen y dale a "Empezar")\n');
  console.log('Esperando 5 minutos... Presiona Ctrl+C cuando termines.\n');

  await page.waitForTimeout(300000); // 5 minutos

  console.log('\n📁 Requests capturadas guardadas en /tmp/captured-requests.json');
  await context.close();
}

main().catch(console.error);
