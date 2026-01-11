/**
 * Sitemap dinámico para convocatorias
 * /sitemap-convocatorias.xml
 *
 * Genera un sitemap con todas las convocatorias para que Google las indexe
 */

import { createClient } from '@supabase/supabase-js';

export const revalidate = 3600; // Regenerar cada hora

export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const baseUrl = process.env.NEXT_PUBLIC_URL || 'https://vence.es';

  // Obtener todas las convocatorias activas
  const { data: convocatorias } = await supabase
    .from('convocatorias_boe')
    .select('slug, id, boe_fecha, updated_at, tipo, relevancia_score')
    .eq('is_active', true)
    .order('boe_fecha', { ascending: false });

  // Generar URLs del sitemap
  const urls = (convocatorias || []).map((conv) => {
    const slug = conv.slug || conv.id;
    const lastmod = conv.updated_at || conv.boe_fecha;

    // Prioridad basada en tipo y relevancia
    let priority = 0.5;
    if (conv.tipo === 'convocatoria') priority = 0.9;
    else if (conv.tipo === 'admitidos') priority = 0.7;
    else if (conv.tipo === 'resultado') priority = 0.8;
    if (conv.relevancia_score > 50) priority = Math.min(1.0, priority + 0.1);

    // Frecuencia de cambio
    const changefreq = conv.tipo === 'convocatoria' ? 'weekly' : 'monthly';

    return `
  <url>
    <loc>${baseUrl}/convocatorias/${slug}</loc>
    <lastmod>${new Date(lastmod).toISOString().split('T')[0]}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority.toFixed(1)}</priority>
  </url>`;
  });

  // Añadir páginas de listado principal
  const staticPages = [
    { loc: '/convocatorias', priority: 1.0, changefreq: 'daily' },
  ];

  // ============================================
  // CCAA (17 + Ceuta/Melilla + aliases)
  // ============================================
  const ccaaList = [
    'andalucia', 'aragon', 'asturias', 'islas-baleares', 'canarias',
    'cantabria', 'castilla-la-mancha', 'castilla-y-leon', 'cataluna',
    'comunidad-valenciana', 'extremadura', 'galicia', 'la-rioja',
    'madrid', 'murcia', 'navarra', 'pais-vasco', 'ceuta', 'melilla'
  ];

  ccaaList.forEach(ccaa => {
    staticPages.push({
      loc: `/convocatorias/${ccaa}`,
      priority: 0.9,
      changefreq: 'daily'
    });
  });

  // ============================================
  // PROVINCIAS (52)
  // ============================================
  const provinciasList = [
    'a-coruna', 'alava', 'albacete', 'alicante', 'almeria', 'asturias',
    'avila', 'badajoz', 'barcelona', 'bizkaia', 'burgos', 'caceres',
    'cadiz', 'cantabria', 'castellon', 'ciudad-real', 'cordoba', 'cuenca',
    'gipuzkoa', 'girona', 'granada', 'guadalajara', 'huelva', 'huesca',
    'illes-balears', 'jaen', 'leon', 'lleida', 'lugo', 'las-palmas',
    'malaga', 'murcia', 'navarra', 'ourense', 'palencia', 'pontevedra',
    'salamanca', 'segovia', 'sevilla', 'soria', 'tarragona',
    'santa-cruz-de-tenerife', 'teruel', 'toledo', 'valencia',
    'valladolid', 'zamora', 'zaragoza'
  ];

  provinciasList.forEach(provincia => {
    staticPages.push({
      loc: `/convocatorias/${provincia}`,
      priority: 0.7,
      changefreq: 'daily'
    });
  });

  // ============================================
  // MINISTERIOS Y ORGANISMOS PRINCIPALES
  // ============================================
  const ministeriosList = [
    'hacienda', 'justicia', 'interior', 'defensa', 'educacion',
    'sanidad', 'trabajo', 'seguridad-social', 'cultura', 'agricultura',
    'transicion-ecologica', 'transportes', 'economia', 'industria',
    'ciencia', 'funcion-publica', 'exteriores', 'igualdad',
    'derechos-sociales', 'vivienda', 'politica-territorial',
    'tribunal-constitucional', 'tribunal-cuentas', 'consejo-estado',
    'poder-judicial', 'cgpj', 'cortes-generales', 'aepd', 'cnmc',
    'administracion-local', 'universidades'
  ];

  ministeriosList.forEach(ministerio => {
    staticPages.push({
      loc: `/convocatorias/${ministerio}`,
      priority: 0.7,
      changefreq: 'daily'
    });
  });

  // ============================================
  // CATEGORÍAS
  // ============================================
  const categoriasList = ['c1', 'c2', 'a1', 'a2', 'b', 'grupo-c', 'grupo-a'];

  categoriasList.forEach(categoria => {
    staticPages.push({
      loc: `/convocatorias/${categoria}`,
      priority: 0.85,
      changefreq: 'daily'
    });
  });

  // ============================================
  // OPOSICIONES ESPECÍFICAS
  // ============================================
  const oposicionesList = [
    'auxiliar-administrativo', 'auxiliar-administrativo-estado',
    'administrativo', 'administrativo-estado',
    'gestion-procesal', 'tramitacion-procesal', 'auxilio-judicial'
  ];

  oposicionesList.forEach(oposicion => {
    staticPages.push({
      loc: `/convocatorias/${oposicion}`,
      priority: 0.85,
      changefreq: 'daily'
    });
  });

  // ============================================
  // ÁMBITO TERRITORIAL
  // ============================================
  const ambitosList = [
    'estatal', 'age', 'autonomico', 'autonomicas', 'local',
    'ayuntamientos', 'diputaciones'
  ];

  ambitosList.forEach(ambito => {
    staticPages.push({
      loc: `/convocatorias/${ambito}`,
      priority: 0.8,
      changefreq: 'daily'
    });
  });

  // ============================================
  // FILTROS TEMPORALES
  // ============================================
  const temporalesList = [
    'hoy', 'ayer', 'esta-semana', 'este-mes', 'ultimos-3-meses',
    'este-ano', '2026', '2025', 'nuevas', 'recientes'
  ];

  temporalesList.forEach(temporal => {
    staticPages.push({
      loc: `/convocatorias/${temporal}`,
      priority: 0.75,
      changefreq: 'daily'
    });
  });

  // ============================================
  // TIPOS DE PUBLICACIÓN
  // ============================================
  const tiposList = [
    'convocatorias', 'nuevas-convocatorias', 'admitidos',
    'listas-admitidos', 'tribunales', 'resultados', 'aprobados',
    'notas', 'correcciones'
  ];

  tiposList.forEach(tipo => {
    staticPages.push({
      loc: `/convocatorias/${tipo}`,
      priority: 0.8,
      changefreq: 'daily'
    });
  });

  // ============================================
  // MUNICIPIOS PRINCIPALES (50+)
  // ============================================
  const municipiosList = [
    'ayuntamiento-madrid', 'ayuntamiento-barcelona', 'ayuntamiento-valencia',
    'ayuntamiento-sevilla', 'ayuntamiento-zaragoza', 'ayuntamiento-malaga',
    'ayuntamiento-murcia', 'ayuntamiento-palma', 'ayuntamiento-bilbao',
    'ayuntamiento-alicante', 'ayuntamiento-cordoba', 'ayuntamiento-valladolid',
    'ayuntamiento-vigo', 'ayuntamiento-gijon', 'ayuntamiento-hospitalet',
    'ayuntamiento-vitoria', 'ayuntamiento-granada', 'ayuntamiento-elche',
    'ayuntamiento-oviedo', 'ayuntamiento-terrassa', 'ayuntamiento-badalona',
    'ayuntamiento-cartagena', 'ayuntamiento-jerez', 'ayuntamiento-sabadell',
    'ayuntamiento-mostoles', 'ayuntamiento-alcala', 'ayuntamiento-pamplona',
    'ayuntamiento-fuenlabrada', 'ayuntamiento-almeria', 'ayuntamiento-leganes',
    'ayuntamiento-san-sebastian', 'ayuntamiento-santander', 'ayuntamiento-burgos',
    'ayuntamiento-albacete', 'ayuntamiento-getafe', 'ayuntamiento-salamanca',
    'ayuntamiento-logrono', 'ayuntamiento-huelva', 'ayuntamiento-badajoz',
    'ayuntamiento-tarragona', 'ayuntamiento-lleida', 'ayuntamiento-alcorcon',
    'ayuntamiento-marbella', 'ayuntamiento-leon', 'ayuntamiento-cadiz',
    'ayuntamiento-dos-hermanas', 'ayuntamiento-mataro', 'ayuntamiento-torrevieja'
  ];

  municipiosList.forEach(municipio => {
    staticPages.push({
      loc: `/convocatorias/${municipio}`,
      priority: 0.7,
      changefreq: 'daily'
    });
  });

  // ============================================
  // COMBINADOS (Oposición + CCAA)
  // ============================================
  const oposiciones = ['auxiliar-administrativo', 'administrativo', 'c1', 'c2'];
  const ccaaForCombined = [
    'andalucia', 'aragon', 'asturias', 'islas-baleares', 'canarias', 'cantabria',
    'castilla-la-mancha', 'castilla-y-leon', 'cataluna', 'comunidad-valenciana',
    'extremadura', 'galicia', 'la-rioja', 'madrid', 'murcia', 'navarra', 'pais-vasco'
  ];

  oposiciones.forEach(op => {
    ccaaForCombined.forEach(ccaa => {
      staticPages.push({
        loc: `/convocatorias/${op}-${ccaa}`,
        priority: 0.75,
        changefreq: 'daily'
      });
    });
  });

  const staticUrls = staticPages.map(page => `
  <url>
    <loc>${baseUrl}${page.loc}</loc>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority.toFixed(1)}</priority>
  </url>`);

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${staticUrls.join('')}
${urls.join('')}
</urlset>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600'
    }
  });
}
