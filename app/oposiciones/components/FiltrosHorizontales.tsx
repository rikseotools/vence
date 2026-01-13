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
    provincia?: string;
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

const PROVINCIAS = [
  { value: 'A coruña', label: 'A Coruña' },
  { value: 'Albacete', label: 'Albacete' },
  { value: 'Alicante', label: 'Alicante' },
  { value: 'Almería', label: 'Almería' },
  { value: 'Araba', label: 'Álava' },
  { value: 'Asturias', label: 'Asturias' },
  { value: 'Ávila', label: 'Ávila' },
  { value: 'Badajoz', label: 'Badajoz' },
  { value: 'Barcelona', label: 'Barcelona' },
  { value: 'Bizkaia', label: 'Vizcaya' },
  { value: 'Burgos', label: 'Burgos' },
  { value: 'Cantabria', label: 'Cantabria' },
  { value: 'Castellón', label: 'Castellón' },
  { value: 'Cáceres', label: 'Cáceres' },
  { value: 'Cádiz', label: 'Cádiz' },
  { value: 'Ciudad real', label: 'Ciudad Real' },
  { value: 'Córdoba', label: 'Córdoba' },
  { value: 'Cuenca', label: 'Cuenca' },
  { value: 'Gipuzkoa', label: 'Guipúzcoa' },
  { value: 'Girona', label: 'Girona' },
  { value: 'Granada', label: 'Granada' },
  { value: 'Guadalajara', label: 'Guadalajara' },
  { value: 'Huelva', label: 'Huelva' },
  { value: 'Huesca', label: 'Huesca' },
  { value: 'Illes balears', label: 'Islas Baleares' },
  { value: 'Jaén', label: 'Jaén' },
  { value: 'La rioja', label: 'La Rioja' },
  { value: 'Las palmas', label: 'Las Palmas' },
  { value: 'León', label: 'León' },
  { value: 'Lleida', label: 'Lleida' },
  { value: 'Lugo', label: 'Lugo' },
  { value: 'Madrid', label: 'Madrid' },
  { value: 'Murcia', label: 'Murcia' },
  { value: 'Málaga', label: 'Málaga' },
  { value: 'Ourense', label: 'Ourense' },
  { value: 'Palencia', label: 'Palencia' },
  { value: 'Pontevedra', label: 'Pontevedra' },
  { value: 'Salamanca', label: 'Salamanca' },
  { value: 'Santa cruz de tenerife', label: 'S.C. Tenerife' },
  { value: 'Segovia', label: 'Segovia' },
  { value: 'Sevilla', label: 'Sevilla' },
  { value: 'Soria', label: 'Soria' },
  { value: 'Tarragona', label: 'Tarragona' },
  { value: 'Teruel', label: 'Teruel' },
  { value: 'Toledo', label: 'Toledo' },
  { value: 'Valencia', label: 'Valencia' },
  { value: 'Valladolid', label: 'Valladolid' },
  { value: 'Zamora', label: 'Zamora' },
  { value: 'Zaragoza', label: 'Zaragoza' },
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
    currentFilters.provincia,
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
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  const params = new URLSearchParams(searchParams.toString());
                  params.delete('page');
                  if (searchQuery.trim()) {
                    params.set('q', searchQuery.trim());
                  } else {
                    params.delete('q');
                  }
                  router.push(`/oposiciones?${params.toString()}`);
                }
              }}
              placeholder="Buscar oposiciones... (ej: enfermería, trabajador social)"
              className="w-full pl-10 pr-10 py-2.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  // Limpiar inmediatamente de la URL
                  const params = new URLSearchParams(searchParams.toString());
                  params.delete('q');
                  params.delete('page');
                  router.push(`/oposiciones?${params.toString()}`);
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1"
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

        {/* Filtros principales: Grupo y Ámbito */}
        <div className="flex items-center gap-2 mb-3 overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 sm:overflow-visible scrollbar-hide">
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide shrink-0">
            Grupo:
          </span>
          {CATEGORIAS.map((cat) => (
            <Link
              key={cat.value}
              href={buildUrl('categoria', currentFilters.categoria === cat.value ? null : cat.value)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all whitespace-nowrap shrink-0 ${
                currentFilters.categoria === cat.value
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {cat.label}
            </Link>
          ))}

          <span className="text-gray-300 dark:text-gray-600 mx-1 shrink-0 hidden sm:inline">|</span>

          {/* Ámbito */}
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide shrink-0">
            Ámbito:
          </span>
          {AMBITOS.map((amb) => (
            <Link
              key={amb.value}
              href={buildUrl('ambito', currentFilters.ambito === amb.value ? null : amb.value)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all whitespace-nowrap shrink-0 ${
                currentFilters.ambito === amb.value
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {amb.label}
            </Link>
          ))}
        </div>

        {/* Segunda fila: Dropdowns de ubicación y tipo */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {/* CCAA dropdown */}
          <select
            value={currentFilters.ccaa || ''}
            onChange={(e) => router.push(buildUrl('ccaa', e.target.value || null))}
            className={`w-full px-3 py-2 text-sm border-2 rounded-lg focus:ring-2 focus:ring-blue-500 ${
              currentFilters.ccaa
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium'
                : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300'
            }`}
          >
            <option value="">CC.AA.</option>
            {CCAA.map((ca) => (
              <option key={ca.value} value={ca.value}>
                {ca.label}
              </option>
            ))}
          </select>

          {/* Provincia dropdown */}
          <select
            value={currentFilters.provincia || ''}
            onChange={(e) => router.push(buildUrl('provincia', e.target.value || null))}
            className={`w-full px-3 py-2 text-sm border-2 rounded-lg focus:ring-2 focus:ring-blue-500 ${
              currentFilters.provincia
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium'
                : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300'
            }`}
          >
            <option value="">Provincia</option>
            {PROVINCIAS.map((prov) => (
              <option key={prov.value} value={prov.value}>
                {prov.label}
              </option>
            ))}
          </select>

          {/* Tipo dropdown */}
          <select
            value={currentFilters.tipo || ''}
            onChange={(e) => router.push(buildUrl('tipo', e.target.value || null))}
            className={`w-full px-3 py-2 text-sm border-2 rounded-lg focus:ring-2 focus:ring-blue-500 ${
              currentFilters.tipo
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium'
                : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300'
            }`}
          >
            <option value="">Tipo</option>
            {TIPOS.map((tipo) => (
              <option key={tipo.value} value={tipo.value}>
                {tipo.label}
              </option>
            ))}
          </select>

          {/* Limpiar filtros - solo visible en móvil como botón */}
          {hasFilters && (
            <Link
              href="/oposiciones"
              className="w-full px-3 py-2 text-sm text-center border border-red-300 dark:border-red-600 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 sm:hidden"
            >
              Limpiar
            </Link>
          )}
        </div>

        {/* Filtros activos como badges con X - todos en azul para consistencia */}
        {hasFilters && (
          <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
            <span className="text-xs text-gray-500 dark:text-gray-400">Filtros:</span>
            {currentFilters.categoria && (
              <Link
                href={buildUrl('categoria', null)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 rounded-full text-sm font-medium hover:bg-blue-200 dark:hover:bg-blue-800/50 transition-colors border border-blue-200 dark:border-blue-700"
              >
                Grupo {currentFilters.categoria}
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </Link>
            )}
            {currentFilters.ambito && (
              <Link
                href={buildUrl('ambito', null)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 rounded-full text-sm font-medium hover:bg-blue-200 dark:hover:bg-blue-800/50 transition-colors border border-blue-200 dark:border-blue-700"
              >
                {AMBITOS.find(a => a.value === currentFilters.ambito)?.label}
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </Link>
            )}
            {currentFilters.ccaa && (
              <Link
                href={buildUrl('ccaa', null)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 rounded-full text-sm font-medium hover:bg-blue-200 dark:hover:bg-blue-800/50 transition-colors border border-blue-200 dark:border-blue-700"
              >
                {CCAA.find(c => c.value === currentFilters.ccaa)?.label}
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </Link>
            )}
            {currentFilters.provincia && (
              <Link
                href={buildUrl('provincia', null)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 rounded-full text-sm font-medium hover:bg-blue-200 dark:hover:bg-blue-800/50 transition-colors border border-blue-200 dark:border-blue-700"
              >
                {PROVINCIAS.find(p => p.value === currentFilters.provincia)?.label || currentFilters.provincia}
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </Link>
            )}
            {currentFilters.tipo && (
              <Link
                href={buildUrl('tipo', null)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 rounded-full text-sm font-medium hover:bg-blue-200 dark:hover:bg-blue-800/50 transition-colors border border-blue-200 dark:border-blue-700"
              >
                {TIPOS.find(t => t.value === currentFilters.tipo)?.label}
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </Link>
            )}
            {currentFilters.q && (
              <Link
                href={buildUrl('q', null)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 rounded-full text-sm font-medium hover:bg-blue-200 dark:hover:bg-blue-800/50 transition-colors border border-blue-200 dark:border-blue-700"
              >
                "{currentFilters.q}"
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
