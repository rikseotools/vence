// 2.º intento: navegador con UA real y cabeceras de navegador (el headless pelado da 403).
const { chromium } = require('playwright');

const URLS = [
  'https://www.zalando.es/mistarjetasregalo',
  'https://www.zalando.es/preguntas-frecuentes/Vales-y-tarjetas-regalo/Canjear-tarjeta-regalo.html',
];
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

(async () => {
  const b = await chromium.launch({ args: ['--disable-blink-features=AutomationControlled'] });
  const ctx = await b.newContext({
    locale: 'es-ES',
    userAgent: UA,
    viewport: { width: 1280, height: 900 },
    extraHTTPHeaders: {
      'Accept-Language': 'es-ES,es;q=0.9',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    },
  });
  await ctx.addInitScript(() => Object.defineProperty(navigator, 'webdriver', { get: () => undefined }));
  for (const url of URLS) {
    const page = await ctx.newPage();
    try {
      const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
      await page.waitForTimeout(2500);
      const texto = (await page.innerText('body').catch(() => '')).replace(/\s+/g, ' ').slice(0, 500);
      console.log('\n=== ' + url);
      console.log('HTTP', resp && resp.status(), '· url final:', page.url());
      console.log('título:', await page.title());
      console.log('texto:', texto);
    } catch (e) {
      console.log('\n=== ' + url + '\nFALLO: ' + e.message);
    }
    await page.close();
  }
  await b.close();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
