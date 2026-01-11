/**
 * Página principal de oposiciones - Convocatorias BOE
 * /oposiciones
 */

import { Metadata } from 'next';
import { createClient } from '@supabase/supabase-js';
import Link from 'next/link';
import { Suspense } from 'react';
import ConvocatoriasFiltros from '../convocatorias/components/ConvocatoriasFiltros';
import ConvocatoriasLista from '../convocatorias/components/ConvocatoriasLista';

export const metadata: Metadata = {
  title: 'Oposiciones 2026 | Convocatorias BOE Actualizadas | Vence',
  description: 'Todas las convocatorias de oposiciones del BOE actualizadas diariamente. Auxiliar Administrativo, Administrativo del Estado, Gestión Procesal y más. Plazas, fechas y requisitos.',
  keywords: [
    'oposiciones 2026',
    'convocatorias oposiciones',
    'BOE oposiciones',
    'plazas oposiciones',
    'auxiliar administrativo convocatoria',
    'administrativo estado convocatoria',
    'oposiciones administración general estado'
  ],
  openGraph: {
    title: 'Oposiciones 2026 | Convocatorias BOE | Vence',
    description: 'Todas las convocatorias del BOE actualizadas diariamente',
    url: '/oposiciones',
    type: 'website'
  },
  alternates: {
    canonical: '/oposiciones'
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
  page?: string;
}

async function getConvocatorias(searchParams: SearchParams) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const page = parseInt(searchParams.page || '1');
  const limit = 20;
  const offset = (page - 1) * limit;

  let query = supabase
    .from('convocatorias_boe')
    .select('*', { count: 'exact' })
    .eq('is_active', true)
    .order('boe_fecha', { ascending: false })
    .order('relevancia_score', { ascending: false });

  // Aplicar filtros
  if (searchParams.categoria) {
    query = query.eq('categoria', searchParams.categoria);
  }
  if (searchParams.tipo) {
    query = query.eq('tipo', searchParams.tipo);
  }
  if (searchParams.oposicion) {
    query = query.eq('oposicion_relacionada', searchParams.oposicion);
  }
  if (searchParams.departamento) {
    query = query.ilike('departamento_nombre', `%${searchParams.departamento}%`);
  }
  if (searchParams.ambito) {
    query = query.eq('ambito', searchParams.ambito);
  }
  if (searchParams.ccaa) {
    query = query.eq('comunidad_autonoma', searchParams.ccaa);
  }

  query = query.range(offset, offset + limit - 1);

  const { data, error, count } = await query;

  if (error) {
    console.error('Error fetching convocatorias:', error);
    return { convocatorias: [], total: 0 };
  }

  return {
    convocatorias: data || [],
    total: count || 0
  };
}

async function getEstadisticas() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { data: porTipo } = await supabase
    .from('convocatorias_boe')
    .select('tipo')
    .eq('is_active', true);

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

export default async function OposicionesPage({
  searchParams
}: {
  searchParams: Promise<SearchParams>
}) {
  const params = await searchParams;
  const [{ convocatorias, total }, estadisticas] = await Promise.all([
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
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                Oposiciones 2026
              </h1>
              <p className="mt-2 text-gray-600 dark:text-gray-400">
                Todas las convocatorias del BOE actualizadas diariamente
              </p>
            </div>
            <Link
              href="/nuestras-oposiciones"
              className="inline-flex items-center px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg transition-colors"
            >
              Ver oposiciones que preparamos
            </Link>
          </div>

          {/* Estadísticas rápidas */}
          <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {estadisticas.total.toLocaleString('es-ES')}
              </p>
              <p className="text-sm text-blue-600 dark:text-blue-400">
                Total publicaciones
              </p>
            </div>
            <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                {(estadisticas.porTipo['convocatoria'] || 0).toLocaleString('es-ES')}
              </p>
              <p className="text-sm text-green-600 dark:text-green-400">
                Convocatorias
              </p>
            </div>
            <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4">
              <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                {(estadisticas.porTipo['admitidos'] || 0).toLocaleString('es-ES')}
              </p>
              <p className="text-sm text-purple-600 dark:text-purple-400">
                Listas admitidos
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

          {/* Filtros rápidos por categoría */}
          <div className="mt-6 flex flex-wrap gap-2">
            <Link
              href="/oposiciones/c1"
              className="px-4 py-2 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors font-medium"
            >
              Grupo C1
            </Link>
            <Link
              href="/oposiciones/c2"
              className="px-4 py-2 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 rounded-full hover:bg-emerald-200 dark:hover:bg-emerald-900/50 transition-colors font-medium"
            >
              Grupo C2
            </Link>
            <Link
              href="/oposiciones/a1"
              className="px-4 py-2 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-full hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-colors font-medium"
            >
              Grupo A1
            </Link>
            <Link
              href="/oposiciones/a2"
              className="px-4 py-2 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 rounded-full hover:bg-orange-200 dark:hover:bg-orange-900/50 transition-colors font-medium"
            >
              Grupo A2
            </Link>
            <Link
              href="/oposiciones/hoy"
              className="px-4 py-2 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-full hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors font-medium"
            >
              Publicadas hoy
            </Link>
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
            <div className="mb-4 flex justify-between items-center">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Mostrando {convocatorias.length} de {total.toLocaleString('es-ES')} resultados
              </p>
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
                      href={`/oposiciones?${new URLSearchParams({ ...params, page: String(page - 1) })}`}
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
                      href={`/oposiciones?${new URLSearchParams({ ...params, page: String(page + 1) })}`}
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
