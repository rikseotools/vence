/**
 * Sitemap estático - Páginas principales, temarios, leyes, psicotécnicos
 * /sitemap-static.xml
 */

import { createClient } from '@supabase/supabase-js';
import { generateLawSlug } from '@/lib/lawMappingUtils';

const SITE_URL = process.env.NEXT_PUBLIC_URL || 'https://www.vence.es';

export const revalidate = 86400; // Regenerar cada 24 horas

export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const urls: string[] = [];
  const today = new Date().toISOString().split('T')[0];

  // ============================================
  // PÁGINAS ESTÁTICAS PRINCIPALES
  // ============================================
  const staticPages = [
    { loc: '/', priority: 1.0, changefreq: 'weekly' },
    // Oposiciones
    { loc: '/oposiciones', priority: 0.9, changefreq: 'daily' },
    { loc: '/nuestras-oposiciones', priority: 0.9, changefreq: 'weekly' },
    // Temarios
    { loc: '/temarios', priority: 0.9, changefreq: 'weekly' },
    // Auxiliar Administrativo del Estado
    { loc: '/auxiliar-administrativo-estado', priority: 0.9, changefreq: 'weekly' },
    { loc: '/auxiliar-administrativo-estado/test', priority: 0.8, changefreq: 'weekly' },
    { loc: '/auxiliar-administrativo-estado/temario', priority: 0.7, changefreq: 'monthly' },
    // Administrativo del Estado
    { loc: '/administrativo-estado', priority: 0.9, changefreq: 'weekly' },
    { loc: '/administrativo-estado/test', priority: 0.8, changefreq: 'weekly' },
    { loc: '/administrativo-estado/temario', priority: 0.7, changefreq: 'monthly' },
    // Leyes
    { loc: '/leyes', priority: 0.9, changefreq: 'daily' },
    { loc: '/leyes-de-oposiciones', priority: 0.8, changefreq: 'weekly' },
    { loc: '/teoria', priority: 0.6, changefreq: 'monthly' },
    { loc: '/psicotecnicos', priority: 0.8, changefreq: 'monthly' },
    { loc: '/psicotecnicos/secuencias-numericas', priority: 0.8, changefreq: 'weekly' },
    { loc: '/psicotecnicos/series-letras', priority: 0.8, changefreq: 'weekly' },
    { loc: '/test-oposiciones', priority: 0.9, changefreq: 'weekly' },
  ];

  staticPages.forEach(page => {
    urls.push(`
  <url>
    <loc>${SITE_URL}${page.loc}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority.toFixed(1)}</priority>
  </url>`);
  });

  // ============================================
  // TEMAS - AUXILIAR ADMINISTRATIVO DEL ESTADO
  // ============================================
  // Bloque I: Organización Pública (temas 1-16)
  for (let i = 1; i <= 16; i++) {
    urls.push(`
  <url>
    <loc>${SITE_URL}/auxiliar-administrativo-estado/temario/tema-${i}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
  </url>`);
  }
  // Bloque II: Actividad Administrativa (temas 101-104)
  for (let i = 101; i <= 104; i++) {
    urls.push(`
  <url>
    <loc>${SITE_URL}/auxiliar-administrativo-estado/temario/tema-${i}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
  </url>`);
  }

  // ============================================
  // TEMAS - ADMINISTRATIVO DEL ESTADO
  // ============================================
  // Bloque I: Organización del Estado (temas 1-11)
  for (let i = 1; i <= 11; i++) {
    urls.push(`
  <url>
    <loc>${SITE_URL}/administrativo-estado/temario/tema-${i}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
  </url>`);
  }
  // Bloque II: Organización de Oficinas Públicas (temas 201-204)
  for (let i = 201; i <= 204; i++) {
    urls.push(`
  <url>
    <loc>${SITE_URL}/administrativo-estado/temario/tema-${i}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
  </url>`);
  }
  // Bloque III: Derecho Administrativo General (temas 301-307)
  for (let i = 301; i <= 307; i++) {
    urls.push(`
  <url>
    <loc>${SITE_URL}/administrativo-estado/temario/tema-${i}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
  </url>`);
  }
  // Bloque IV: Gestión de Personal (temas 401-409)
  for (let i = 401; i <= 409; i++) {
    urls.push(`
  <url>
    <loc>${SITE_URL}/administrativo-estado/temario/tema-${i}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
  </url>`);
  }
  // Bloque V: Gestión Financiera (temas 501-506)
  for (let i = 501; i <= 506; i++) {
    urls.push(`
  <url>
    <loc>${SITE_URL}/administrativo-estado/temario/tema-${i}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
  </url>`);
  }

  // ============================================
  // TESTS DE LA CONSTITUCIÓN ESPAÑOLA 1978
  // ============================================
  const constitucionPages = [
    { slug: '', priority: 0.9 },
    { slug: '/preambulo-y-titulo-preliminar', priority: 0.8 },
    { slug: '/titulo-i-derechos-y-deberes-fundamentales', priority: 0.8 },
    { slug: '/titulo-ii-de-la-corona', priority: 0.8 },
    { slug: '/titulo-iii-de-las-cortes-generales', priority: 0.8 },
    { slug: '/titulo-iv-del-gobierno-y-la-administracion', priority: 0.8 },
    { slug: '/titulo-v-relaciones-gobierno-cortes', priority: 0.8 },
    { slug: '/titulo-vi-del-poder-judicial', priority: 0.8 },
    { slug: '/titulo-vii-economia-y-hacienda', priority: 0.8 },
    { slug: '/titulo-viii-organizacion-territorial', priority: 0.8 },
    { slug: '/titulo-ix-del-tribunal-constitucional', priority: 0.8 },
    { slug: '/titulo-x-de-la-reforma-constitucional', priority: 0.8 },
  ];

  constitucionPages.forEach(page => {
    urls.push(`
  <url>
    <loc>${SITE_URL}/test-oposiciones/test-de-la-constitucion-espanola-de-1978${page.slug}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>${page.priority.toFixed(1)}</priority>
  </url>`);
  });

  // ============================================
  // TESTS DE LA LEY 39/2015
  // ============================================
  const ley39Pages = [
    { slug: '', priority: 0.9 },
    { slug: '/titulo-preliminar', priority: 0.8 },
    { slug: '/titulo-i-capitulo-i-capacidad-obrar-concepto-interesado', priority: 0.8 },
    { slug: '/titulo-ii-capitulo-i-normas-generales-actuacion', priority: 0.8 },
    { slug: '/titulo-iii-capitulo-i-requisitos-actos-administrativos', priority: 0.8 },
    { slug: '/titulo-iv-capitulos-i-ii-garantias-iniciacion', priority: 0.8 },
    { slug: '/titulo-v-capitulo-i-revision-oficio', priority: 0.8 },
    { slug: '/titulo-vi-iniciativa-legislativa-potestad-reglamentaria', priority: 0.8 },
  ];

  ley39Pages.forEach(page => {
    urls.push(`
  <url>
    <loc>${SITE_URL}/test-oposiciones/test-ley-39-2015${page.slug}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>${page.priority.toFixed(1)}</priority>
  </url>`);
  });

  // ============================================
  // TESTS DE PROCEDIMIENTO ADMINISTRATIVO
  // ============================================
  const procedimientoPages = [
    '', '/conceptos-generales', '/el-procedimiento-administrativo',
    '/responsabilidad-patrimonial', '/terminos-plazos', '/actos-administrativos',
    '/eficacia-validez-actos', '/nulidad-anulabilidad', '/revision-oficio',
    '/recursos-administrativos', '/jurisdiccion-contencioso'
  ];

  procedimientoPages.forEach(slug => {
    urls.push(`
  <url>
    <loc>${SITE_URL}/test-oposiciones/procedimiento-administrativo${slug}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>${slug === '' ? '0.9' : '0.8'}</priority>
  </url>`);
  });

  // ============================================
  // PÁGINAS DE LEYES DINÁMICAS
  // ============================================
  try {
    const { data: laws } = await supabase
      .from('laws')
      .select('short_name, updated_at')
      .eq('is_active', true);

    if (laws) {
      for (const law of laws) {
        // Verificar que tiene preguntas suficientes
        const { count } = await supabase
          .from('questions')
          .select('id, articles!inner(laws!inner(short_name))', { count: 'exact', head: true })
          .eq('is_active', true)
          .eq('articles.laws.short_name', law.short_name);

        if ((count || 0) >= 5) {
          const canonicalSlug = generateLawSlug(law.short_name);
          const lastmod = law.updated_at
            ? new Date(law.updated_at).toISOString().split('T')[0]
            : today;

          urls.push(`
  <url>
    <loc>${SITE_URL}/leyes/${canonicalSlug}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`);

          urls.push(`
  <url>
    <loc>${SITE_URL}/teoria/${canonicalSlug}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>`);
        }
      }
    }
  } catch (error) {
    console.error('Error obteniendo leyes para sitemap:', error);
  }

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
