/**
 * Sitemap de /oposiciones/ - URLs principales para SEO
 * /sitemap-oposiciones.xml
 *
 * Estas son las URLs canónicas para búsquedas de "oposiciones"
 * (mayor volumen de búsquedas que "convocatorias")
 */
import { ALL_OPOSICION_SLUGS } from '@/lib/config/oposiciones'

const SITE_URL = process.env.NEXT_PUBLIC_URL || 'https://www.vence.es';

export const revalidate = 86400; // Regenerar cada 24 horas

export async function GET() {
  const urls: string[] = [];
  const today = new Date().toISOString().split('T')[0];

  // ============================================
  // CCAA (17 principales)
  // ============================================
  const ccaaList = [
    'andalucia', 'aragon', 'asturias', 'islas-baleares', 'canarias',
    'cantabria', 'castilla-la-mancha', 'castilla-y-leon', 'cataluna',
    'comunidad-valenciana', 'extremadura', 'galicia', 'la-rioja',
    'madrid', 'murcia', 'navarra', 'pais-vasco'
  ];

  ccaaList.forEach(ccaa => {
    urls.push(`
  <url>
    <loc>${SITE_URL}/oposiciones/${ccaa}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.95</priority>
  </url>`);
  });

  // ============================================
  // CATEGORÍAS
  // ============================================
  const categoriasList = ['c1', 'c2', 'a1', 'a2', 'b', 'grupo-c', 'grupo-a'];

  categoriasList.forEach(categoria => {
    urls.push(`
  <url>
    <loc>${SITE_URL}/oposiciones/${categoria}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>`);
  });

  // ============================================
  // OPOSICIONES ESPECÍFICAS
  // ============================================
  // Slugs de config + variantes SEO (sin sufijo -estado, nombres genéricos)
  const seoExtraSlugs = ['auxiliar-administrativo', 'administrativo', 'gestion-procesal']
  const oposicionesList = [...ALL_OPOSICION_SLUGS, ...seoExtraSlugs.filter(s => !ALL_OPOSICION_SLUGS.includes(s))]

  oposicionesList.forEach(oposicion => {
    urls.push(`
  <url>
    <loc>${SITE_URL}/oposiciones/${oposicion}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>`);
  });

  // ============================================
  // ÁMBITO TERRITORIAL
  // ============================================
  const ambitosList = ['estatal', 'age', 'autonomico', 'local', 'ayuntamientos'];

  ambitosList.forEach(ambito => {
    urls.push(`
  <url>
    <loc>${SITE_URL}/oposiciones/${ambito}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.85</priority>
  </url>`);
  });

  // ============================================
  // FILTROS TEMPORALES
  // ============================================
  const temporalesList = ['hoy', 'esta-semana', 'este-mes', '2026', '2025', 'nuevas'];

  temporalesList.forEach(temporal => {
    urls.push(`
  <url>
    <loc>${SITE_URL}/oposiciones/${temporal}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>`);
  });

  // ============================================
  // TIPOS DE PUBLICACIÓN
  // ============================================
  const tiposList = ['convocatorias', 'admitidos', 'tribunales', 'resultados'];

  tiposList.forEach(tipo => {
    urls.push(`
  <url>
    <loc>${SITE_URL}/oposiciones/${tipo}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.85</priority>
  </url>`);
  });

  // ============================================
  // PROVINCIAS PRINCIPALES
  // ============================================
  const provinciasList = [
    'barcelona', 'sevilla', 'malaga', 'alicante', 'bilbao',
    'zaragoza', 'valencia', 'murcia', 'granada', 'cordoba'
  ];

  provinciasList.forEach(provincia => {
    urls.push(`
  <url>
    <loc>${SITE_URL}/oposiciones/${provincia}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>`);
  });

  // ============================================
  // COMBINADOS (Oposición + CCAA) - Más buscados
  // ============================================
  const oposiciones = ['auxiliar-administrativo', 'administrativo', 'c1', 'c2'];
  const ccaaForCombined = [
    'andalucia', 'aragon', 'asturias', 'islas-baleares', 'canarias', 'cantabria',
    'castilla-la-mancha', 'castilla-y-leon', 'cataluna', 'comunidad-valenciana',
    'extremadura', 'galicia', 'la-rioja', 'madrid', 'murcia', 'navarra', 'pais-vasco'
  ];

  oposiciones.forEach(op => {
    ccaaForCombined.forEach(ccaa => {
      urls.push(`
  <url>
    <loc>${SITE_URL}/oposiciones/${op}-${ccaa}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.85</priority>
  </url>`);
    });
  });

  // ============================================
  // MUNICIPIOS PRINCIPALES
  // ============================================
  const municipiosList = [
    'ayuntamiento-madrid', 'ayuntamiento-barcelona', 'ayuntamiento-valencia',
    'ayuntamiento-sevilla', 'ayuntamiento-zaragoza', 'ayuntamiento-malaga',
    'ayuntamiento-murcia', 'ayuntamiento-bilbao', 'ayuntamiento-alicante'
  ];

  municipiosList.forEach(municipio => {
    urls.push(`
  <url>
    <loc>${SITE_URL}/oposiciones/${municipio}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>`);
  });

  // ============================================
  // GENERAR XML
  // ============================================
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('')}
</urlset>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, max-age=86400, s-maxage=86400'
    }
  });
}
