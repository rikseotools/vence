const { chromium } = require('playwright');
const fs = require('fs');
const OUT = process.env.SCRATCH;
const done = (m) => { try { fs.writeFileSync(OUT+'/pw-done.txt', m); } catch {} };
(async () => {
  const browser = await chromium.launch({ headless: false, args: ['--no-sandbox','--start-maximized'] });
  const page = await browser.newContext({ viewport: null }).then(c => c.newPage());
  console.log('VENTANA ABIERTA');
  await page.goto('https://www.vence.es/api/auth/signin', { waitUntil: 'domcontentloaded', timeout: 30000 });
  try { await page.getByRole('button', { name: /google/i }).first().click({ timeout: 8000 }); }
  catch { await page.locator('text=/google/i').first().click({ timeout: 8000 }).catch(()=>{}); }
  console.log('Esperando login de Google del usuario (max 5 min)...');
  try {
    await page.waitForURL(u => u.hostname.endsWith('vence.es') && !u.pathname.startsWith('/api/auth/signin'), { timeout: 300000 });
  } catch(e) { done('TIMEOUT: '+page.url()); await browser.close(); return; }
  await page.waitForTimeout(1500);
  const s = await (await page.goto('https://www.vence.es/api/auth/session')).text();
  fs.writeFileSync(OUT+'/session.json', s);
  const t = await (await page.goto('https://www.vence.es/api/auth/token')).text();
  fs.writeFileSync(OUT+'/token.json', t);
  done('OK');
  console.log('CAPTURADO OK');
  await page.waitForTimeout(800);
  await browser.close();
})().catch(e => { done('ERROR: '+e.message); process.exit(1); });
