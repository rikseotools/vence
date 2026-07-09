// scripts/opofimatica-capture.cjs
// Abre Chrome visible en OpofimáticaEstado (WordPress + Quiz Maker ays-pro).
// Manuel entra usuario/contraseña y abre un test; el script CAPTURA:
//   - las peticiones admin-ajax.php (action + nonce + params + respuesta con
//     preguntas/opciones/correcta/explicación),
//   - las cookies de sesión de WordPress.
// Salida: scripts/opofimatica-capture.json + scripts/opofimatica-cookies.json
// Sesión persistente en scripts/.opofimatica-session/ (el scraper la reutiliza).

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const USER_DATA_DIR = path.join(__dirname, '.opofimatica-session');
const OUT_CAPTURE = path.join(__dirname, 'opofimatica-capture.json');
const OUT_COOKIES = path.join(__dirname, 'opofimatica-cookies.json');
const START_URL = 'https://www.opofimaticaestado.com/plataforma-de-test/';
const WAIT_MS = 12 * 60 * 1000; // 12 min para loguear + abrir un test

function chromePath() {
  for (const c of ['/usr/bin/google-chrome', '/usr/bin/google-chrome-stable']) {
    if (fs.existsSync(c)) return c;
  }
  return undefined;
}

(async () => {
  const captures = [];
  const saveCaptures = () => fs.writeFileSync(OUT_CAPTURE, JSON.stringify(captures, null, 2));

  const context = await chromium.launchPersistentContext(USER_DATA_DIR, {
    headless: false,
    viewport: { width: 1360, height: 900 },
    executablePath: chromePath(),
    channel: 'chrome',
    args: [
      '--disable-blink-features=AutomationControlled',
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-infobars',
    ],
    ignoreDefaultArgs: ['--enable-automation'],
  });

  const page = context.pages()[0] || (await context.newPage());
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
  });

  async function saveCookies(tag) {
    try {
      const cookies = await context.cookies();
      fs.writeFileSync(OUT_COOKIES, JSON.stringify(cookies, null, 2));
      const logged = cookies.some((c) => /wordpress_logged_in/i.test(c.name));
      console.log(`🍪 cookies guardadas (${cookies.length}) ${logged ? '✅ SESIÓN WP ACTIVA' : ''} [${tag}]`);
    } catch {}
  }

  page.on('response', async (resp) => {
    const url = resp.url();
    if (!url.includes('admin-ajax.php')) return;
    try {
      const req = resp.request();
      const postData = req.postData() || '';
      const body = await resp.text();
      const action = (postData.match(/action=([a-z0-9_%]+)/i) || [])[1] || '(?)';
      const nonce = (postData.match(/nonce[^=]*=([a-z0-9]+)/i) || [])[1] || null;
      const isQuiz = /ays|quiz|question|answer|correct/i.test(postData + body);
      captures.push({
        ts: new Date().toISOString(),
        url,
        method: req.method(),
        action,
        nonce,
        postData: postData.slice(0, 3000),
        status: resp.status(),
        bodyLen: body.length,
        bodyPreview: body.slice(0, 6000),
        isQuiz,
      });
      saveCaptures();
      console.log(`[admin-ajax] action=${action} status=${resp.status()} len=${body.length}${nonce ? ' nonce=' + nonce.slice(0, 8) : ''}${isQuiz ? '  🎯 QUIZ' : ''}`);
      if (isQuiz) await saveCookies('quiz-capture');
    } catch {}
  });

  await page.goto(START_URL, { waitUntil: 'domcontentloaded' }).catch(() => {});
  console.log('\n=== CHROME ABIERTO EN OPOFIMÁTICAESTADO ===');
  console.log('1) Inicia sesión con tu usuario y contraseña.');
  console.log('2) Abre un TEST y responde 1-2 preguntas (para capturar la respuesta AJAX con la correcta).');
  console.log('Voy guardando en:', OUT_CAPTURE, '/', OUT_COOKIES);
  console.log('Se cerrará solo en ~12 min (o ciérralo tú al acabar).\n');

  // Guardar cookies periódicamente por si cierra antes
  const iv = setInterval(() => saveCookies('periodic'), 30000);

  await page.waitForTimeout(WAIT_MS).catch(() => {});
  clearInterval(iv);
  await saveCookies('final');
  console.log(`\n✅ Fin. ${captures.length} peticiones admin-ajax capturadas (${captures.filter((c) => c.isQuiz).length} de quiz).`);
  await context.close().catch(() => {});
})();
