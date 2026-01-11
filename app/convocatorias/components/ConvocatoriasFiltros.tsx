'use client';

/**
 * Componente de filtros para convocatorias
 */

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';

interface FilterOption {
  value: string;
  label: string;
}

const TIPOS: FilterOption[] = [
  { value: 'convocatoria', label: 'Convocatorias' },
  { value: 'admitidos', label: 'Listas admitidos' },
  { value: 'tribunal', label: 'Tribunales' },
  { value: 'resultado', label: 'Resultados' },
  { value: 'correccion', label: 'Correcciones' },
];

const CATEGORIAS: FilterOption[] = [
  { value: 'C2', label: 'C2 - Auxiliar' },
  { value: 'C1', label: 'C1 - Administrativo' },
  { value: 'A2', label: 'A2 - Grado medio' },
  { value: 'A1', label: 'A1 - Grado superior' },
];

const OPOSICIONES: FilterOption[] = [
  { value: 'auxiliar-administrativo-estado', label: 'Auxiliar Administrativo' },
  { value: 'administrativo-estado', label: 'Administrativo del Estado' },
  { value: 'gestion-procesal', label: 'Gestión Procesal' },
];

const AMBITOS: FilterOption[] = [
  { value: 'estatal', label: 'Estatal (AGE)' },
  { value: 'autonomico', label: 'Autonómico' },
  { value: 'local', label: 'Local (Aytos/Dipus)' },
];

const CCAA: FilterOption[] = [
  { value: 'Andalucía', label: 'Andalucía' },
  { value: 'Aragón', label: 'Aragón' },
  { value: 'Asturias', label: 'Asturias' },
  { value: 'Islas Baleares', label: 'Islas Baleares' },
  { value: 'Canarias', label: 'Canarias' },
  { value: 'Cantabria', label: 'Cantabria' },
  { value: 'Castilla-La Mancha', label: 'Castilla-La Mancha' },
  { value: 'Castilla y León', label: 'Castilla y León' },
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
];

interface Props {
  currentFilters: {
    categoria?: string;
    tipo?: string;
    oposicion?: string;
    departamento?: string;
    ambito?: string;
    ccaa?: string;
  };
}

export default function ConvocatoriasFiltros({ currentFilters }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

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

  const hasFilters = currentFilters.categoria || currentFilters.tipo ||
                     currentFilters.oposicion || currentFilters.departamento ||
                     currentFilters.ambito || currentFilters.ccaa;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="font-semibold text-gray-900 dark:text-white">
          Filtros
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

      {/* Tipo */}
      <div className="mb-6">
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Tipo de publicación
        </h3>
        <div className="space-y-2">
          {TIPOS.map((tipo) => (
            <Link
              key={tipo.value}
              href={buildUrl('tipo', currentFilters.tipo === tipo.value ? null : tipo.value)}
              className={`block px-3 py-2 rounded-md text-sm transition-colors ${
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

      {/* Categoría */}
      <div className="mb-6">
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Grupo/Subgrupo
        </h3>
        <div className="space-y-2">
          {CATEGORIAS.map((cat) => (
            <Link
              key={cat.value}
              href={buildUrl('categoria', currentFilters.categoria === cat.value ? null : cat.value)}
              className={`block px-3 py-2 rounded-md text-sm transition-colors ${
                currentFilters.categoria === cat.value
                  ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              {cat.label}
            </Link>
          ))}
        </div>
      </div>

      {/* Oposición */}
      <div className="mb-6">
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Tu oposición
        </h3>
        <div className="space-y-2">
          {OPOSICIONES.map((opo) => (
            <Link
              key={opo.value}
              href={buildUrl('oposicion', currentFilters.oposicion === opo.value ? null : opo.value)}
              className={`block px-3 py-2 rounded-md text-sm transition-colors ${
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

      {/* Ámbito */}
      <div className="mb-6">
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Ámbito territorial
        </h3>
        <div className="space-y-2">
          {AMBITOS.map((amb) => (
            <Link
              key={amb.value}
              href={buildUrl('ambito', currentFilters.ambito === amb.value ? null : amb.value)}
              className={`block px-3 py-2 rounded-md text-sm transition-colors ${
                currentFilters.ambito === amb.value
                  ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 font-medium'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              {amb.label}
            </Link>
          ))}
        </div>
      </div>

      {/* Comunidad Autónoma */}
      <div className="mb-6">
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Comunidad Autónoma
        </h3>
        <div className="space-y-1 max-h-48 overflow-y-auto">
          {CCAA.map((ca) => (
            <Link
              key={ca.value}
              href={buildUrl('ccaa', currentFilters.ccaa === ca.value ? null : ca.value)}
              className={`block px-3 py-1.5 rounded-md text-sm transition-colors ${
                currentFilters.ccaa === ca.value
                  ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 font-medium'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              {ca.label}
            </Link>
          ))}
        </div>
      </div>

      {/* Info */}
      <div className="mt-6 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
        <p className="text-xs text-blue-700 dark:text-blue-300">
          Las convocatorias se actualizan automáticamente cada día desde el BOE
        </p>
      </div>
    </div>
  );
}
