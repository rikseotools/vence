#!/usr/bin/env node
/**
 * Script para verificar el sitemap local
 * Uso: node scripts/check-sitemap.js [--base-url=http://localhost:3000]
 */

const BASE_URL = process.argv.find(arg => arg.startsWith('--base-url='))?.split('=')[1] || 'http://localhost:3000';

async function fetchSitemap(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Error fetching ${url}: ${response.status}`);
  }
  return response.text();
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

async function checkUrl(url, index, total) {
  const localUrl = url.replace('https://www.vence.es', BASE_URL);
  const start = Date.now();

  try {
    const response = await fetch(localUrl, {
      method: 'GET',
      redirect: 'follow'
    });
    const time = Date.now() - start;

    return {
      url: url.replace('https://www.vence.es', ''),
      status: response.status,
      ok: response.ok,
      time
    };
  } catch (error) {
    return {
      url: url.replace('https://www.vence.es', ''),
      status: 'ERROR',
      ok: false,
      error: error.message
    };
  }
}

async function main() {
  console.log(`🔍 Verificando sitemap en ${BASE_URL}\n`);

  // Obtener todos los sitemaps
  const sitemaps = [
    '/sitemap.xml',
    '/sitemap-static.xml',
    '/sitemap-convocatorias.xml',
    '/sitemap-oposiciones.xml'
  ];

  let allUrls = [];

  for (const sitemap of sitemaps) {
    try {
      console.log(`📄 Fetching ${sitemap}...`);
      const xml = await fetchSitemap(`${BASE_URL}${sitemap}`);
      const urls = extractUrls(xml);
      console.log(`   ✅ ${urls.length} URLs encontradas\n`);
      allUrls = allUrls.concat(urls);
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}\n`);
    }
  }

  console.log(`\n📊 Total URLs en sitemaps: ${allUrls.length}\n`);

  // Preguntar si quiere verificar todas
  if (allUrls.length > 50) {
    console.log(`⚠️  Hay muchas URLs. Verificando solo las primeras 50...`);
    console.log(`   (usa --all para verificar todas)\n`);
    if (!process.argv.includes('--all')) {
      allUrls = allUrls.slice(0, 50);
    }
  }

  // Verificar URLs
  console.log(`🔗 Verificando ${allUrls.length} URLs...\n`);

  const results = [];
  const concurrency = 5;

  for (let i = 0; i < allUrls.length; i += concurrency) {
    const batch = allUrls.slice(i, i + concurrency);
    const batchResults = await Promise.all(
      batch.map((url, idx) => checkUrl(url, i + idx, allUrls.length))
    );
    results.push(...batchResults);

    // Mostrar progreso
    const progress = Math.min(i + concurrency, allUrls.length);
    process.stdout.write(`\r   Progreso: ${progress}/${allUrls.length}`);
  }

  console.log('\n');

  // Resumen
  const ok = results.filter(r => r.ok);
  const failed = results.filter(r => !r.ok);

  console.log('━'.repeat(60));
  console.log('📊 RESUMEN');
  console.log('━'.repeat(60));
  console.log(`✅ OK: ${ok.length}`);
  console.log(`❌ Fallidas: ${failed.length}`);
  console.log(`📄 Total verificadas: ${results.length}`);

  if (failed.length > 0) {
    console.log('\n❌ URLs con error:');
    failed.forEach(r => {
      console.log(`   ${r.status} - ${r.url}${r.error ? ` (${r.error})` : ''}`);
    });
  }

  // Estadísticas de tiempo
  const times = ok.map(r => r.time);
  if (times.length > 0) {
    const avg = Math.round(times.reduce((a, b) => a + b, 0) / times.length);
    const max = Math.max(...times);
    const min = Math.min(...times);
    console.log(`\n⏱️  Tiempos de respuesta:`);
    console.log(`   Promedio: ${avg}ms | Min: ${min}ms | Max: ${max}ms`);
  }

  // URLs lentas (> 1s)
  const slow = ok.filter(r => r.time > 1000);
  if (slow.length > 0) {
    console.log(`\n🐢 URLs lentas (>1s):`);
    slow.sort((a, b) => b.time - a.time).forEach(r => {
      console.log(`   ${r.time}ms - ${r.url}`);
    });
  }

  console.log('\n');

  // Exit code
  process.exit(failed.length > 0 ? 1 : 0);
}

main().catch(error => {
  console.error('❌ Error fatal:', error.message);
  process.exit(1);
});
