// scripts/opofimatica-drive.cjs
// Dirige el navegador logueado (sesión .opofimatica-session) para EMPEZAR un
// test de Quiz Maker y capturar cómo se cargan las preguntas por admin-ajax
// (action + params + respuesta con preguntas/opciones/correcta/explicación).
// Salida: scripts/opofimatica-drive-capture.json + /tmp/opofi_started.html

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const USER_DATA_DIR = path.join(__dirname, '.opofimatica-session');
const OUT = path.join(__dirname, 'opofimatica-drive-capture.json');
const TEST_URL = process.argv[2] || 'https://www.opofimaticaestado.com/test-aleatorio-word/';

function chromePath() {
  for (const c of ['/usr/bin/google-chrome', '/usr/bin/google-chrome-stable']) if (fs.existsSync(c)) return c;
}

(async () => {
  const captures = [];
  const context = await chromium.launchPersistentContext(USER_DATA_DIR, {
    headless: true, // ya logueado; no hace falta ver
    viewport: { width: 1360, height: 900 },
    executablePath: chromePath(),
    channel: 'chrome',
    args: ['--disable-blink-features=AutomationControlled', '--no-first-run'],
    ignoreDefaultArgs: ['--enable-automation'],
  });
  const page = context.pages()[0] || (await context.newPage());

  page.on('response', async (resp) => {
    if (!resp.url().includes('admin-ajax.php')) return;
    try {
      const req = resp.request();
      const post = req.postData() || '';
      const body = await resp.text();
      captures.push({
        action: (post.match(/action=([a-z0-9_%]+)/i) || [])[1] || '(?)',
        postData: post.slice(0, 2500),
        status: resp.status(),
        bodyLen: body.length,
        bodyPreview: body.slice(0, 8000),
      });
      fs.writeFileSync(OUT, JSON.stringify(captures, null, 2));
      console.log(`[ajax] action=${(post.match(/action=([a-z0-9_]+)/i) || [])[1]} status=${resp.status()} len=${body.length}`);
    } catch {}
  });

  console.log('→ abriendo', TEST_URL);
  await page.goto(TEST_URL, { waitUntil: 'networkidle' }).catch(() => {});

  // Buscar y pulsar el botón de empezar (varios selectores/textos de Quiz Maker)
  const startSelectors = [
    '.ays-start-quiz', '.ays_start_button', '.ays-start-button',
    'button:has-text("Empezar")', 'a:has-text("Empezar")',
    'button:has-text("Comenzar")', '*:has-text("Empezar test")',
    '#ays-start-quiz', '.step_content_start_button',
  ];
  let started = false;
  for (const sel of startSelectors) {
    try {
      const el = page.locator(sel).first();
      if (await el.count()) {
        await el.click({ timeout: 3000 });
        console.log('✅ pulsado start:', sel);
        started = true;
        break;
      }
    } catch {}
  }
  if (!started) console.log('⚠️ no encontré botón de empezar (dump del DOM igualmente)');

  await page.waitForTimeout(6000); // esperar carga AJAX de preguntas

  // Extraer preguntas del DOM tras cargar
  const dom = await page.content();
  fs.writeFileSync('/tmp/opofi_started.html', dom);
  const qCount = (dom.match(/ays-question-container/gi) || []).length;
  const aCount = (dom.match(/ays-field-answer|ays-answer/gi) || []).length;
  console.log(`\nDOM tras empezar: ${dom.length} bytes | question-containers=${qCount} | answers=${aCount}`);
  console.log(`capturas admin-ajax: ${captures.length} (guardadas en ${OUT})`);

  await context.close().catch(() => {});
})();
