/**
 * Página unificada de convocatorias
 *
 * Maneja dos casos:
 * 1. Filtros: /convocatorias/madrid, /convocatorias/c2, etc.
 * 2. Detalle: /convocatorias/boe-a-2025-12345-titulo-convocatoria
 */

import { Metadata } from 'next';
import { createClient } from '@supabase/supabase-js';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import Script from 'next/script';
import ConvocatoriasLista from '../components/ConvocatoriasLista';
import {
  detectFilterType,
  getAllFilterSlugs,
  FilterInfo,
  FilterType,
  CCAA_MAP,
  CATEGORIA_MAP,
  TEMPORAL_MAP,
  COMBINADOS_MAP
} from '../lib/filters';

// ============================================
// TIPOS
// ============================================

interface Convocatoria {
  id: string;
  slug: string | null;
  boe_id: string;
  boe_fecha: string;
  boe_url_pdf: string | null;
  boe_url_html: string | null;
  titulo: string;
  titulo_limpio: string | null;
  departamento_nombre: string | null;
  epigrafe: string | null;
  tipo: string | null;
  categoria: string | null;
  cuerpo: string | null;
  acceso: string | null;
  num_plazas: number | null;
  num_plazas_libre: number | null;
  num_plazas_pi: number | null;
  num_plazas_discapacidad: number | null;
  fecha_disposicion: string | null;
  fecha_limite_inscripcion: string | null;
  fecha_examen: string | null;
  oposicion_relacionada: string | null;
  resumen: string | null;
  contenido_texto: string | null;
  rango: string | null;
  plazo_inscripcion_dias: number | null;
  titulacion_requerida: string | null;
  tiene_temario: boolean;
  url_bases: string | null;
  ambito: string | null;
  comunidad_autonoma: string | null;
  provincia: string | null;
  municipio: string | null;
}

// ============================================
// STATIC PARAMS
// ============================================

export async function generateStaticParams() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // Slugs de filtros
  const filterSlugs = getAllFilterSlugs().map(slug => ({ slug }));

  // Top 100 convocatorias
  const { data } = await supabase
    .from('convocatorias_boe')
    .select('slug')
    .eq('is_active', true)
    .not('slug', 'is', null)
    .order('relevancia_score', { ascending: false })
    .limit(100);

  const convocatoriaSlugs = (data || []).map((conv) => ({ slug: conv.slug }));

  return [...filterSlugs, ...convocatoriaSlugs];
}

// ============================================
// DATA FETCHING
// ============================================

async function getConvocatoria(slug: string): Promise<Convocatoria | null> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  let { data, error } = await supabase
    .from('convocatorias_boe')
    .select('*')
    .eq('slug', slug)
    .eq('is_active', true)
    .single();

  // Fallback: buscar por ID (compatibilidad)
  if (!data && slug.match(/^[0-9a-f-]{36}$/)) {
    const result = await supabase
      .from('convocatorias_boe')
      .select('*')
      .eq('id', slug)
      .eq('is_active', true)
      .single();
    data = result.data;
  }

  return data as Convocatoria | null;
}

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
    case 'ministerio':
      query = query.ilike('departamento_nombre', `%${filter.value}%`);
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

  const { data, error } = await query;
  return data || [];
}

// ============================================
// METADATA
// ============================================

