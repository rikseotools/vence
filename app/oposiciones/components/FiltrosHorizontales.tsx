'use client';

/**
 * Filtros horizontales compactos para oposiciones
 * Diseño: barra de búsqueda + chips de filtros + dropdown para más opciones
 */

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useEffect, useCallback } from 'react';

interface Props {
  currentFilters: {
    categoria?: string;
    tipo?: string;
    oposicion?: string;
    ambito?: string;
    ccaa?: string;
    q?: string;
  };
  total: number;
}

const CATEGORIAS = [
  { value: 'C2', label: 'C2', color: 'emerald' },
  { value: 'C1', label: 'C1', color: 'blue' },
  { value: 'A2', label: 'A2', color: 'orange' },
  { value: 'A1', label: 'A1', color: 'purple' },
];

const AMBITOS = [
  { value: 'estatal', label: 'AGE' },
  { value: 'autonomico', label: 'Autonómico' },
  { value: 'local', label: 'Local' },
];

const TIPOS = [
  { value: 'convocatoria', label: 'Convocatorias' },
  { value: 'admitidos', label: 'Admitidos' },
  { value: 'tribunal', label: 'Tribunales' },
  { value: 'resultado', label: 'Resultados' },
];

const CCAA = [
  { value: 'Andalucía', label: 'Andalucía' },
  { value: 'Aragón', label: 'Aragón' },
  { value: 'Asturias', label: 'Asturias' },
  { value: 'Islas Baleares', label: 'Baleares' },
  { value: 'Canarias', label: 'Canarias' },
  { value: 'Cantabria', label: 'Cantabria' },
  { value: 'Castilla-La Mancha', label: 'C. La Mancha' },
  { value: 'Castilla y León', label: 'C. y León' },
  { value: 'Cataluña', label: 'Cataluña' },
  { value: 'Comunidad Valenciana', label: 'C. Valenciana' },
  { value: 'Extremadura', label: 'Extremadura' },
  { value: 'Galicia', label: 'Galicia' },
  { value: 'La Rioja', label: 'La Rioja' },
  { value: 'Madrid', label: 'Madrid' },
  { value: 'Murcia', label: 'Murcia' },
  { value: 'Navarra', label: 'Navarra' },
  { value: 'País Vasco', label: 'País Vasco' },
];

export default function FiltrosHorizontales({ currentFilters, total }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [searchQuery, setSearchQuery] = useState(currentFilters.q || '');
  const [showMoreFilters, setShowMoreFilters] = useState(false);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery !== (currentFilters.q || '')) {
        const params = new URLSearchParams(searchParams.toString());
        params.delete('page');
        if (searchQuery.trim()) {
          params.set('q', searchQuery.trim());
        } else {
          params.delete('q');
        }
        router.push(`/oposiciones?${params.toString()}`);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [searchQuery, currentFilters.q, router, searchParams]);

  const buildUrl = useCallback((key: string, value: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete('page');
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    return `/oposiciones?${params.toString()}`;
  }, [searchParams]);

  const activeFiltersCount = [
    currentFilters.categoria,
    currentFilters.tipo,
    currentFilters.ambito,
    currentFilters.ccaa,
    currentFilters.q
  ].filter(Boolean).length;

  const hasFilters = activeFiltersCount > 0;

  return (
    <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        {/* Barra de búsqueda */}
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="relative flex-1">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar oposiciones... (ej: enfermería, trabajador social)"
              className="w-full pl-10 pr-4 py-2.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          {/* Contador y limpiar */}
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
              {total.toLocaleString('es-ES')} resultados
            </span>
            {hasFilters && (
              <Link
                href="/oposiciones"
                className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 whitespace-nowrap"
              >
                Limpiar filtros
              </Link>
            )}
          </div>
        </div>

        {/* Filtros principales: Grupo */}
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mr-1">
            Grupo:
          </span>
          {CATEGORIAS.map((cat) => (
            <Link
              key={cat.value}
              href={buildUrl('categoria', currentFilters.categoria === cat.value ? null : cat.value)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                currentFilters.categoria === cat.value
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {cat.label}
            </Link>
          ))}

          <span className="text-gray-300 dark:text-gray-600 mx-2">|</span>

          {/* Ámbito */}
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mr-1">
            Ámbito:
          </span>
          {AMBITOS.map((amb) => (
            <Link
              key={amb.value}
              href={buildUrl('ambito', currentFilters.ambito === amb.value ? null : amb.value)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                currentFilters.ambito === amb.value
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {amb.label}
            </Link>
          ))}
        </div>

        {/* Segunda fila: CCAA y Tipo */}
        <div className="flex flex-wrap items-center gap-2">
          {/* CCAA dropdown */}
          <select
            value={currentFilters.ccaa || ''}
            onChange={(e) => router.push(buildUrl('ccaa', e.target.value || null))}
            className={`px-3 py-1.5 text-sm border rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 ${
              currentFilters.ccaa
                ? 'border-green-500 text-green-700 dark:text-green-300'
                : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300'
            }`}
          >
            <option value="">Comunidad Autónoma</option>
            {CCAA.map((ca) => (
              <option key={ca.value} value={ca.value}>
                {ca.label}
              </option>
            ))}
          </select>

          {/* Tipo dropdown */}
          <select
            value={currentFilters.tipo || ''}
            onChange={(e) => router.push(buildUrl('tipo', e.target.value || null))}
            className={`px-3 py-1.5 text-sm border rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 ${
              currentFilters.tipo
                ? 'border-orange-500 text-orange-700 dark:text-orange-300'
                : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300'
            }`}
          >
            <option value="">Tipo de publicación</option>
            {TIPOS.map((tipo) => (
              <option key={tipo.value} value={tipo.value}>
                {tipo.label}
              </option>
            ))}
          </select>

          {/* Filtros activos como badges */}
          {currentFilters.ccaa && (
            <Link
              href={buildUrl('ccaa', null)}
              className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-full text-xs"
            >
              {CCAA.find(c => c.value === currentFilters.ccaa)?.label}
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </Link>
          )}
          {currentFilters.tipo && (
            <Link
              href={buildUrl('tipo', null)}
              className="inline-flex items-center gap-1 px-2 py-1 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 rounded-full text-xs"
            >
              {TIPOS.find(t => t.value === currentFilters.tipo)?.label}
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
