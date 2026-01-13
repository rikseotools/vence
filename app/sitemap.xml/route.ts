/**
 * Sitemap Index - Índice principal de todos los sitemaps
 * /sitemap.xml
 *
 * Referencia a todos los sitemaps individuales:
 * - sitemap-static.xml: Páginas estáticas, temarios, leyes, tests
 * - sitemap-oposiciones.xml: Filtros /oposiciones/
 */

const SITE_URL = process.env.NEXT_PUBLIC_URL || 'https://www.vence.es';

export const revalidate = 86400; // Regenerar cada 24 horas

export async function GET() {
  const today = new Date().toISOString();

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>${SITE_URL}/sitemap-static.xml</loc>
    <lastmod>${today}</lastmod>
  </sitemap>
  <sitemap>
    <loc>${SITE_URL}/sitemap-oposiciones.xml</loc>
    <lastmod>${today}</lastmod>
  </sitemap>
</sitemapindex>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, max-age=86400, s-maxage=86400'
    }
  });
}
