const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const SESSION_DIR = path.join(__dirname, '.opositatest-session');
const OUTPUT_FILE = path.join(__dirname, 'api-capture.json');

const captured = {
  requests: [],
  responses: [],
  questions: [],
  flow: []
};

(async () => {
  console.log('=== CAPTURA COMPLETA DEL FLUJO DE TEST ===\n');

  const browser = await chromium.launchPersistentContext(SESSION_DIR, {
    headless: false,
    executablePath: '/usr/bin/google-chrome'
  });

  const page = browser.pages()[0] || await browser.newPage();

  // Interceptar TODAS las requests a la API
  page.on('request', request => {
    const url = request.url();
    if (url.includes('opositatest.com') && url.includes('api')) {
      const entry = {
        timestamp: new Date().toISOString(),
        method: request.method(),
        url: url,
        headers: request.headers(),
        body: request.postData()
      };
      captured.requests.push(entry);

      // Log importante
      if (url.includes('exam') || url.includes('test') || url.includes('question')) {
        console.log(`📤 ${request.method()} ${url.split('.com')[1]?.substring(0, 80)}`);
        if (request.postData()) {
          console.log(`   Body: ${request.postData().substring(0, 200)}`);
        }
      }
    }
  });

  page.on('response', async response => {
    const url = response.url();
    if (url.includes('opositatest.com') && url.includes('api')) {
      try {
        const text = await response.text();
        const entry = {
          timestamp: new Date().toISOString(),
          status: response.status(),
          url: url,
          body: text.substring(0, 5000) // Limitar tamaño
        };
        captured.responses.push(entry);

        // Detectar preguntas
        if (text.includes('"question"') || text.includes('"text"') ||
            text.includes('"options"') || text.includes('"answers"')) {
          console.log(`📥 ${response.status()} ${url.split('.com')[1]?.substring(0, 60)}`);
          console.log(`   🚨 POSIBLES PREGUNTAS (${text.length} bytes)`);

          // Guardar preguntas
          try {
            const data = JSON.parse(text);
            captured.questions.push({
              url: url,
              data: data
            });
          } catch (e) {}
        }

        // Log de tests/exams
        if (url.includes('exam') || url.includes('test')) {
          console.log(`📥 ${response.status()} ${url.split('.com')[1]?.substring(0, 80)}`);
          if (text.length < 1000) {
            console.log(`   ${text.substring(0, 300)}`);
          } else {
            console.log(`   (${text.length} bytes)`);
          }
        }
      } catch (e) {}
    }
  });

  // PASO 1: Login si es necesario
  console.log('1. Verificando sesión...');
  captured.flow.push({ step: 1, action: 'check_session' });

  await page.goto('https://aula.opositatest.com/classroom/test-configurator?mainContentId=7');
  await new Promise(r => setTimeout(r, 3000));

  if (page.url().includes('login')) {
    console.log('   ⚠️ Necesitas hacer login. Hazlo manualmente...');
    while (page.url().includes('login')) {
      await new Promise(r => setTimeout(r, 2000));
    }
    console.log('   ✅ Logueado');
    await page.goto('https://aula.opositatest.com/classroom/test-configurator?mainContentId=7');
    await new Promise(r => setTimeout(r, 3000));
  }

  // PASO 2: Configurar y crear test
  console.log('\n2. Configurando test...');
  captured.flow.push({ step: 2, action: 'configure_test' });

  // Esperar a que cargue la página
  await page.waitForSelector('button', { timeout: 10000 }).catch(() => {});

  // PASO 3: Click en "Empezar test"
  console.log('\n3. Buscando botón de empezar test...');
  captured.flow.push({ step: 3, action: 'start_test' });

  // Buscar el botón de empezar test
  const startButton = await page.$('button:has-text("Empezar test")') ||
                      await page.$('button:has-text("Empezar")') ||
                      await page.$('[data-testid="start-test"]');

  if (startButton) {
    console.log('   Haciendo click en Empezar test...');
    await startButton.click();
    await new Promise(r => setTimeout(r, 5000));
  } else {
    console.log('   ⚠️ No encontré botón. Haz click manualmente en "Empezar test"');
    console.log('   Esperando 30 segundos...');
    await new Promise(r => setTimeout(r, 30000));
  }

  // PASO 4: Capturar preguntas durante el test
  console.log('\n4. Capturando preguntas...');
  captured.flow.push({ step: 4, action: 'capture_questions' });

  console.log('   Esperando 20 segundos para capturar requests...');
  await new Promise(r => setTimeout(r, 20000));

  // PASO 5: Guardar captura
  console.log('\n5. Guardando captura...');
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(captured, null, 2));
  console.log(`   ✅ Guardado en ${OUTPUT_FILE}`);

  // Resumen
  console.log('\n=== RESUMEN ===');
  console.log(`Requests capturadas: ${captured.requests.length}`);
  console.log(`Responses capturadas: ${captured.responses.length}`);
  console.log(`Posibles preguntas: ${captured.questions.length}`);

  // Mostrar endpoints únicos de preguntas
  const questionEndpoints = [...new Set(captured.questions.map(q => q.url))];
  if (questionEndpoints.length > 0) {
    console.log('\n📋 ENDPOINTS DE PREGUNTAS:');
    questionEndpoints.forEach(e => console.log(`   ${e}`));
  }

  console.log('\nCerrando navegador en 10 segundos...');
  await new Promise(r => setTimeout(r, 10000));
  await browser.close();
})();
