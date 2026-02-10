/**
 * Páginas de oposiciones - URL principal para SEO
 *
 * /oposiciones/madrid -> Oposiciones en Madrid (canonical)
 * /oposiciones/c2 -> Oposiciones Grupo C2
 */

import { Metadata } from 'next';
import { createClient } from '@supabase/supabase-js';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import ConvocatoriasLista from '../components/ConvocatoriasLista';
import OposicionTimeline from '../components/OposicionTimeline';
import {
  detectFilterType,
  getAllFilterSlugs,
  FilterInfo,
  FilterType,
  CCAA_MAP,
  CATEGORIA_MAP,
  TEMPORAL_MAP,
} from '../lib/filters';

// ============================================
// STATIC PARAMS
// ============================================

export async function generateStaticParams() {
  return getAllFilterSlugs().map(slug => ({ filtro: slug }));
}

// ============================================
// DATA FETCHING
// ============================================

async function getFilteredConvocatorias(filter: FilterInfo, slug: string) {
  // En CI/build sin variables de entorno, devolver array vacío
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return [];
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  let query = supabase
    .from('convocatorias_boe')
    .select('*')
    .eq('is_active', true)
    .order('boe_fecha', { ascending: false })
    .order('relevancia_score', { ascending: false })
    .limit(100);

  switch (filter.type) {
    case 'ccaa':
      query = query.eq('comunidad_autonoma', filter.value);
      break;
    case 'provincia':
      query = query.ilike('provincia', filter.value);
      break;
    case 'municipio':
      query = query.ilike('municipio', `%${filter.value}%`);
      break;
    case 'categoria':
      if (filter.value.includes(',')) {
        query = query.in('categoria', filter.value.split(','));
      } else {
        query = query.eq('categoria', filter.value);
      }
      break;
    case 'oposicion':
      query = query.eq('oposicion_relacionada', filter.value);
      break;
    case 'ambito':
      query = query.eq('ambito', filter.value);
      break;
    case 'temporal':
      const temporal = TEMPORAL_MAP[slug];
      if (temporal) {
        if (slug === '2026') {
          query = query.gte('boe_fecha', '2026-01-01').lte('boe_fecha', '2026-12-31');
        } else if (slug === '2025') {
          query = query.gte('boe_fecha', '2025-01-01').lte('boe_fecha', '2025-12-31');
        } else if (temporal.days > 0) {
          const cutoff = new Date();
          cutoff.setDate(cutoff.getDate() - temporal.days);
          query = query.gte('boe_fecha', cutoff.toISOString().split('T')[0]);
        }
      }
      break;
    case 'tipo':
      query = query.eq('tipo', filter.value);
      break;
    case 'combined':
      if (filter.extraFilter) {
        if (filter.extraFilter.oposicion) {
          query = query.eq('oposicion_relacionada', filter.extraFilter.oposicion);
        }
        if (filter.extraFilter.ccaa) {
          query = query.eq('comunidad_autonoma', filter.extraFilter.ccaa);
        }
        const slugParts = slug.split('-');
        if (slugParts[0] === 'c1' || slugParts[0] === 'c2') {
          query = query.eq('categoria', slugParts[0].toUpperCase());
        }
      }
      break;
  }

  const { data } = await query;
  return data || [];
}

// ============================================
// METADATA
// ============================================

