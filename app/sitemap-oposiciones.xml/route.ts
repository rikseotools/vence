// app/sitemap-oposiciones.xml/route.ts
// Sitemap limpio: solo nuestras oposiciones + filtros principales (~25 URLs)
import { getAllFilterSlugs } from '@/app/oposiciones/lib/oposiciones-filters'

export const revalidate = 86400

const BASE_URL = 'https://www.vence.es'

export async function GET() {
  const now = new Date().toISOString()

  const urls: Array<{ loc: string; priority: number; changefreq: string }> = []

  // Página principal
  urls.push({ loc: '/oposiciones', priority: 0.95, changefreq: 'daily' })

  // Filtros (CCAA, subgrupo, tipo, estado)
  for (const slug of getAllFilterSlugs()) {
    urls.push({ loc: `/oposiciones/${slug}`, priority: 0.8, changefreq: 'weekly' })
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url>
    <loc>${BASE_URL}${u.loc}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`).join('\n')}
</urlset>`

  return new Response(xml, {
    headers: { 'Content-Type': 'application/xml', 'Cache-Control': 'public, max-age=86400' },
  })
}
