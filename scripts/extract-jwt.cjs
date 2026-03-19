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

  let jwt = null;

  page.on('request', request => {
    const url = request.url();
    if (url.includes('api.opositatest') || url.includes('admin.opositatest') || url.includes('subscriptions.opositatest')) {
      console.log('Request:', url.substring(0, 80));
      const auth = request.headers()['authorization'];
      if (auth && auth.startsWith('Bearer ') && jwt === null) {
        jwt = auth.replace('Bearer ', '');
        console.log('✅ JWT capturado!');
      }
    }
  });

  console.log('Navegando...');
  await page.goto('https://aula.opositatest.com/classroom/test-configurator?mainContentId=7');
  await new Promise(r => setTimeout(r, 4000));

  console.log('URL actual:', page.url());

  // Si pide login, esperamos
  if (page.url().includes('login')) {
    console.log('⚠️ Necesita login. Hazlo manualmente...');
    while (page.url().includes('login')) {
      await new Promise(r => setTimeout(r, 2000));
    }
    console.log('✅ Logueado, capturando requests...');
    await page.goto('https://aula.opositatest.com/classroom/test-configurator?mainContentId=7');
    await new Promise(r => setTimeout(r, 4000));
  }

  if (jwt) {
    const parts = jwt.split('.');
    const header = JSON.parse(Buffer.from(parts[0], 'base64').toString());
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());

    console.log('\n=== JWT HEADER ===');
    console.log(JSON.stringify(header, null, 2));

    console.log('\n=== JWT PAYLOAD ===');
    console.log(JSON.stringify(payload, null, 2));

    // Guardar token
    fs.writeFileSync(path.join(__dirname, 'jwt-token.txt'), jwt);
    console.log('\n✅ Token guardado en scripts/jwt-token.txt');
  } else {
    console.log('❌ No se capturó JWT');
  }

  await browser.close();
})();