export async function generateMetadata({
  params
}: {
  params: Promise<{ filtro: string }>
}): Promise<Metadata> {
  const { filtro } = await params;
  const baseUrl = process.env.NEXT_PUBLIC_URL || 'https://www.vence.es';
  const year = new Date().getFullYear();

  const filter = detectFilterType(filtro);

  if (!filter) {
    return { title: 'Página no encontrada', robots: 'noindex' };
  }

  // Verificar si hay resultados para decidir indexación
  const hasResults = await checkHasResults(filter, filtro);

  const titles: Record<FilterType, string> = {
    ccaa: `Oposiciones ${filter.label} ${year} | Plazas y Convocatorias`,
    provincia: `Oposiciones ${filter.label} ${year} | Todas las Plazas`,
    ministerio: `Oposiciones ${filter.label} ${year}`,
    categoria: `Oposiciones Grupo ${filter.value} ${year}`,
    oposicion: `Oposiciones ${filter.label} ${year} | Plazas y Temario`,
    ambito: `Oposiciones ${filter.label} ${year}`,
    temporal: `Oposiciones ${filter.label} | Convocatorias`,
    tipo: `${filter.label} Oposiciones ${year}`,
    municipio: `Oposiciones Ayuntamiento ${filter.label} ${year}`,
    combined: `Oposiciones ${filter.label} ${year}`,
    unknown: 'Oposiciones'
  };

  return {
    title: titles[filter.type],
    description: `Oposiciones en ${filter.label} ${year}. Todas las plazas, convocatorias y requisitos. Actualizado diariamente desde el BOE.`,
    alternates: {
      canonical: `${baseUrl}/oposiciones/${filtro}`
    },
    // NO indexar páginas sin resultados (thin content)
    robots: hasResults
      ? { index: true, follow: true }
      : { index: false, follow: true }
  };
}

// Verificar si hay resultados sin cargar todos los datos
async function checkHasResults(filter: FilterInfo, slug: string): Promise<boolean> {
  // En CI/build sin variables de entorno, devolver false
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return false;
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  let query = supabase
    .from('convocatorias_boe')
    .select('id', { count: 'exact', head: true })
    .eq('is_active', true);

  switch (filter.type) {
    case 'ccaa':
      query = query.eq('comunidad_autonoma', filter.value);
      break;
    case 'provincia':
      query = query.ilike('provincia', filter.value);
      break;
    case 'categoria':
      if (filter.value.includes(',')) {
        query = query.in('categoria', filter.value.split(','));
      } else {
        query = query.eq('categoria', filter.value);
      }
      break;
    case 'ambito':
      query = query.eq('ambito', filter.value);
      break;
    case 'oposicion':
      query = query.eq('oposicion_relacionada', filter.value);
      break;
    default:
      return true; // Por defecto asumimos que hay resultados
  }

  const { count } = await query;
  return (count || 0) > 0;
}

// ============================================
// COMPONENT
// ============================================

export const revalidate = 3600;

