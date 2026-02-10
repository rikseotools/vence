#!/usr/bin/env node
/**
 * Script para consultar precios de Paradores - STEALTH MODE
 * Uso: node scripts/scrape-paradores.mjs [--headed] [--mobile]
 */

import { chromium } from 'playwright-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

// Activar plugin stealth
chromium.use(StealthPlugin());

const HEADED = process.argv.includes('--headed');
const MOBILE = process.argv.includes('--mobile');

// Fingerprints de dispositivos reales
const DESKTOP_FINGERPRINT = {
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  viewport: { width: 1920, height: 1080 },
  deviceScaleFactor: 1,
  hasTouch: false,
  isMobile: false,
  // Headers completos de Chrome real
  extraHTTPHeaders: {
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
    'Accept-Encoding': 'gzip, deflate, br',
    'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
    'Cache-Control': 'max-age=0',
    'Connection': 'keep-alive',
    'Sec-Ch-Ua': '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
    'Sec-Ch-Ua-Mobile': '?0',
    'Sec-Ch-Ua-Platform': '"Windows"',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1',
    'Upgrade-Insecure-Requests': '1',
  },
};

const MOBILE_FINGERPRINT = {
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1',
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 3,
  hasTouch: true,
  isMobile: true,
  extraHTTPHeaders: {
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Encoding': 'gzip, deflate, br',
    'Accept-Language': 'es-ES,es;q=0.9',
  },
};

const FINGERPRINT = MOBILE ? MOBILE_FINGERPRINT : DESKTOP_FINGERPRINT;

async function humanBehavior(page) {
  const humanDelay = (min, max) =>
    page.waitForTimeout(Math.floor(Math.random() * (max - min)) + min);

  const humanClick = async (locator) => {
    try {
      await locator.scrollIntoViewIfNeeded();
      const box = await locator.boundingBox();
      if (box) {
        // Movimiento de ratón con curva bezier (más humano)
        const steps = Math.floor(Math.random() * 10) + 15;
        await page.mouse.move(box.x + box.width/2 + (Math.random() - 0.5) * 10,
                              box.y + box.height/2 + (Math.random() - 0.5) * 10,
                              { steps });
        await humanDelay(50, 150);
        await page.mouse.click(box.x + box.width/2, box.y + box.height/2);
        return true;
      }
    } catch (e) {}
    await locator.click();
    return true;
  };

  const humanType = async (text) => {
    for (const char of text) {
      await page.keyboard.type(char, { delay: Math.random() * 100 + 30 });
      // Ocasionalmente pausar más (como un humano pensando)
      if (Math.random() < 0.1) await humanDelay(200, 500);
    }
  };

  const randomScroll = async () => {
    const amount = Math.floor(Math.random() * 300) + 100;
    await page.evaluate((a) => window.scrollBy({ top: a, behavior: 'smooth' }), amount);
  };

  return { humanDelay, humanClick, humanType, randomScroll };
}

