// backend/src/competitors/sitemap.ts
//
// Parser PURO de sitemaps XML (index + urlset). Sin dependencias de XML: los
// sitemaps son planos y regex basta (robusto ante namespaces/atributos). Es la
// base del "analizador de URLs": leer TODAS las URLs del competidor y detectar
// las nuevas. La clasificación por tipo de URL vive en cada adapter (es
// específica del esquema de URLs de cada sitio).
//
// Diseño: docs/roadmap/analizador-competidores.md

export interface SitemapEntry {
  loc: string;
  /** `<lastmod>` en ISO si el sitemap lo declara; null si no. */
  lastmod: string | null;
}

export interface ParsedSitemap {
  entries: SitemapEntry[];
  /** true si es un <sitemapindex> (sus locs apuntan a otros sitemaps). */
  isIndex: boolean;
}

const BLOCK_RE = /<(url|sitemap)\b[^>]*>([\s\S]*?)<\/\1>/gi;
const LOC_RE = /<loc>\s*([\s\S]*?)\s*<\/loc>/i;
const LASTMOD_RE = /<lastmod>\s*([\s\S]*?)\s*<\/lastmod>/i;

/** Decodifica un <loc>: desenvuelve CDATA (mad.es) y las entidades XML. */
function decodeXml(s: string): string {
  return s
    .replace(/^<!\[CDATA\[([\s\S]*?)\]\]>$/, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'");
}

/**
 * Parsea un sitemap (index o urlset) a entradas normalizadas.
 * Reconoce tanto `<sitemap>` (index) como `<url>` (urlset) — mismo shape.
 */
export function parseSitemapXml(xml: string): ParsedSitemap {
  const isIndex = /<sitemapindex[\s>]/i.test(xml);
  const entries: SitemapEntry[] = [];
  const seen = new Set<string>();
  BLOCK_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = BLOCK_RE.exec(xml)) !== null) {
    const block = m[2];
    const locMatch = LOC_RE.exec(block);
    if (!locMatch) continue;
    const loc = decodeXml(locMatch[1].trim());
    if (!loc || seen.has(loc)) continue;
    seen.add(loc);
    const lastmodMatch = LASTMOD_RE.exec(block);
    entries.push({ loc, lastmod: lastmodMatch ? lastmodMatch[1].trim() : null });
  }
  return { entries, isIndex };
}