export async function generateMetadata({
  params
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params;
  const baseUrl = process.env.NEXT_PUBLIC_URL || 'https://vence.es';
  const year = new Date().getFullYear();

  // Verificar si es un filtro
  const filter = detectFilterType(slug);

  if (filter) {
    // Metadata para página de filtro
    const titles: Record<FilterType, string> = {
      ccaa: `Oposiciones ${filter.label} ${year} | Convocatorias BOE`,
      provincia: `Oposiciones ${filter.label} ${year} | Convocatorias`,
      ministerio: `Oposiciones ${filter.label} ${year} | Convocatorias`,
      categoria: `Oposiciones ${filter.label} ${year} | Grupo ${filter.value}`,
      oposicion: `${filter.label} ${year} | Convocatorias y Plazas`,
      ambito: `Oposiciones ${filter.label} ${year} | Convocatorias`,
      temporal: `Convocatorias Oposiciones ${filter.label} | BOE`,
      tipo: `${filter.label} Oposiciones ${year} | BOE`,
      municipio: `Oposiciones Ayuntamiento ${filter.label} ${year}`,
      combined: `Oposiciones ${filter.label} ${year} | Convocatorias`,
      unknown: 'Convocatorias'
    };

    const useOposicionesCanonical = ['ccaa', 'provincia', 'categoria', 'oposicion', 'combined', 'ambito', 'temporal'].includes(filter.type);

    return {
      title: titles[filter.type],
      description: `Todas las convocatorias de oposiciones en ${filter.label}. Actualizado diariamente desde el BOE.`,
      alternates: {
        canonical: useOposicionesCanonical ? `${baseUrl}/oposiciones/${slug}` : `${baseUrl}/convocatorias/${slug}`
      },
      robots: { index: true, follow: true }
    };
  }

  // Metadata para convocatoria individual
  const conv = await getConvocatoria(slug);

  if (!conv) {
    return { title: 'Convocatoria no encontrada', robots: 'noindex' };
  }

  const titulo = conv.titulo_limpio || conv.titulo;
  const tipoLabel = conv.tipo === 'convocatoria' ? 'Convocatoria' :
                    conv.tipo === 'admitidos' ? 'Lista de admitidos' :
                    conv.tipo === 'resultado' ? 'Resultados' : 'Publicación';

  const plazasText = conv.num_plazas ? `${conv.num_plazas} plazas. ` : '';
  const descripcion = `${tipoLabel} - ${conv.departamento_nombre || 'BOE'}. ${plazasText}Publicado ${new Date(conv.boe_fecha).toLocaleDateString('es-ES')}.`;

  // NOINDEX temporalmente - thin content hasta que se enriquezca con más datos
  return {
    title: `${titulo.slice(0, 55)}${titulo.length > 55 ? '...' : ''} | Oposiciones`,
    description: descripcion.slice(0, 160),
    openGraph: {
      title: titulo.slice(0, 60),
      description: descripcion.slice(0, 160),
      type: 'article',
      publishedTime: conv.boe_fecha
    },
    robots: { index: false, follow: false }
  };
}

// ============================================
// COMPONENT
// ============================================

export const revalidate = 3600;

export default async function ConvocatoriaPage({
  params
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params;

  // Verificar si es un filtro
  const filter = detectFilterType(slug);

  if (filter) {
    // Renderizar página de filtro
    return <FilterPage filter={filter} slug={slug} />;
  }

  // Buscar convocatoria individual
  const conv = await getConvocatoria(slug);

  if (!conv) {
    notFound();
  }

  return <DetailPage conv={conv} />;
}

// ============================================
// FILTER PAGE COMPONENT
// ============================================

async function FilterPage({ filter, slug }: { filter: FilterInfo; slug: string }) {
  const convocatorias = await getFilteredConvocatorias(filter, slug);
  const year = new Date().getFullYear();

  const stats = {
    total: convocatorias.length,
    convocatorias: convocatorias.filter(c => c.tipo === 'convocatoria').length,
    plazas: convocatorias.reduce((acc, c) => acc + (c.num_plazas || 0), 0),
    admitidos: convocatorias.filter(c => c.tipo === 'admitidos').length
  };

  const relatedFilters = getRelatedFilters(filter.type, slug);

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
              <Link href="/convocatorias" className="text-gray-500 hover:text-gray-700 dark:text-gray-400">Convocatorias</Link>
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
            Todas las convocatorias de oposiciones en {filter.label}. Actualizado diariamente desde el BOE.
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
              <p className="text-sm text-purple-600 dark:text-purple-400">Plazas totales</p>
            </div>
            <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-4">
              <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">{stats.admitidos}</p>
              <p className="text-sm text-orange-600 dark:text-orange-400">Listas admitidos</p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {convocatorias.length > 0 ? (
          <Suspense fallback={<LoadingSkeleton />}>
            <ConvocatoriasLista convocatorias={convocatorias} />
          </Suspense>
        ) : (
          <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg border">
            <p className="text-gray-500 dark:text-gray-400">No hay convocatorias con este filtro.</p>
            <Link href="/convocatorias" className="mt-4 inline-block text-blue-600 hover:underline">
              Ver todas las convocatorias
            </Link>
          </div>
        )}

        {/* Related */}
        {relatedFilters.length > 0 && (
          <div className="mt-12 pt-8 border-t border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Otras {filter.type === 'ccaa' ? 'comunidades' : 'opciones'}
            </h2>
            <div className="flex flex-wrap gap-2">
              {relatedFilters.map((rf) => (
                <Link
                  key={rf.slug}
                  href={`/convocatorias/${rf.slug}`}
                  className="px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700"
                >
                  {rf.label}
                </Link>
              ))}
            </div>
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

// ============================================
// DETAIL PAGE COMPONENT
// ============================================

const TIPO_LABELS: Record<string, string> = {
  convocatoria: 'Convocatoria',
  admitidos: 'Lista de Admitidos',
  tribunal: 'Tribunal Calificador',
  resultado: 'Resultados',
  correccion: 'Corrección de Errores',
  otro: 'Publicación'
};

const ACCESO_LABELS: Record<string, string> = {
  libre: 'Acceso Libre',
  promocion_interna: 'Promoción Interna',
  mixto: 'Mixto (Libre + PI)',
  discapacidad: 'Reserva Discapacidad'
};

function DetailPage({ conv }: { conv: Convocatoria }) {
  const baseUrl = process.env.NEXT_PUBLIC_URL || 'https://vence.es';
  const canonicalSlug = conv.slug || conv.id;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'JobPosting',
    title: conv.titulo_limpio || conv.titulo,
    description: conv.contenido_texto?.slice(0, 500) || conv.titulo,
    identifier: { '@type': 'PropertyValue', name: 'BOE ID', value: conv.boe_id },
    datePosted: conv.boe_fecha,
    validThrough: conv.fecha_limite_inscripcion || undefined,
    employmentType: 'FULL_TIME',
    hiringOrganization: {
      '@type': 'Organization',
      name: conv.departamento_nombre || 'Administración Pública'
    },
    jobLocation: conv.comunidad_autonoma ? {
      '@type': 'Place',
      address: {
        '@type': 'PostalAddress',
        addressRegion: conv.comunidad_autonoma,
        addressCountry: 'ES'
      }
    } : undefined,
    totalJobOpenings: conv.num_plazas || undefined,
    url: `${baseUrl}/convocatorias/${canonicalSlug}`
  };

  return (
    <>
      <Script
        id="json-ld"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        {/* Breadcrumbs */}
        <nav className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
            <ol className="flex items-center space-x-2 text-sm">
              <li>
                <Link href="/" className="text-gray-500 hover:text-gray-700 dark:text-gray-400">Inicio</Link>
              </li>
              <li className="text-gray-400">/</li>
              <li>
                <Link href="/convocatorias" className="text-gray-500 hover:text-gray-700 dark:text-gray-400">Convocatorias</Link>
              </li>
              {conv.comunidad_autonoma && (
                <>
                  <li className="text-gray-400">/</li>
                  <li>
                    <Link
                      href={`/convocatorias/${conv.comunidad_autonoma.toLowerCase().replace(/\s+/g, '-')}`}
                      className="text-gray-500 hover:text-gray-700 dark:text-gray-400"
                    >
                      {conv.comunidad_autonoma}
                    </Link>
                  </li>
                </>
              )}
              <li className="text-gray-400">/</li>
              <li className="text-gray-900 dark:text-white font-medium">{conv.boe_id}</li>
            </ol>
          </div>
        </nav>

        <article className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <header className="mb-8">
            <div className="flex flex-wrap gap-2 mb-4">
              {conv.tipo && (
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                  conv.tipo === 'convocatoria' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' :
                  conv.tipo === 'admitidos' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' :
                  'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                }`}>
                  {TIPO_LABELS[conv.tipo] || conv.tipo}
                </span>
              )}
              {conv.categoria && (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300">
                  Grupo {conv.categoria}
                </span>
              )}
              {conv.comunidad_autonoma && (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300">
                  {conv.comunidad_autonoma}
                </span>
              )}
            </div>

            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white leading-tight">
              {conv.titulo_limpio || conv.titulo}
            </h1>

            <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
              <time dateTime={conv.boe_fecha}>
                {new Date(conv.boe_fecha).toLocaleDateString('es-ES', {
                  weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
                })}
              </time>
              <span className="font-mono text-xs bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                {conv.boe_id}
              </span>
            </div>
          </header>

          {/* Stats */}
          <div className="grid md:grid-cols-3 gap-6 mb-8">
            {conv.num_plazas && conv.num_plazas > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 text-center">
                <p className="text-4xl font-bold text-green-600 dark:text-green-400">
                  {conv.num_plazas.toLocaleString('es-ES')}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  {conv.num_plazas === 1 ? 'Plaza' : 'Plazas'}
                </p>
              </div>
            )}
            {conv.plazo_inscripcion_dias && (
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 text-center">
                <p className="text-4xl font-bold text-blue-600 dark:text-blue-400">
                  {conv.plazo_inscripcion_dias}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Días hábiles de plazo</p>
              </div>
            )}
          </div>

          {/* Detalles */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-8">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Información</h2>
            <dl className="grid sm:grid-cols-2 gap-4">
              <div>
                <dt className="text-sm text-gray-500 dark:text-gray-400">Organismo</dt>
                <dd className="text-sm font-medium text-gray-900 dark:text-white">{conv.departamento_nombre || '-'}</dd>
              </div>
              {conv.acceso && (
                <div>
                  <dt className="text-sm text-gray-500 dark:text-gray-400">Tipo de acceso</dt>
                  <dd className="text-sm font-medium text-gray-900 dark:text-white">{ACCESO_LABELS[conv.acceso] || conv.acceso}</dd>
                </div>
              )}
              {conv.categoria && (
                <div>
                  <dt className="text-sm text-gray-500 dark:text-gray-400">Grupo</dt>
                  <dd className="text-sm font-medium text-gray-900 dark:text-white">{conv.categoria}</dd>
                </div>
              )}
              {conv.provincia && (
                <div>
                  <dt className="text-sm text-gray-500 dark:text-gray-400">Provincia</dt>
                  <dd className="text-sm font-medium text-gray-900 dark:text-white">{conv.provincia}</dd>
                </div>
              )}
            </dl>
          </div>

          {/* Documentos */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-8">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Documentos oficiales</h2>
            <div className="flex flex-wrap gap-4">
              {conv.boe_url_pdf && (
                <a href={conv.boe_url_pdf} target="_blank" rel="noopener noreferrer"
                   className="inline-flex items-center px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors">
                  Descargar PDF
                </a>
              )}
              {conv.boe_url_html && (
                <a href={conv.boe_url_html} target="_blank" rel="noopener noreferrer"
                   className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors">
                  Ver en BOE
                </a>
              )}
            </div>
          </div>

          {/* CTA */}
          {conv.oposicion_relacionada && (
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl shadow-lg p-6 text-white">
              <h2 className="text-xl font-bold mb-2">¿Preparas esta oposición?</h2>
              <p className="text-blue-100 mb-4">Practica con nuestros tests actualizados.</p>
              <div className="flex flex-wrap gap-3">
                <Link
                  href={`/${conv.oposicion_relacionada}/test/aleatorio`}
                  className="inline-flex items-center px-4 py-2 bg-white text-blue-600 font-medium rounded-lg hover:bg-blue-50"
                >
                  Hacer test ahora
                </Link>
                <Link
                  href={`/${conv.oposicion_relacionada}`}
                  className="inline-flex items-center px-4 py-2 bg-blue-500 text-white font-medium rounded-lg hover:bg-blue-400"
                >
                  Ver temario
                </Link>
              </div>
            </div>
          )}
        </article>
      </div>
    </>
  );
}
