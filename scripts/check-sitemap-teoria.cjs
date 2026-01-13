#!/usr/bin/env node
/**
 * Script para verificar URLs de /teoria y /leyes en el sitemap
 */

const BASE = 'http://localhost:3000';

async function fetchSitemap(url) {
  const res = await fetch(url);
  return res.text();
}

function extractUrls(xml) {
  const urls = [];
  const regex = /<loc>([^<]+)<\/loc>/g;
  let match;
  while ((match = regex.exec(xml)) !== null) {
    urls.push(match[1]);
  }
  return urls;
}

async function check() {
  console.log('🔍 Verificando URLs de /teoria y /leyes en sitemap...\n');

  const xml = await fetchSitemap(BASE + '/sitemap-static.xml');
  let urls = extractUrls(xml);

  // Filter teoria/leyes URLs
  const teoriaUrls = urls.filter(u => u.includes('/teoria/') || u.includes('/leyes'));
  console.log(`📄 URLs de teoria/leyes en sitemap: ${teoriaUrls.length}\n`);

  let errors = 0;
  let checked = 0;

  // Check all teoria/leyes URLs
  for (const url of teoriaUrls) {
    const localUrl = url.replace('https://www.vence.es', BASE);
    try {
      const res = await fetch(localUrl);
      const path = url.replace('https://www.vence.es', '');
      if (res.status !== 200) {
        console.log(`❌ ${res.status} - ${path}`);
        errors++;
      }
      checked++;
      process.stdout.write(`\r   Progreso: ${checked}/${teoriaUrls.length}`);
    } catch (e) {
      console.log(`❌ ERR - ${url}: ${e.message}`);
      errors++;
    }
  }

  console.log('\n');
  console.log(`📊 Resultado: ${checked - errors}/${checked} OK`);

  if (errors === 0) {
    console.log('✅ Sin errores 404 en teoria/leyes');
  } else {
    console.log(`❌ ${errors} URLs con error`);
  }

  process.exit(errors > 0 ? 1 : 0);
}

check().catch(e => {
  console.error('Error:', e.message);
  process.exit(1);
});
