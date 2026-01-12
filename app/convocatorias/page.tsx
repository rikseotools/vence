/**
 * Página de listado de convocatorias de oposiciones
 * /convocatorias
 */

import { Metadata } from 'next';
import { createClient } from '@supabase/supabase-js';
import Link from 'next/link';
import { Suspense } from 'react';
import ConvocatoriasFiltros from './components/ConvocatoriasFiltros';
import ConvocatoriasLista from './components/ConvocatoriasLista';

export const metadata: Metadata = {
  title: 'Oposiciones Convocadas 2026 | Plazas y Requisitos | Vence',
  description: 'Todas las oposiciones convocadas en España. Consulta plazas, requisitos, fechas y bases. Auxiliar Administrativo, Administrativo del Estado, Gestión Procesal y más.',
  keywords: [
    'oposiciones convocadas 2026',
    'plazas oposiciones',
    'convocatorias BOE',
    'auxiliar administrativo convocatoria',
    'administrativo estado convocatoria',
    'oposiciones administración general estado',
    'oposiciones abiertas'
  ],
  openGraph: {
    title: 'Oposiciones Convocadas 2026 | Vence',
    description: 'Todas las oposiciones convocadas en España con plazas, requisitos y fechas',
    url: '/convocatorias',
    type: 'website'
  },
  alternates: {
    canonical: '/convocatorias'
  }
};

// Revalidar cada hora
export const revalidate = 3600;

interface SearchParams {
  categoria?: string;
  tipo?: string;
  oposicion?: string;
  departamento?: string;
  ambito?: string;
  ccaa?: string;
  q?: string;
  page?: string;
  todas?: string; // Si es 'true', muestra todas las publicaciones
}

async function getConvocatorias(searchParams: SearchParams) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const page = parseInt(searchParams.page || '1');
  const limit = 20;
  const offset = (page - 1) * limit;

  // Por defecto solo mostramos convocatorias (bases nuevas)
  // A menos que el usuario pida ver todas las publicaciones
  const mostrarTodas = searchParams.todas === 'true';

  let query = supabase
    .from('convocatorias_boe')
    .select('*', { count: 'exact' })
    .eq('is_active', true)
    .order('boe_fecha', { ascending: false })
    .order('relevancia_score', { ascending: false });

  // Filtro por defecto: solo convocatorias (bases nuevas)
  if (!mostrarTodas) {
    if (searchParams.tipo) {
      query = query.eq('tipo', searchParams.tipo);
    } else {
      // Por defecto solo convocatorias
      query = query.eq('tipo', 'convocatoria');
    }
  } else if (searchParams.tipo) {
    // Si mostrarTodas pero hay filtro de tipo específico
    query = query.eq('tipo', searchParams.tipo);
  }

  // Aplicar filtros
  if (searchParams.categoria) {
    query = query.eq('categoria', searchParams.categoria);
  }
  if (searchParams.oposicion) {
    query = query.eq('oposicion_relacionada', searchParams.oposicion);
  }
  if (searchParams.departamento) {
    query = query.ilike('departamento_nombre', `%${searchParams.departamento}%`);
  }
  // Filtros geográficos
  if (searchParams.ambito) {
    query = query.eq('ambito', searchParams.ambito);
  }
  if (searchParams.ccaa) {
    query = query.eq('comunidad_autonoma', searchParams.ccaa);
  }
  // Búsqueda de texto
  if (searchParams.q) {
    query = query.or(`titulo.ilike.%${searchParams.q}%,resumen.ilike.%${searchParams.q}%,departamento_nombre.ilike.%${searchParams.q}%`);
  }

  // Paginación
  query = query.range(offset, offset + limit - 1);

  const { data, error, count } = await query;

  if (error) {
    console.error('Error fetching convocatorias:', error);
    return { convocatorias: [], total: 0, mostrarTodas };
  }

  return {
    convocatorias: data || [],
    total: count || 0,
    mostrarTodas
  };
}