export default async function OposicionesPage({
  params
}: {
  params: Promise<{ filtro: string }>
}) {
  const { filtro } = await params;

  const filter = detectFilterType(filtro);

  if (!filter) {
    notFound();
  }

  const convocatorias = await getFilteredConvocatorias(filter, filtro);
  const year = new Date().getFullYear();

  const stats = {
    total: convocatorias.length,
    convocatorias: convocatorias.filter(c => c.tipo === 'convocatoria').length,
    plazas: convocatorias.reduce((acc, c) => acc + (c.num_plazas || 0), 0),
    admitidos: convocatorias.filter(c => c.tipo === 'admitidos').length
  };

  const relatedFilters = getRelatedFilters(filter.type, filtro);

  const baseUrl = process.env.NEXT_PUBLIC_URL || 'https://www.vence.es';

  // Schema.org BreadcrumbList
  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Inicio',
        item: baseUrl
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Oposiciones',
        item: `${baseUrl}/oposiciones`
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: filter.label,
        item: `${baseUrl}/oposiciones/${filtro}`
      }
    ]
  };

  // Schema.org ItemList para las convocatorias
  const itemListSchema = convocatorias.length > 0 ? {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `Oposiciones ${filter.label} ${year}`,
    description: `Lista de convocatorias de oposiciones en ${filter.label}`,
    numberOfItems: convocatorias.length,
    itemListElement: convocatorias.slice(0, 10).map((conv, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: conv.titulo || conv.descripcion,
      url: conv.boe_url
    }))
  } : null;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Schema.org JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      {itemListSchema && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListSchema) }}
        />
      )}

      {/* Breadcrumbs */}
      <nav className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700" aria-label="Breadcrumb">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <ol className="flex items-center space-x-2 text-sm" itemScope itemType="https://schema.org/BreadcrumbList">
            <li itemProp="itemListElement" itemScope itemType="https://schema.org/ListItem">
              <Link href="/" className="text-gray-500 hover:text-gray-700 dark:text-gray-400" itemProp="item">
                <span itemProp="name">Inicio</span>
              </Link>
              <meta itemProp="position" content="1" />
            </li>
            <li className="text-gray-400" aria-hidden="true">/</li>
            <li itemProp="itemListElement" itemScope itemType="https://schema.org/ListItem">
              <Link href="/oposiciones" className="text-gray-500 hover:text-gray-700 dark:text-gray-400" itemProp="item">
                <span itemProp="name">Oposiciones</span>
              </Link>
              <meta itemProp="position" content="2" />
            </li>
            <li className="text-gray-400" aria-hidden="true">/</li>
            <li itemProp="itemListElement" itemScope itemType="https://schema.org/ListItem">
              <span className="text-gray-900 dark:text-white font-medium" itemProp="name">{filter.label}</span>
              <meta itemProp="position" content="3" />
            </li>
          </ol>
        </div>
      </nav>

      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Oposiciones {filter.label} {year}
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Encuentra todas las oposiciones en {filter.label}. Convocatorias actualizadas del BOE.
          </p>

          {/* Stats */}
          <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{stats.total}</p>
              <p className="text-sm text-blue-600 dark:text-blue-400">Publicaciones</p>
            </div>
            <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">{stats.convocatorias}</p>
              <p className="text-sm text-green-600 dark:text-green-400">Convocatorias</p>
            </div>
            <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4">
              <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                {stats.plazas > 0 ? stats.plazas.toLocaleString('es-ES') : '-'}
              </p>
              <p className="text-sm text-purple-600 dark:text-purple-400">Plazas</p>
            </div>
            <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-4">
              <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">{stats.admitidos}</p>
              <p className="text-sm text-orange-600 dark:text-orange-400">Admitidos</p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {convocatorias.length > 0 ? (
          <Suspense fallback={<LoadingSkeleton />}>
            {filter.type === 'oposicion' ? (
              <OposicionTimeline
                publicaciones={convocatorias}
                oposicionSlug={filtro}
              />
            ) : (
              <ConvocatoriasLista convocatorias={convocatorias} />
            )}
          </Suspense>
        ) : (
          <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg border">
            <p className="text-gray-500 dark:text-gray-400">No hay oposiciones con este filtro.</p>
            <Link href="/oposiciones" className="mt-4 inline-block text-blue-600 hover:underline">
              Ver todas las oposiciones
            </Link>
          </div>
        )}

        {/* Related - Internal Linking mejorado */}
        {relatedFilters.length > 0 && (
          <div className="mt-12 pt-8 border-t border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
              Explora más oposiciones
            </h2>

            {/* Agrupar por categoría */}
            {(() => {
              const groups = relatedFilters.reduce((acc, rf) => {
                const group = rf.group || 'Otros';
                if (!acc[group]) acc[group] = [];
                acc[group].push(rf);
                return acc;
              }, {} as Record<string, typeof relatedFilters>);

              return Object.entries(groups).map(([groupName, items]) => (
                <div key={groupName} className="mb-4">
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                    {groupName}
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {items.map((rf) => (
                      <Link
                        key={rf.slug}
                        href={`/oposiciones/${rf.slug}`}
                        className="px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-full hover:bg-blue-100 dark:hover:bg-blue-900/30 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
                      >
                        {rf.label}
                      </Link>
                    ))}
                  </div>
                </div>
              ));
            })()}
          </div>
        )}

        {/* SEO content */}
        {filter.type === 'ccaa' && (
          <div className="mt-12 prose dark:prose-invert max-w-none">
            <h2>Oposiciones en {filter.label} {year}</h2>
            <p>
              Encuentra todas las oposiciones disponibles en {filter.label}.
              Incluye convocatorias de la Administración General del Estado,
              comunidad autónoma y ayuntamientos.
            </p>
            <p>
              Actualmente hay <strong>{stats.total} publicaciones</strong> con
              un total de <strong>{stats.plazas.toLocaleString('es-ES')} plazas</strong>.
            </p>
          </div>
        )}

        {filter.type === 'oposicion' && (
          <div className="mt-12 prose dark:prose-invert max-w-none">
            <h2>Oposiciones de {filter.label} {year}</h2>
            <p>
              Toda la información sobre las oposiciones de <strong>{filter.label}</strong>:
              convocatorias, listas de admitidos, tribunales y resultados.
              Actualizado diariamente desde el BOE.
            </p>
            <p>
              En esta página encontrarás el historial completo de convocatorias
              organizadas por año, incluyendo <strong>{stats.convocatorias} convocatorias</strong>
              {stats.plazas > 0 && <> con un total de <strong>{stats.plazas.toLocaleString('es-ES')} plazas</strong></>}.
            </p>
            <h3>¿Qué incluye esta oposición?</h3>
            <ul>
              <li>Convocatorias oficiales publicadas en el BOE</li>
              <li>Listas de admitidos y excluidos</li>
              <li>Composición de tribunales</li>
              <li>Resultados y aprobados</li>
              <li>Correcciones de errores</li>
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

function getRelatedFilters(type: FilterType, currentSlug: string): { slug: string; label: string; group?: string }[] {
  const related: { slug: string; label: string; group?: string }[] = [];

  // Siempre mostrar categorías principales
  if (type !== 'categoria') {
    Object.entries(CATEGORIA_MAP)
      .filter(([slug]) => !slug.startsWith('grupo-'))
      .slice(0, 4)
      .forEach(([slug, info]) => related.push({
        slug,
        label: `Grupo ${info.label}`,
        group: 'Categorías'
      }));
  }

  // Mostrar CCAA principales según el tipo
  if (type === 'ccaa') {
    // Otras CCAA
    Object.entries(CCAA_MAP)
      .filter(([slug]) => slug !== currentSlug && !slug.includes('-') && slug !== 'valencia' && slug !== 'baleares' && slug !== 'rioja' && slug !== 'catalunya' && slug !== 'euskadi' && slug !== 'coruna')
      .slice(0, 8)
      .forEach(([slug, label]) => related.push({ slug, label, group: 'Otras comunidades' }));
  } else if (type === 'categoria') {
    // Otras categorías
    Object.entries(CATEGORIA_MAP)
      .filter(([slug]) => slug !== currentSlug)
      .forEach(([slug, info]) => related.push({ slug, label: `Grupo ${info.label}`, group: 'Otras categorías' }));
    // CCAA principales
    ['madrid', 'andalucia', 'cataluna', 'comunidad-valenciana', 'galicia']
      .forEach(slug => related.push({ slug, label: CCAA_MAP[slug], group: 'Por comunidad' }));
  } else if (type === 'provincia') {
    // Mostrar CCAA principales
    ['madrid', 'andalucia', 'cataluna', 'comunidad-valenciana', 'galicia', 'pais-vasco']
      .forEach(slug => related.push({ slug, label: CCAA_MAP[slug], group: 'Por comunidad' }));
  } else if (type === 'ambito') {
    // Otros ámbitos
    const ambitos = [
      { slug: 'estatal', label: 'Estatal (AGE)' },
      { slug: 'autonomico', label: 'Autonómico' },
      { slug: 'local', label: 'Local' }
    ];
    ambitos
      .filter(a => a.slug !== currentSlug)
      .forEach(a => related.push({ ...a, group: 'Otros ámbitos' }));
    // CCAA principales
    ['madrid', 'andalucia', 'cataluna', 'comunidad-valenciana']
      .forEach(slug => related.push({ slug, label: CCAA_MAP[slug], group: 'Por comunidad' }));
  } else {
    // Default: mostrar CCAA principales
    ['madrid', 'andalucia', 'cataluna', 'galicia', 'pais-vasco', 'comunidad-valenciana']
      .forEach(slug => related.push({ slug, label: CCAA_MAP[slug] || slug, group: 'Por comunidad' }));
  }

  return related;
}

function LoadingSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="h-32 bg-gray-200 dark:bg-gray-700 rounded-lg" />
      ))}
    </div>
  );
}
