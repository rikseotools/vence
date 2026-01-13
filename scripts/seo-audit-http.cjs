/**
 * Auditoría SEO HTTP - Crawler real
 * Crawlea el sitio desde la home y encuentra enlaces rotos
 */

const BASE_URL = 'http://localhost:3000';

// Colores
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const GREEN = '\x1b[32m';
const CYAN = '\x1b[36m';
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';

const visited = new Set();
const broken = [];
const slow = [];
const allLinks = new Map(); // url -> [páginas que lo enlazan]

async function fetchPage(url) {
  try {
    const response = await fetch(url, {
      redirect: 'follow',
      headers: { 'User-Agent': 'SEO-Audit-Crawler/1.0' }
    });

    const status = response.status;
    const html = status === 200 ? await response.text() : '';

    return { status, html };
  } catch (error) {
    return { status: 0, error: error.message };
  }
}

function extractLinks(html, currentUrl) {
  const links = new Set();

  // Buscar href="..." y href='...'
  const hrefRegex = /href=["']([^"']+)["']/g;
  let match;

  while ((match = hrefRegex.exec(html)) !== null) {
    let href = match[1];

    // Ignorar anchors, javascript, mailto, tel, externos
    if (href.startsWith('#') ||
        href.startsWith('javascript:') ||
        href.startsWith('mailto:') ||
        href.startsWith('tel:') ||
        href.startsWith('http://') ||
        href.startsWith('https://') ||
        href.startsWith('//')) {
      continue;
    }

    // Convertir rutas relativas a absolutas
    if (href.startsWith('/')) {
      links.add(href);
    }
  }

  return [...links];
}

async function crawl(startUrl, maxPages = 200) {
  const queue = [startUrl];
  let processed = 0;

  console.log(`${CYAN}Iniciando crawl desde ${startUrl}...${RESET}\n`);

  while (queue.length > 0 && processed < maxPages) {
    const path = queue.shift();

    if (visited.has(path)) continue;
    visited.add(path);

    const url = `${BASE_URL}${path}`;
    const startTime = Date.now();
    const { status, html, error } = await fetchPage(url);
    const elapsed = Date.now() - startTime;

    processed++;

    if (status === 404) {
      // Encontrar quién enlaza a esta página rota
      const linkedFrom = allLinks.get(path) || ['(entrada directa)'];
      broken.push({ url: path, linkedFrom });
      console.log(`${RED}[404]${RESET} ${path}`);
      console.log(`      ${YELLOW}← enlazado desde: ${linkedFrom[0]}${RESET}`);
      continue;
    }

    if (status === 0) {
      console.log(`${RED}[ERR]${RESET} ${path} - ${error}`);
      continue;
    }

    if (elapsed > 3000) {
      slow.push({ url: path, elapsed });
      console.log(`${YELLOW}[SLOW]${RESET} ${path} (${elapsed}ms)`);
    } else {
      console.log(`${GREEN}[${status}]${RESET} ${path} (${elapsed}ms) - ${queue.length} en cola`);
    }

    // Extraer enlaces y añadir a la cola
    if (status === 200 && html) {
      const links = extractLinks(html, path);

      for (const link of links) {
        // Registrar quién enlaza a cada URL
        if (!allLinks.has(link)) {
          allLinks.set(link, []);
        }
        if (!allLinks.get(link).includes(path)) {
          allLinks.get(link).push(path);
        }

        // Añadir a cola si no visitado
        if (!visited.has(link) && !queue.includes(link)) {
          queue.push(link);
        }
      }
    }
  }

  return { processed, broken, slow };
}

async function main() {
  console.log(`\n${BOLD}========================================${RESET}`);
  console.log(`${BOLD}   AUDITORÍA SEO - CRAWLER REAL${RESET}`);
  console.log(`${BOLD}========================================${RESET}\n`);

  const startTime = Date.now();
  const { processed } = await crawl('/');
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log(`\n${BOLD}========================================${RESET}`);
  console.log(`${BOLD}   RESUMEN${RESET}`);
  console.log(`${BOLD}========================================${RESET}\n`);

  console.log(`Páginas crawleadas: ${processed}`);
  console.log(`Tiempo total: ${elapsed}s`);
  console.log(`${GREEN}Páginas OK: ${processed - broken.length}${RESET}`);

  if (broken.length > 0) {
    console.log(`\n${RED}${BOLD}ENLACES ROTOS: ${broken.length}${RESET}`);
    broken.forEach(b => {
      console.log(`\n   ${RED}${b.url}${RESET}`);
      console.log(`   Enlazado desde:`);
      b.linkedFrom.slice(0, 3).forEach(from => {
        console.log(`     - ${from}`);
      });
    });
  } else {
    console.log(`\n${GREEN}${BOLD}No se encontraron enlaces rotos${RESET}`);
  }

  if (slow.length > 0) {
    console.log(`\n${YELLOW}Páginas lentas (>3s): ${slow.length}${RESET}`);
    slow.forEach(s => console.log(`   - ${s.url}: ${s.elapsed}ms`));
  }

  console.log('\n');
}

main().catch(console.error);
