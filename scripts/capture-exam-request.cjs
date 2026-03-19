const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

(async () => {
  console.log('Abriendo navegador...');

  const browser = await chromium.launchPersistentContext(
    path.join(__dirname, '.opositatest-session'),
    { headless: false, executablePath: '/usr/bin/google-chrome' }
  );

  const page = browser.pages()[0] || await browser.newPage();

  // Capturar requests POST a exams
  page.on('request', async request => {
    if (request.url().includes('/exams') && request.method() === 'POST') {
      console.log('\n🎯 POST /exams CAPTURADO!');
      console.log('URL:', request.url());
      console.log('Headers:', JSON.stringify(request.headers(), null, 2));
      console.log('Body:', request.postData());

      // Guardar para usar después
      fs.writeFileSync(path.join(__dirname, 'exam-request.json'), JSON.stringify({
        url: request.url(),
        method: request.method(),
        headers: request.headers(),
        body: request.postData()
      }, null, 2));
    }
  });

  page.on('response', async response => {
    if (response.url().includes('/exams') && response.request().method() === 'POST') {
      console.log('\n📥 RESPONSE:');
      console.log('Status:', response.status());
      try {
        const body = await response.text();
        console.log('Body:', body.substring(0, 500));
      } catch (e) {}
    }
  });

  // Ir a la página de tramitación (que SÍ tiene suscripción)
  console.log('\nNavegando a Tramitación Procesal...');
  await page.goto('https://aula.opositatest.com/classroom/test-configurator?mainContentId=7');

  console.log('\n⏳ Haz click en "Empezar test" en el navegador para capturar la petición...');
  console.log('   (Esperando 60 segundos)');

  await new Promise(r => setTimeout(r, 60000));

  await browser.close();
  console.log('\nNavegador cerrado');
})();
