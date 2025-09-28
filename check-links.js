#!/usr/bin/env node
import https from 'https';
import http from 'http';
import { URL } from 'url';

const visited = new Set();
const broken = new Map(); // URL rota -> Array de páginas que la enlazan
const working = new Set();
const pending = new Set();
const linkSources = new Map(); // URL -> Array de páginas que la enlazan

// Configuración
const isDev = process.argv.includes('--dev') || process.argv.includes('--local');
const baseUrl = isDev ? 'http://localhost:3000' : 'https://www.ilovetest.pro';
const startUrl = isDev ? 'http://localhost:3000/es' : 'https://www.ilovetest.pro/es';

console.log('🔍 Verificador recursivo de enlaces\n');
console.log(`🌐 Modo: ${isDev ? 'DESARROLLO (localhost:3000)' : 'PRODUCCIÓN (www.ilovetest.pro)'}`);
console.log(`🚀 Comenzando desde: ${startUrl}\n`);

function isInternalLink(url, baseUrl) {
  try {
    const urlObj = new URL(url, baseUrl);
    const baseObj = new URL(baseUrl);
    return urlObj.hostname === baseObj.hostname;
  } catch {
    return false;
  }
}

function normalizeUrl(url) {
  try {
    const urlObj = new URL(url);
    // Remover fragment (#)
    urlObj.hash = '';
    // Remover trailing slash excepto para root
    if (urlObj.pathname.length > 1 && urlObj.pathname.endsWith('/')) {
      urlObj.pathname = urlObj.pathname.slice(0, -1);
    }
    return urlObj.toString();
  } catch {
    return url;
  }
}

function extractLinks(html, baseUrl) {
  const links = new Set();
  
  // Expresiones regulares para encontrar enlaces
  const linkRegex = /<a[^>]+href=["']([^"']+)["'][^>]*>/gi;
  const matches = html.matchAll(linkRegex);
  
  for (const match of matches) {
    const href = match[1];
    
    // Ignorar enlaces especiales
    if (href.startsWith('mailto:') || 
        href.startsWith('tel:') || 
        href.startsWith('javascript:') ||
        href === '#' ||
        href.startsWith('#')) {
      continue;
    }
    
    try {
      const fullUrl = new URL(href, baseUrl);
      const normalizedUrl = normalizeUrl(fullUrl.toString());
      
      if (isInternalLink(normalizedUrl, baseUrl)) {
        links.add(normalizedUrl);
        
        // Registrar la fuente del enlace
        if (!linkSources.has(normalizedUrl)) {
          linkSources.set(normalizedUrl, []);
        }
        linkSources.get(normalizedUrl).push(baseUrl);
      }
    } catch (e) {
      // URL inválida, ignorar
    }
  }
  
  return Array.from(links);
}

function checkUrl(url) {
  return new Promise((resolve) => {
    const urlObj = new URL(url);
    const client = urlObj.protocol === 'https:' ? https : http;
    
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: 'GET',
      timeout: 15000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; RecursiveLinkChecker/1.0)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      }
    };

    const req = client.request(options, (res) => {
      const status = res.statusCode;
      const contentType = res.headers['content-type'] || '';
      let body = '';
      
      // Solo leer el body si es HTML
      if (contentType.includes('text/html')) {
        res.on('data', chunk => body += chunk);
      }
      
      res.on('end', () => {
        const result = {
          url,
          status,
          ok: status >= 200 && status < 400,
          contentType,
          body: contentType.includes('text/html') ? body : ''
        };
        resolve(result);
      });
    });

    req.on('error', (err) => {
      resolve({
        url,
        status: 'ERROR',
        error: err.message,
        ok: false,
        body: ''
      });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({
        url,
        status: 'TIMEOUT',
        error: 'Request timeout',
        ok: false,
        body: ''
      });
    });

    req.end();
  });
}

