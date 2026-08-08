// Verifica CON NAVEGADOR REAL las URLs de canje de Zalando (fetch da 403 por WAF).
// Regla del runbook §3.ter.bis: nunca se registra una marca con un enlace no abierto.
const { chromium } = require('playwright');

const URLS = [
  'https://www.zalando.es/mistarjetasregalo',
  'https://www.zalando.es/preguntas-frecuentes/Vales-y-tarjetas-regalo/Canjear-tarjeta-regalo.html',
];

(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ locale: 'es-ES' });
  for (const url of URLS) {
    const page = await ctx.newPage();
    try {
      const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
      const texto = (await page.innerText('body').catch(() => '')).replace(/\s+/g, ' ').slice(0, 400);
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
