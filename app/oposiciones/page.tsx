/**
 * Página principal de oposiciones - Convocatorias BOE
 * /oposiciones
 */

import { Metadata } from 'next';
import { createClient } from '@supabase/supabase-js';
import Link from 'next/link';
import { Suspense } from 'react';
import FiltrosHorizontales from './components/FiltrosHorizontales';
import ConvocatoriasLista from './components/ConvocatoriasLista';

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
    url: 'https://www.vence.es/oposiciones',
    type: 'website'
  },
  alternates: {
    canonical: 'https://www.vence.es/oposiciones'
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
  provincia?: string;
  q?: string;
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
  if (searchParams.provincia) {
    query = query.ilike('provincia', searchParams.provincia);
  }
  if (searchParams.q) {
    query = query.or(`titulo.ilike.%${searchParams.q}%,resumen.ilike.%${searchParams.q}%,departamento_nombre.ilike.%${searchParams.q}%,cuerpo.ilike.%${searchParams.q}%`);
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

  const [totalResult, convocatoriasResult, admitidosResult, ultimaResult] = await Promise.all([
    supabase
      .from('convocatorias_boe')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true),
    supabase
      .from('convocatorias_boe')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true)
      .eq('tipo', 'convocatoria'),
    supabase
      .from('convocatorias_boe')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true)
      .eq('tipo', 'admitidos'),
    supabase
      .from('convocatorias_boe')
      .select('boe_fecha')
      .eq('is_active', true)
      .order('boe_fecha', { ascending: false })
      .limit(1)
      .single()
  ]);

  return {
    total: totalResult.count || 0,
    porTipo: {
      'convocatoria': convocatoriasResult.count || 0,
      'admitidos': admitidosResult.count || 0
    },
    ultimaFecha: ultimaResult.data?.boe_fecha || null
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
      {/* Header compacto */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
                Oposiciones 2026
              </h1>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                Convocatorias del BOE actualizadas diariamente
              </p>
            </div>
            <div className="flex items-center gap-6 sm:gap-8">
              {/* Stats compactas */}
              <div className="hidden sm:flex items-center gap-4 text-sm">
                <div className="text-center">
                  <span className="font-bold text-blue-600 dark:text-blue-400">
                    {estadisticas.total.toLocaleString('es-ES')}
                  </span>
                  <span className="text-gray-500 dark:text-gray-400 ml-1">publicaciones</span>
                </div>
                <div className="text-center">
                  <span className="font-bold text-green-600 dark:text-green-400">
                    {(estadisticas.porTipo['convocatoria'] || 0).toLocaleString('es-ES')}
                  </span>
                  <span className="text-gray-500 dark:text-gray-400 ml-1">convocatorias</span>
                </div>
              </div>
              <Link
                href="/nuestras-oposiciones"
                className="inline-flex items-center px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg transition-colors shrink-0"
              >
                Preparar oposición
              </Link>
            </div>
          </div>

        </div>
      </div>

      {/* Filtros horizontales */}
      <Suspense fallback={<div className="h-24 bg-white dark:bg-gray-800 border-b animate-pulse" />}>
        <FiltrosHorizontales currentFilters={params} total={total} />
      </Suspense>

      {/* Lista de convocatorias */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Suspense fallback={
          <div className="animate-pulse space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-32 bg-gray-200 dark:bg-gray-700 rounded-lg" />
            ))}
          </div>
        }>
          <ConvocatoriasLista convocatorias={convocatorias} />
        </Suspense>

        {/* Paginación */}
        {totalPages > 1 && (
          <nav className="mt-8 flex justify-center">
            <div className="flex gap-2">
              {page > 1 && (
                <Link
                  href={`/oposiciones?${new URLSearchParams({ ...params, page: String(page - 1) } as Record<string, string>)}`}
                  className="px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-sm"
                >
                  Anterior
                </Link>
              )}
              <span className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400">
                Página {page} de {totalPages}
              </span>
              {page < totalPages && (
                <Link
                  href={`/oposiciones?${new URLSearchParams({ ...params, page: String(page + 1) } as Record<string, string>)}`}
                  className="px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-sm"
                >
                  Siguiente
                </Link>
              )}
            </div>
          </nav>
        )}

        {/* Sin resultados */}
        {convocatorias.length === 0 && (
          <div className="text-center py-12">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="mt-4 text-gray-500 dark:text-gray-400">
              No se encontraron oposiciones con estos filtros
            </p>
            <Link
              href="/oposiciones"
              className="mt-4 inline-block text-blue-600 hover:underline"
            >
              Ver todas las oposiciones
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