async function crawlRecursively(url, depth = 0, maxDepth = 5) {
  const normalizedUrl = normalizeUrl(url);
  
  // Evitar loops infinitos
  if (visited.has(normalizedUrl) || depth > maxDepth) {
    return;
  }
  
  visited.add(normalizedUrl);
  pending.add(normalizedUrl);
  
  const indent = '  '.repeat(depth);
  console.log(`${indent}🔍 Verificando: ${normalizedUrl}`);
  
  const result = await checkUrl(normalizedUrl);
  pending.delete(normalizedUrl);
  
  if (result.ok) {
    working.add(normalizedUrl);
    const statusIcon = result.status >= 200 && result.status < 300 ? '✅' : '↩️';
    console.log(`${indent}${statusIcon} ${result.status} - OK`);
    
    // Si es HTML, extraer enlaces y continuar recursión
    if (result.body && result.contentType.includes('text/html')) {
      const links = extractLinks(result.body, normalizedUrl);
      
      if (links.length > 0) {
        console.log(`${indent}  📎 Encontrados ${links.length} enlaces internos`);
        
        // Procesar enlaces en paralelo (máximo 3 a la vez)
        const chunks = [];
        for (let i = 0; i < links.length; i += 3) {
          chunks.push(links.slice(i, i + 3));
        }
        
        for (const chunk of chunks) {
          await Promise.all(
            chunk.map(link => crawlRecursively(link, depth + 1, maxDepth))
          );
        }
      }
    }
  } else {
    // Registrar enlace roto con sus fuentes
    const sources = linkSources.get(normalizedUrl) || [];
    broken.set(normalizedUrl, sources);
    console.log(`${indent}❌ ${result.status} - ${result.error || 'Error'}`);
  }
}

async function main() {
  const startTime = Date.now();
  
  try {
    await crawlRecursively(startUrl);
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    
    console.log('\n' + '='.repeat(80));
    console.log('📊 RESUMEN FINAL:');
    console.log('='.repeat(80));
    console.log(`✅ Enlaces funcionando: ${working.size}`);
    console.log(`❌ Enlaces rotos: ${broken.size}`);
    console.log(`📈 Total verificados: ${visited.size}`);
    console.log(`⏱️  Tiempo total: ${duration}s`);
    
    if (broken.size > 0) {
      console.log('\n🔴 ENLACES ROTOS Y DÓNDE CORREGIRLOS:');
      console.log('='.repeat(80));
      
      Array.from(broken.entries()).sort().forEach(([brokenUrl, sources]) => {
        console.log(`\n❌ ENLACE ROTO: ${brokenUrl}`);
        console.log(`   📄 Encontrado en las siguientes páginas:`);
        
        if (sources.length === 0) {
          console.log(`      • (Página inicial o enlace directo)`);
        } else {
          const uniqueSources = [...new Set(sources)];
          uniqueSources.forEach(source => {
            console.log(`      • ${source}`);
          });
        }
        console.log(`   🔧 ACCIÓN: Actualizar o eliminar este enlace en las páginas mencionadas`);
      });
      
      console.log('\n' + '='.repeat(80));
      console.log('🛠️  RESUMEN DE PÁGINAS A REVISAR:');
      console.log('='.repeat(80));
      
      const pagesToFix = new Set();
      broken.forEach(sources => {
        sources.forEach(source => pagesToFix.add(source));
      });
      
      if (pagesToFix.size > 0) {
        Array.from(pagesToFix).sort().forEach(page => {
          const brokenLinksInPage = [];
          broken.forEach((sources, brokenUrl) => {
            if (sources.includes(page)) {
              brokenLinksInPage.push(brokenUrl);
            }
          });
          
          console.log(`\n📄 ${page}`);
          console.log(`   🔗 Enlaces rotos en esta página: ${brokenLinksInPage.length}`);
          brokenLinksInPage.forEach(link => {
            console.log(`      ❌ ${link}`);
          });
        });
      }
      
      process.exit(1);
    } else {
      console.log('\n🎉 ¡Todos los enlaces funcionan correctamente!');
      process.exit(0);
    }
    
  } catch (error) {
    console.error('\n💥 Error durante la verificación:', error.message);
    process.exit(1);
  }
}

// Manejo de interrupciones
process.on('SIGINT', () => {
  console.log('\n\n⏹️  Verificación interrumpida por el usuario');
  console.log(`📊 Progreso: ${visited.size} URLs verificadas`);
  console.log(`✅ Funcionando: ${working.size}`);
  console.log(`❌ Rotos: ${broken.size}`);
  console.log(`⏳ Pendientes: ${pending.size}`);
  process.exit(0);
});

console.log('💡 Usa Ctrl+C para interrumpir la verificación\n');
main();