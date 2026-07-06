// backend/src/competitors/tech-detect.ts
//
// Detección PURA del stack de un competidor a partir de lo que YA descargamos
// (HTML de la home + cabeceras de respuesta). Cero requests extra dedicados.
// El resultado decide la estrategia de scraping (ver docs/roadmap/analizador-competidores.md).

export interface DetectedTech {
  cms: string | null; // wordpress | moodle | joomla | drupal | ...
  sitemapGenerator: string | null; // yoast | rankmath | ...
  server: string | null; // apache | nginx | ...
  cdnWaf: string | null; // cloudflare | sucuri | ...
}

/** Lee el <meta name="generator" content="..."> (en cualquier orden de atributos). */
function metaGenerator(html: string): string {
  const a = html.match(/<meta[^>]+name=["']generator["'][^>]+content=["']([^"']+)["']/i);
  if (a) return a[1];
  const b = html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']generator["']/i);
  return b ? b[1] : '';
}

export function detectTech(html: string, headers: Record<string, string>): DetectedTech {
  const gen = metaGenerator(html);
  const genL = gen.toLowerCase();

  let cms: string | null = null;
  if (/wordpress/.test(genL) || /wp-content\//.test(html)) cms = 'wordpress';
  else if (/moodle/.test(genL) || /moodle/i.test(html)) cms = 'moodle';
  else if (/joomla/.test(genL)) cms = 'joomla';
  else if (/drupal/.test(genL)) cms = 'drupal';
  else if (gen) cms = genL.split(/[\s/]/)[0] || null;

  let sitemapGenerator: string | null = null;
  if (/yoast/i.test(genL) || /yoast/i.test(html)) sitemapGenerator = 'yoast';
  else if (/rank\s*math/i.test(html)) sitemapGenerator = 'rankmath';

  const server = headers['server'] ? headers['server'].toLowerCase().split('/')[0] : null;

  let cdnWaf: string | null = null;
  if (headers['cf-ray'] || /cloudflare/i.test(server ?? '')) cdnWaf = 'cloudflare';
  else if (headers['x-sucuri-id']) cdnWaf = 'sucuri';

  return { cms, sitemapGenerator, server, cdnWaf };
}