async function getEstadisticas() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // Contar por tipo
  const { data: porTipo } = await supabase
    .from('convocatorias_boe')
    .select('tipo')
    .eq('is_active', true);

  // Última actualización
  const { data: ultima } = await supabase
    .from('convocatorias_boe')
    .select('boe_fecha')
    .eq('is_active', true)
    .order('boe_fecha', { ascending: false })
    .limit(1)
    .single();

  const tiposCount = (porTipo || []).reduce((acc: Record<string, number>, item) => {
    const tipo = item.tipo || 'otro';
    acc[tipo] = (acc[tipo] || 0) + 1;
    return acc;
  }, {});

  return {
    total: porTipo?.length || 0,
    porTipo: tiposCount,
    ultimaFecha: ultima?.boe_fecha || null
  };
}

export default async function ConvocatoriasPage({
  searchParams
}: {
  searchParams: Promise<SearchParams>
}) {
  const params = await searchParams;
  const [{ convocatorias, total, mostrarTodas }, estadisticas] = await Promise.all([
    getConvocatorias(params),
    getEstadisticas()
  ]);

  const page = parseInt(params.page || '1');
  const totalPages = Math.ceil(total / 20);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            {mostrarTodas ? 'Todas las Publicaciones BOE' : 'Oposiciones Convocadas'}
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            {mostrarTodas
              ? 'Todas las publicaciones de oposiciones del BOE'
              : 'Procesos selectivos con convocatoria abierta'
            } · {new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}
          </p>

          {/* Estadísticas rápidas */}
          <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                {estadisticas.porTipo['convocatoria'] || 0}
              </p>
              <p className="text-sm text-green-600 dark:text-green-400">
                Oposiciones
              </p>
            </div>
            <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4">
              <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                {estadisticas.porTipo['admitidos'] || 0}
              </p>
              <p className="text-sm text-purple-600 dark:text-purple-400">
                Listas admitidos
              </p>
            </div>
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {estadisticas.porTipo['resultado'] || 0}
              </p>
              <p className="text-sm text-blue-600 dark:text-blue-400">
                Resultados
              </p>
            </div>
            <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-4">
              <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                {estadisticas.ultimaFecha ? new Date(estadisticas.ultimaFecha).toLocaleDateString('es-ES') : '-'}
              </p>
              <p className="text-sm text-orange-600 dark:text-orange-400">
                Última actualización
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Contenido */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Filtros */}
          <aside className="lg:w-64 flex-shrink-0">
            <Suspense fallback={<div className="animate-pulse h-96 bg-gray-200 dark:bg-gray-700 rounded-lg" />}>
              <ConvocatoriasFiltros currentFilters={params} />
            </Suspense>
          </aside>

          {/* Lista */}
          <main className="flex-1">
            <div className="mb-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Mostrando {convocatorias.length} de {total} {mostrarTodas ? 'publicaciones' : 'oposiciones'}
              </p>
              <Link
                href={mostrarTodas
                  ? `/convocatorias?${new URLSearchParams(Object.fromEntries(Object.entries(params).filter(([k]) => k !== 'todas' && k !== 'page')))}`
                  : `/convocatorias?${new URLSearchParams({ ...Object.fromEntries(Object.entries(params).filter(([k]) => k !== 'page')), todas: 'true' })}`
                }
                className="text-sm text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
              >
                {mostrarTodas ? (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                    </svg>
                    Solo oposiciones
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                    </svg>
                    Ver todas las publicaciones
                  </>
                )}
              </Link>
            </div>

            <Suspense fallback={<div className="animate-pulse space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-32 bg-gray-200 dark:bg-gray-700 rounded-lg" />
              ))}
            </div>}>
              <ConvocatoriasLista convocatorias={convocatorias} />
            </Suspense>

            {/* Paginación */}
            {totalPages > 1 && (
              <nav className="mt-8 flex justify-center">
                <div className="flex gap-2">
                  {page > 1 && (
                    <Link
                      href={`/convocatorias?${new URLSearchParams({ ...params, page: String(page - 1) })}`}
                      className="px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                    >
                      Anterior
                    </Link>
                  )}
                  <span className="px-4 py-2 text-gray-600 dark:text-gray-400">
                    Página {page} de {totalPages}
                  </span>
                  {page < totalPages && (
                    <Link
                      href={`/convocatorias?${new URLSearchParams({ ...params, page: String(page + 1) })}`}
                      className="px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                    >
                      Siguiente
                    </Link>
                  )}
                </div>
              </nav>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
