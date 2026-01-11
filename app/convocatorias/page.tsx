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
  title: 'Convocatorias de Oposiciones 2026 | BOE Actualizado | Vence',
  description: 'Todas las convocatorias de oposiciones del BOE actualizadas diariamente. Auxiliar Administrativo, Administrativo del Estado, Gestión Procesal y más. Plazas, fechas y requisitos.',
  keywords: [
    'convocatorias oposiciones 2026',
    'BOE oposiciones',
    'plazas oposiciones',
    'auxiliar administrativo convocatoria',
    'administrativo estado convocatoria',
    'oposiciones administración general estado'
  ],
  openGraph: {
    title: 'Convocatorias de Oposiciones 2026 | Vence',
    description: 'Todas las convocatorias del BOE actualizadas diariamente',
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
  // Filtros geográficos
  if (searchParams.ambito) {
    query = query.eq('ambito', searchParams.ambito);
  }
  if (searchParams.ccaa) {
    query = query.eq('comunidad_autonoma', searchParams.ccaa);
  }

  // Paginación
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
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Convocatorias de Oposiciones
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Todas las convocatorias del BOE actualizadas diariamente
          </p>

          {/* Estadísticas rápidas */}
          <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {estadisticas.total}
              </p>
              <p className="text-sm text-blue-600 dark:text-blue-400">
                Total publicaciones
              </p>
            </div>
            <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                {estadisticas.porTipo['convocatoria'] || 0}
              </p>
              <p className="text-sm text-green-600 dark:text-green-400">
                Convocatorias
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
            <div className="mb-4 flex justify-between items-center">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Mostrando {convocatorias.length} de {total} resultados
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
