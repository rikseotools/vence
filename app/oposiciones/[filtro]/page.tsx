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
import ConvocatoriasLista from '../../convocatorias/components/ConvocatoriasLista';
import OposicionTimeline from '../components/OposicionTimeline';
import {
  detectFilterType,
  getAllFilterSlugs,
  FilterInfo,
  FilterType,
  CCAA_MAP,
  CATEGORIA_MAP,
  TEMPORAL_MAP,
} from '../../convocatorias/lib/filters';

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
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
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
      canonical: `${baseUrl}/oposiciones/${filtro}` // Este es el canonical
    },
    robots: { index: true, follow: true }
  };
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

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Breadcrumbs */}
      <nav className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <ol className="flex items-center space-x-2 text-sm">
            <li>
              <Link href="/" className="text-gray-500 hover:text-gray-700 dark:text-gray-400">Inicio</Link>
            </li>
            <li className="text-gray-400">/</li>
            <li>
              <Link href="/convocatorias" className="text-gray-500 hover:text-gray-700 dark:text-gray-400">Oposiciones</Link>
            </li>
            <li className="text-gray-400">/</li>
            <li className="text-gray-900 dark:text-white font-medium">{filter.label}</li>
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
            <Link href="/convocatorias" className="mt-4 inline-block text-blue-600 hover:underline">
              Ver todas las oposiciones
            </Link>
          </div>
        )}

        {/* Related */}
        {relatedFilters.length > 0 && (
          <div className="mt-12 pt-8 border-t border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Oposiciones en otras {filter.type === 'ccaa' ? 'comunidades' : 'opciones'}
            </h2>
            <div className="flex flex-wrap gap-2">
              {relatedFilters.map((rf) => (
                <Link
                  key={rf.slug}
                  href={`/oposiciones/${rf.slug}`}
                  className="px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700"
                >
                  {rf.label}
                </Link>
              ))}
            </div>
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

function getRelatedFilters(type: FilterType, currentSlug: string): { slug: string; label: string }[] {
  const related: { slug: string; label: string }[] = [];

  if (type === 'ccaa') {
    Object.entries(CCAA_MAP)
      .filter(([slug]) => slug !== currentSlug && !slug.includes('-') && slug !== 'valencia')
      .slice(0, 10)
      .forEach(([slug, label]) => related.push({ slug, label }));
  } else if (type === 'categoria') {
    Object.entries(CATEGORIA_MAP)
      .filter(([slug]) => slug !== currentSlug)
      .forEach(([slug, info]) => related.push({ slug, label: `Grupo ${info.label}` }));
  } else {
    ['madrid', 'andalucia', 'cataluna', 'galicia', 'pais-vasco']
      .forEach(slug => related.push({ slug, label: CCAA_MAP[slug] || slug }));
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
