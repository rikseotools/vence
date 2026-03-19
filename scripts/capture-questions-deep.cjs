const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const SESSION_DIR = path.join(__dirname, '.opositatest-session');

const allRequests = [];
const allResponses = [];

(async () => {
  console.log('=== CAPTURA PROFUNDA DE PREGUNTAS ===\n');
  console.log('INSTRUCCIONES:');
  console.log('1. Se abrirá el navegador');
  console.log('2. Haz click en "Empezar test" o continúa un test');
  console.log('3. Avanza a la siguiente pregunta');
  console.log('4. El script capturará TODOS los requests');
  console.log('');

  const browser = await chromium.launchPersistentContext(SESSION_DIR, {
    headless: false,
    executablePath: '/usr/bin/google-chrome'
  });

  const page = browser.pages()[0] || await browser.newPage();

  // Capturar TODAS las requests
  page.on('request', request => {
    const url = request.url();
    if (url.includes('opositatest')) {
      allRequests.push({
        time: Date.now(),
        method: request.method(),
        url: url,
        body: request.postData()
      });
    }
  });

  page.on('response', async response => {
    const url = response.url();
    if (url.includes('opositatest') && url.includes('api')) {
      try {
        const text = await response.text();
        const entry = {
          time: Date.now(),
          status: response.status(),
          url: url,
          size: text.length,
          preview: text.substring(0, 500)
        };

        // Detectar si contiene preguntas
        const lower = text.toLowerCase();
        if (lower.includes('"question"') || lower.includes('"text"') ||
            lower.includes('"options"') || lower.includes('"answer"') ||
            lower.includes('"responses"') || lower.includes('"pregunta"')) {
          entry.hasQuestions = true;
          entry.fullBody = text;
          console.log(`\n🚨 POSIBLES PREGUNTAS: ${url.split('.com')[1]?.substring(0, 60)}`);
          console.log(`   Tamaño: ${text.length} bytes`);
        }

        allResponses.push(entry);

        // Log de requests importantes
        if (url.includes('test') || url.includes('exam') || url.includes('question')) {
          console.log(`📥 ${response.status()} ${url.split('.com')[1]?.substring(0, 80)}`);
        }
      } catch (e) {}
    }
  });

  // Navegar al configurador
  console.log('Navegando al configurador de test...\n');
  await page.goto('https://aula.opositatest.com/classroom/test-configurator?mainContentId=7');

  // Esperar login si es necesario
  await new Promise(r => setTimeout(r, 3000));
  if (page.url().includes('login')) {
    console.log('⚠️ Haz login manualmente...');
    while (page.url().includes('login')) {
      await new Promise(r => setTimeout(r, 2000));
    }
    await page.goto('https://aula.opositatest.com/classroom/test-configurator?mainContentId=7');
  }

  console.log('\n📋 Página lista. Ahora:');
  console.log('   1. Haz click en "Empezar test"');
  console.log('   2. Responde algunas preguntas o navega');
  console.log('   3. Espera a que capture los requests');
  console.log('\n⏳ Esperando 90 segundos...\n');

  await new Promise(r => setTimeout(r, 90000));

  // Guardar captura
  console.log('\n=== GUARDANDO CAPTURA ===');

  const questionsResponses = allResponses.filter(r => r.hasQuestions);
  console.log(`Total requests: ${allRequests.length}`);
  console.log(`Total responses: ${allResponses.length}`);
  console.log(`Responses con preguntas: ${questionsResponses.length}`);

  // Guardar todo
  const output = {
    timestamp: new Date().toISOString(),
    requests: allRequests,
    responses: allResponses,
    questionsResponses: questionsResponses
  };

  fs.writeFileSync(path.join(__dirname, 'deep-capture.json'), JSON.stringify(output, null, 2));
  console.log('\n✅ Guardado en scripts/deep-capture.json');

  // Mostrar endpoints de preguntas encontrados
  if (questionsResponses.length > 0) {
    console.log('\n📋 ENDPOINTS CON PREGUNTAS:');
    questionsResponses.forEach(r => {
      console.log(`   ${r.url.split('.com')[1]}`);
    });

    // Guardar preguntas por separado
    fs.writeFileSync(
      path.join(__dirname, 'captured-questions.json'),
      JSON.stringify(questionsResponses.map(r => ({
        url: r.url,
        body: r.fullBody
      })), null, 2)
    );
    console.log('✅ Preguntas guardadas en scripts/captured-questions.json');
  }

  await browser.close();
})();
