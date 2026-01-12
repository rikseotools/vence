'use client';

/**
 * Componente de filtros para convocatorias
 * Estructura: Buscador + Filtros básicos + Filtros avanzados (ocultos)
 */

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';

interface FilterOption {
  value: string;
  label: string;
}

// Filtros básicos
const CATEGORIAS: FilterOption[] = [
  { value: 'C2', label: 'C2' },
  { value: 'C1', label: 'C1' },
  { value: 'A2', label: 'A2' },
  { value: 'A1', label: 'A1' },
];

// Ubicación combinada (ámbito + CCAA)
const UBICACIONES = {
  ambitos: [
    { value: 'estatal', label: 'Estatal (AGE)' },
    { value: 'autonomico', label: 'Autonómico' },
    { value: 'local', label: 'Local' },
  ],
  ccaa: [
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
    { value: 'Ceuta', label: 'Ceuta' },
    { value: 'Melilla', label: 'Melilla' },
  ]
};

// Filtros avanzados
const TIPOS: FilterOption[] = [
  { value: 'convocatoria', label: 'Nuevas convocatorias' },
  { value: 'admitidos', label: 'Listas admitidos' },
  { value: 'tribunal', label: 'Tribunales' },
  { value: 'resultado', label: 'Resultados' },
  { value: 'correccion', label: 'Correcciones' },
];

const OPOSICIONES: FilterOption[] = [
  { value: 'auxiliar-administrativo-estado', label: 'Auxiliar Administrativo Estado' },
  { value: 'administrativo-estado', label: 'Administrativo del Estado' },
  { value: 'gestion-procesal', label: 'Gestión Procesal' },
];

interface Props {
  currentFilters: {
    categoria?: string;
    tipo?: string;
    oposicion?: string;
    departamento?: string;
    ambito?: string;
    ccaa?: string;
    q?: string;
  };
}

export default function ConvocatoriasFiltros({ currentFilters }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [showAdvanced, setShowAdvanced] = useState(
    !!(currentFilters.tipo || currentFilters.oposicion)
  );
  const [searchQuery, setSearchQuery] = useState(currentFilters.q || '');

  const buildUrl = (key: string, value: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete('page'); // Reset page when filtering

    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }

    return `/convocatorias?${params.toString()}`;
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams(searchParams.toString());
    params.delete('page');

    if (searchQuery.trim()) {
      params.set('q', searchQuery.trim());
    } else {
      params.delete('q');
    }

    router.push(`/convocatorias?${params.toString()}`);
  };

  const hasFilters = currentFilters.categoria || currentFilters.tipo ||
                     currentFilters.oposicion || currentFilters.ambito ||
                     currentFilters.ccaa || currentFilters.q;

  const hasAdvancedFilters = currentFilters.tipo || currentFilters.oposicion;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <h2 className="font-semibold text-gray-900 dark:text-white">
          Buscar convocatorias
        </h2>
        {hasFilters && (
          <Link
            href="/convocatorias"
            className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
          >
            Limpiar
          </Link>
        )}
      </div>

      {/* Buscador */}
      <form onSubmit={handleSearch} className="mb-5">
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Ej: trabajador social, enfermería..."
            className="w-full px-4 py-2.5 pr-10 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <button
            type="submit"
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </button>
        </div>
      </form>

      {/* Grupo/Titulación */}
      <div className="mb-5">
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Grupo
        </h3>
        <div className="flex flex-wrap gap-2">
          {CATEGORIAS.map((cat) => (
            <Link
              key={cat.value}
              href={buildUrl('categoria', currentFilters.categoria === cat.value ? null : cat.value)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                currentFilters.categoria === cat.value
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {cat.label}
            </Link>
          ))}
        </div>
        <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
          C2: ESO · C1: Bachiller · A2: Grado · A1: Grado
        </p>
      </div>

      {/* Dónde - Ámbito */}
      <div className="mb-5">
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Ámbito
        </h3>
        <div className="flex flex-wrap gap-2">
          {UBICACIONES.ambitos.map((amb) => (
            <Link
              key={amb.value}
              href={buildUrl('ambito', currentFilters.ambito === amb.value ? null : amb.value)}
              className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                currentFilters.ambito === amb.value
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {amb.label}
            </Link>
          ))}
        </div>
      </div>

      {/* Dónde - CCAA (selector compacto) */}
      <div className="mb-5">
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Comunidad Autónoma
        </h3>
        <select
          value={currentFilters.ccaa || ''}
          onChange={(e) => router.push(buildUrl('ccaa', e.target.value || null))}
          className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="">Todas las CCAA</option>
          {UBICACIONES.ccaa.map((ca) => (
            <option key={ca.value} value={ca.value}>
              {ca.label}
            </option>
          ))}
        </select>
      </div>

      {/* Botón Filtros Avanzados */}
      <button
        onClick={() => setShowAdvanced(!showAdvanced)}
        className="w-full flex items-center justify-between px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
      >
        <span className="flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
          </svg>
          Más filtros
          {hasAdvancedFilters && (
            <span className="px-1.5 py-0.5 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded">
              {[currentFilters.tipo, currentFilters.oposicion].filter(Boolean).length}
            </span>
          )}
        </span>
        <svg
          className={`w-4 h-4 transition-transform ${showAdvanced ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Filtros Avanzados (colapsables) */}
      {showAdvanced && (
        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 space-y-5">
          {/* Tipo de publicación */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Tipo de publicación
            </h3>
            <div className="space-y-1">
              {TIPOS.map((tipo) => (
                <Link
                  key={tipo.value}
                  href={buildUrl('tipo', currentFilters.tipo === tipo.value ? null : tipo.value)}
                  className={`block px-3 py-1.5 rounded-md text-sm transition-colors ${
                    currentFilters.tipo === tipo.value
                      ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  {tipo.label}
                </Link>
              ))}
            </div>
          </div>

          {/* Oposición específica */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Oposición específica
            </h3>
            <div className="space-y-1">
              {OPOSICIONES.map((opo) => (
                <Link
                  key={opo.value}
                  href={buildUrl('oposicion', currentFilters.oposicion === opo.value ? null : opo.value)}
                  className={`block px-3 py-1.5 rounded-md text-sm transition-colors ${
                    currentFilters.oposicion === opo.value
                      ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 font-medium'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  {opo.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Info */}
      <div className="mt-5 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
        <p className="text-xs text-blue-700 dark:text-blue-300">
          Actualización diaria desde el BOE
        </p>
      </div>
    </div>
  );
}