async function scrapeParadores() {
  console.log('🏨 Paradores.es - STEALTH MODE');
  console.log(`📅 14-16 febrero 2026`);
  console.log(`📱 Dispositivo: ${MOBILE ? 'iPhone' : 'Windows PC'}`);
  console.log(`🖥️  ${HEADED ? 'Visible' : 'Headless'}\n`);

  const browser = await chromium.launch({
    headless: !HEADED,
    slowMo: 20,
    args: [
      '--disable-blink-features=AutomationControlled',
      '--disable-features=IsolateOrigins,site-per-process',
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--disable-gpu',
      '--window-size=1920,1080',
      '--start-maximized',
      // Flags adicionales para evadir detección
      '--disable-background-networking',
      '--disable-default-apps',
      '--disable-extensions',
      '--disable-sync',
      '--disable-translate',
      '--metrics-recording-only',
      '--mute-audio',
      '--no-default-browser-check',
      '--safebrowsing-disable-auto-update',
    ],
  });

  const context = await browser.newContext({
    ...FINGERPRINT,
    locale: 'es-ES',
    timezoneId: 'Europe/Madrid',
    geolocation: { latitude: 40.4168, longitude: -3.7038 }, // Madrid
    permissions: ['geolocation'],
    colorScheme: 'light',
    reducedMotion: 'no-preference',
    forcedColors: 'none',
  });

  // Scripts anti-detección avanzados
  await context.addInitScript(() => {
    // Ocultar webdriver
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    delete navigator.__proto__.webdriver;

    // Chrome runtime falso
    window.chrome = {
      runtime: { id: undefined },
      loadTimes: function() {},
      csi: function() {},
      app: { isInstalled: false },
    };

    // Plugins falsos (Chrome real tiene plugins)
    Object.defineProperty(navigator, 'plugins', {
      get: () => {
        const plugins = [
          { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
          { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai', description: '' },
          { name: 'Native Client', filename: 'internal-nacl-plugin', description: '' },
        ];
        plugins.length = 3;
        return plugins;
      },
    });

    // Languages
    Object.defineProperty(navigator, 'languages', {
      get: () => ['es-ES', 'es', 'en-US', 'en'],
    });

    // WebGL vendor/renderer (simular GPU real)
    const getParameter = WebGLRenderingContext.prototype.getParameter;
    WebGLRenderingContext.prototype.getParameter = function(parameter) {
      if (parameter === 37445) return 'Intel Inc.'; // UNMASKED_VENDOR_WEBGL
      if (parameter === 37446) return 'Intel Iris OpenGL Engine'; // UNMASKED_RENDERER_WEBGL
      return getParameter.call(this, parameter);
    };

    // Canvas fingerprint randomization
    const toDataURL = HTMLCanvasElement.prototype.toDataURL;
    HTMLCanvasElement.prototype.toDataURL = function(type) {
      if (type === 'image/png' && this.width === 220 && this.height === 30) {
        // Añadir ruido mínimo al canvas fingerprint
        const context = this.getContext('2d');
        const imageData = context.getImageData(0, 0, this.width, this.height);
        for (let i = 0; i < imageData.data.length; i += 4) {
          imageData.data[i] += Math.floor(Math.random() * 2);
        }
        context.putImageData(imageData, 0, 0);
      }
      return toDataURL.apply(this, arguments);
    };

    // Permisos
    const originalQuery = window.navigator.permissions.query;
    window.navigator.permissions.query = (parameters) => (
      parameters.name === 'notifications' ?
        Promise.resolve({ state: Notification.permission }) :
        originalQuery(parameters)
    );

    // Connection API
    Object.defineProperty(navigator, 'connection', {
      get: () => ({
        effectiveType: '4g',
        rtt: 50,
        downlink: 10,
        saveData: false,
      }),
    });

    // Battery API (muchos bots no lo tienen)
    navigator.getBattery = () => Promise.resolve({
      charging: true,
      chargingTime: 0,
      dischargingTime: Infinity,
      level: 1,
    });

    // Hardware concurrency (núcleos CPU)
    Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8 });

    // Device memory
    Object.defineProperty(navigator, 'deviceMemory', { get: () => 8 });
  });

  const page = await context.newPage();
  const { humanDelay, humanClick, humanType, randomScroll } = await humanBehavior(page);

  try {
    console.log('1️⃣  Cargando paradores.es...');
    await page.goto('https://www.paradores.es/es', {
      waitUntil: 'networkidle',
      timeout: 60000,
    });
    await humanDelay(3000, 5000);

    // Comportamiento humano inicial
    await randomScroll();
    await humanDelay(1000, 2000);

    // Cookies
    console.log('2️⃣  Cookies...');
    const cookieBtn = page.locator('button:has-text("ACEPTAR")').first();
    if (await cookieBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await humanClick(cookieBtn);
      await humanDelay(2000, 3000);
      console.log('   ✅ OK');
    }

    await page.screenshot({ path: '/tmp/p-01-home.png' });

    // Scroll aleatorio (comportamiento humano)
    await randomScroll();
    await humanDelay(1000, 1500);

    // Campo de parador - usar el selector exacto encontrado en el HTML
    console.log('3️⃣  Buscando parador...');

    // El input correcto es #edit-search-parador con placeholder="Reserva tu Parador"
    const paradorInput = page.locator('#edit-search-parador').first();

    if (await paradorInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      console.log('   ✅ Input encontrado');

      // Scroll al input primero
      await paradorInput.scrollIntoViewIfNeeded();
      await humanDelay(500, 800);

      // Hacer focus y limpiar
      await paradorInput.focus();
      await humanDelay(300, 500);
      await paradorInput.fill('');
      await humanDelay(300, 500);

      console.log('   ⌨️  Escribiendo "Granada"...');
      // Escribir letra por letra
      await humanType('Granada');
      await humanDelay(2500, 3500);

      await page.screenshot({ path: '/tmp/p-02-search.png' });

      // Esperar autocomplete de Drupal (usa AJAX)
      const autocomplete = page.locator('.ui-autocomplete:visible li, .ui-menu-item:visible, .ui-autocomplete-row').first();
      if (await autocomplete.isVisible({ timeout: 5000 }).catch(() => false)) {
        console.log('   ✅ Autocomplete visible');
        await humanDelay(500, 800);
        await humanClick(autocomplete);
        await humanDelay(2000, 2500);
      } else {
        console.log('   ⌨️  Usando teclado...');
        await page.keyboard.press('ArrowDown');
        await humanDelay(500, 800);
        await page.keyboard.press('Enter');
        await humanDelay(2000, 2500);
      }
    } else {
      console.log('   ⚠️  Input no encontrado, probando selector alternativo...');
      // Intentar con el otro input
      const altInput = page.locator('input[placeholder="Reserva tu Parador"]').first();
      if (await altInput.isVisible({ timeout: 3000 }).catch(() => false)) {
        await altInput.focus();
        await altInput.fill('Granada');
        await humanDelay(2000, 3000);
        await page.keyboard.press('ArrowDown');
        await page.keyboard.press('Enter');
      }
    }

    await page.screenshot({ path: '/tmp/p-03-parador.png' });

    // Fechas - usar selectores específicos encontrados en el HTML
    console.log('4️⃣  Fechas...');

    // El input de llegada tiene class="booking-arrival fast-booking-calendar"
    const llegadaInput = page.locator('.booking-arrival, input.fast-booking-calendar').first();

    if (await llegadaInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      console.log('   📅 Haciendo clic en fecha llegada...');
      await humanClick(llegadaInput);
      await humanDelay(1500, 2000);

      await page.screenshot({ path: '/tmp/p-04-calendar.png' });

      // Esperar a que aparezca el datepicker
      const datepicker = page.locator('.ui-datepicker:visible').first();
      if (await datepicker.isVisible({ timeout: 3000 }).catch(() => false)) {
        console.log('   ✅ Calendario abierto');

        // Navegar a febrero (clic en siguiente)
        const nextBtn = page.locator('.ui-datepicker-next:not(.ui-state-disabled)').first();
        if (await nextBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
          await humanClick(nextBtn);
          await humanDelay(500, 800);
          console.log('   ➡️ Febrero');
        }

        await page.screenshot({ path: '/tmp/p-05-february.png' });

        // Seleccionar día 14 - buscar celda con el número 14
        const day14 = page.locator('.ui-datepicker:visible .ui-datepicker-calendar td:not(.ui-datepicker-unselectable) a').filter({ hasText: /^14$/ }).first();
        if (await day14.isVisible({ timeout: 2000 }).catch(() => false)) {
          await humanClick(day14);
          console.log('   ✅ 14 feb seleccionado');
          await humanDelay(1000, 1500);
        }

        // El datepicker puede cambiar a selección de salida automáticamente
        // O puede necesitar hacer clic en el campo de salida
        await humanDelay(500, 800);

        // Seleccionar día 16 para la salida
        const day16 = page.locator('.ui-datepicker:visible .ui-datepicker-calendar td:not(.ui-datepicker-unselectable) a').filter({ hasText: /^16$/ }).first();
        if (await day16.isVisible({ timeout: 2000 }).catch(() => false)) {
          await humanClick(day16);
          console.log('   ✅ 16 feb seleccionado');
          await humanDelay(800, 1200);
        }
      }
    } else {
      console.log('   ⚠️ Campo de fecha no encontrado');
    }

    await page.screenshot({ path: '/tmp/p-05-dates.png' });

    // VER DISPONIBILIDAD
    console.log('5️⃣  Buscando disponibilidad...');
    const disponibilidadBtn = page.locator('text=VER DISPONIBILIDAD').first();

    if (await disponibilidadBtn.isVisible({ timeout: 3000 })) {
      // Pequeña pausa antes de hacer clic (humano)
      await humanDelay(500, 1000);
      await humanClick(disponibilidadBtn);

      console.log('   ⏳ Esperando resultados...');

      try {
        await page.waitForNavigation({ timeout: 20000, waitUntil: 'domcontentloaded' });
      } catch (e) {}

      await humanDelay(5000, 7000);
    }

    await page.screenshot({ path: '/tmp/p-06-results.png' });
    console.log(`   🌐 URL: ${page.url()}`);

    // Verificar Cloudflare
    let bodyText = await page.locator('body').textContent() || '';

    if (bodyText.includes('blocked') || bodyText.includes('Cloudflare') || bodyText.includes('security')) {
      console.log('\n⚠️  CLOUDFLARE DETECTADO');

      if (HEADED) {
        console.log('   🖱️  Resuelve el captcha en el navegador...');
        console.log('   ⏳ Esperando 90 segundos...\n');

        for (let i = 0; i < 18; i++) {
          await humanDelay(5000, 5000);
          bodyText = await page.locator('body').textContent() || '';
          if (!bodyText.includes('blocked') && !bodyText.includes('Cloudflare')) {
            console.log('   ✅ Desbloqueado!');
            await page.screenshot({ path: '/tmp/p-07-unblocked.png' });
            await humanDelay(3000, 5000);
            break;
          }
          process.stdout.write(`   ${(i+1)*5}s... `);
        }
        console.log('');
      } else {
        console.log('   💡 Prueba con: node scripts/scrape-paradores.mjs --headed');
        console.log('   💡 O prueba móvil: node scripts/scrape-paradores.mjs --headed --mobile');
      }
    }

    // Extraer precios
    console.log('\n6️⃣  Extrayendo precios...');
    bodyText = await page.locator('body').textContent() || '';

    const prices = bodyText.match(/(\d{2,3})[,.]?\d{0,2}\s*€/g) || [];
    const validPrices = [...new Set(prices)].filter(p => {
      const n = parseInt(p);
      return n >= 60 && n <= 500;
    });

    if (validPrices.length > 0) {
      console.log('\n💰 PRECIOS ENCONTRADOS:');
      validPrices.slice(0, 10).forEach(p => console.log(`   ${p}`));
    } else {
      console.log('   ❌ No se encontraron precios');
    }

    // Guardar
    await page.screenshot({ path: '/tmp/p-final.png', fullPage: true });
    const fs = await import('fs');
    fs.writeFileSync('/tmp/paradores.html', await page.content());

    console.log('\n' + '='.repeat(50));
    console.log('📁 Screenshots: /tmp/p-*.png');
    console.log('📄 HTML: /tmp/paradores.html');
    console.log('');
    console.log('Opciones:');
    console.log('  --headed    Navegador visible');
    console.log('  --mobile    Simular iPhone');
    console.log('='.repeat(50));

  } catch (error) {
    console.error('❌ Error:', error.message);
    await page.screenshot({ path: '/tmp/p-error.png' }).catch(() => {});
  } finally {
    await browser.close();
  }
}

scrapeParadores();
