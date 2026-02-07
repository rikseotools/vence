// @ts-nocheck - TODO: Migrate to strict TypeScript
'use client';

/**
 * Componente de lista de convocatorias/oposiciones
 * Muestra los procesos selectivos agrupados con sus publicaciones relacionadas
 */

import Link from 'next/link';
import { useState, useEffect } from 'react';

interface PublicacionRelacionada {
  id: string;
  boe_id: string;
  boe_fecha: string;
  boe_url_html: string | null;
  titulo_limpio: string | null;
  tipo: string | null;
  resumen: string | null;
}

interface Convocatoria {
  id: string;
  boe_id: string;
  boe_fecha: string;
  titulo: string;
  titulo_limpio: string | null;
  departamento_nombre: string | null;
  epigrafe: string | null;
  tipo: string | null;
  categoria: string | null;
  num_plazas: number | null;
  num_plazas_libre: number | null;
  num_plazas_pi: number | null;
  oposicion_relacionada: string | null;
  boe_url_pdf: string | null;
  boe_url_html: string | null;
  ambito: string | null;
  comunidad_autonoma: string | null;
  provincia: string | null;
  municipio: string | null;
  resumen: string | null;
  acceso: string | null;
  plazo_inscripcion_dias: number | null;
  fecha_limite_inscripcion: string | null;
  // Nuevos campos para agrupación
  publicaciones_relacionadas?: PublicacionRelacionada[] | string;
  total_relacionadas?: number;
  es_standalone?: boolean;
}

interface Props {
  convocatorias: Convocatoria[];
}

// Tipo solo se muestra si NO estamos en vista de convocatorias (modo todas)
const TIPO_BADGES: Record<string, { bg: string; text: string; label: string }> = {
  convocatoria: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-300', label: 'Convocatoria' },
  admitidos: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-300', label: 'Admitidos' },
  tribunal: { bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-700 dark:text-purple-300', label: 'Tribunal' },
  resultado: { bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-700 dark:text-yellow-300', label: 'Resultado' },
  correccion: { bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-700 dark:text-orange-300', label: 'Corrección' },
  otro: { bg: 'bg-gray-100 dark:bg-gray-700', text: 'text-gray-700 dark:text-gray-300', label: 'Otro' },
};

const CATEGORIA_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  'C2': { bg: 'bg-teal-600', text: 'text-white', label: 'C2 · ESO' },
  'C1': { bg: 'bg-indigo-600', text: 'text-white', label: 'C1 · Bachiller' },
  'A2': { bg: 'bg-pink-600', text: 'text-white', label: 'A2 · Grado' },
  'A1': { bg: 'bg-red-600', text: 'text-white', label: 'A1 · Grado' },
  'B': { bg: 'bg-cyan-600', text: 'text-white', label: 'B · FP Superior' },
};

const ACCESO_LABELS: Record<string, string> = {
  'libre': 'Libre',
  'promocion_interna': 'Promoción interna',
  'mixto': 'Libre + PI',
  'discapacidad': 'Discapacidad',
};

// Componente para una publicación relacionada (dentro del cajón)
function PublicacionRelacionadaItem({ pub, onBoeClick }: { pub: PublicacionRelacionada; onBoeClick: () => void }) {
  const tipoBadge = TIPO_BADGES[pub.tipo || 'otro'] || TIPO_BADGES.otro;

  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-gray-100 dark:border-gray-700 last:border-0">
      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${tipoBadge.bg} ${tipoBadge.text} shrink-0`}>
        {tipoBadge.label}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-700 dark:text-gray-300 line-clamp-1">
          {pub.titulo_limpio || pub.resumen || 'Sin título'}
        </p>
        <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 dark:text-gray-400">
          <span>
            {new Date(pub.boe_fecha).toLocaleDateString('es-ES', {
              day: 'numeric',
              month: 'short',
              year: 'numeric'
            })}
          </span>
          {pub.boe_url_html && (
            <a
              href={pub.boe_url_html}
              target="_blank"
              rel="noopener noreferrer"
              onClick={onBoeClick}
              className="text-blue-600 dark:text-blue-400 hover:underline"
            >
              Ver BOE
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ConvocatoriasLista({ convocatorias }: Props) {
  const [showToast, setShowToast] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  // Auto-hide toast after 2 seconds
  useEffect(() => {
    if (showToast) {
      const timer = setTimeout(() => setShowToast(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [showToast]);

  const handleBoeClick = () => {
    setShowToast(true);
  };

  const toggleExpanded = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Parsear publicaciones_relacionadas si viene como string JSON
  const parseRelacionadas = (conv: Convocatoria): PublicacionRelacionada[] => {
    if (!conv.publicaciones_relacionadas) return [];
    if (typeof conv.publicaciones_relacionadas === 'string') {
      try {
        return JSON.parse(conv.publicaciones_relacionadas);
      } catch {
        return [];
      }
    }
    return conv.publicaciones_relacionadas;
  };

  if (convocatorias.length === 0) {
    return (
      <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
          No hay oposiciones
        </h3>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          No se encontraron oposiciones con los filtros seleccionados
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {convocatorias.map((conv) => {
        const tipoBadge = TIPO_BADGES[conv.tipo || 'otro'] || TIPO_BADGES.otro;
        const categoriaInfo = conv.categoria ? CATEGORIA_COLORS[conv.categoria] : null;
        const esConvocatoria = conv.tipo === 'convocatoria';
        const esStandalone = conv.es_standalone === true;
        const relacionadas = parseRelacionadas(conv);
        const tieneRelacionadas = relacionadas.length > 0;
        const isExpanded = expandedIds.has(conv.id);

        // Construir ubicación
        const ubicacion = [
          conv.municipio,
          conv.provincia,
          conv.comunidad_autonoma
        ].filter(Boolean).join(', ') || (conv.ambito === 'estatal' ? 'Nacional' : null);

        // Calcular estado de inscripción
        const hoy = new Date().toISOString().split('T')[0];
        const inscripcionAbierta = conv.fecha_limite_inscripcion
          ? conv.fecha_limite_inscripcion >= hoy
          : null;

        // Días restantes
        const diasRestantes = conv.fecha_limite_inscripcion
          ? Math.ceil((new Date(conv.fecha_limite_inscripcion).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
          : null;

        return (
          <article
            key={conv.id}
            className={`bg-white dark:bg-gray-800 rounded-lg border overflow-hidden hover:shadow-md transition-shadow ${
              tieneRelacionadas
                ? 'border-green-200 dark:border-green-700/50'
                : 'border-gray-200 dark:border-gray-700'
            }`}
          >
            <div className="flex">
              {/* Barra lateral de categoría */}
              {categoriaInfo && (
                <div className={`w-1.5 ${categoriaInfo.bg} flex-shrink-0`} />
              )}

              <div className="flex-1">
                <div className="p-4">
                  {/* Header: Badges + Plazas */}
                  <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
                    <div className="flex flex-wrap gap-2">
                      {/* Badge de tipo para items standalone */}
                      {esStandalone && (
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${tipoBadge.bg} ${tipoBadge.text}`}>
                          {tipoBadge.label}
                        </span>
                      )}
                      {categoriaInfo && (
                        <span className={`inline-flex items-center px-2.5 py-1 rounded text-xs font-semibold ${categoriaInfo.bg} ${categoriaInfo.text}`}>
                          {categoriaInfo.label}
                        </span>
                      )}
                      {conv.acceso && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                          {ACCESO_LABELS[conv.acceso] || conv.acceso}
                        </span>
                      )}
                      {conv.oposicion_relacionada && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                          Tu oposición
                        </span>
                      )}
                      {/* Indicador de publicaciones relacionadas */}
                      {tieneRelacionadas && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">
                          +{relacionadas.length} actualización{relacionadas.length > 1 ? 'es' : ''}
                        </span>
                      )}
                      {/* Estado inscripción */}
                      {inscripcionAbierta !== null && (
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          inscripcionAbierta
                            ? diasRestantes !== null && diasRestantes <= 5
                              ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300'
                              : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                            : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                        }`}>
                          {inscripcionAbierta
                            ? diasRestantes !== null && diasRestantes <= 5
                              ? `⏰ ${diasRestantes}d`
                              : '✓ Abierta'
                            : '✗ Cerrada'}
                        </span>
                      )}
                    </div>

                    {/* Plazas destacadas */}
                    {conv.num_plazas && conv.num_plazas > 0 && (
                      <div className="flex items-center gap-1 bg-emerald-50 dark:bg-emerald-900/20 px-3 py-1 rounded-lg">
                        <span className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
                          {conv.num_plazas}
                        </span>
                        <span className="text-sm text-emerald-600 dark:text-emerald-400">
                          {conv.num_plazas === 1 ? 'plaza' : 'plazas'}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Título */}
                  {conv.oposicion_relacionada ? (
                    <Link
                      href={`/oposiciones/${conv.oposicion_relacionada}`}
                      className="block group"
                    >
                      <h3 className="text-base font-semibold text-gray-900 dark:text-white line-clamp-2 leading-snug group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                        {conv.titulo_limpio || conv.titulo}
                      </h3>
                    </Link>
                  ) : (
                    <h3 className="text-base font-semibold text-gray-900 dark:text-white line-clamp-2 leading-snug">
                      {conv.titulo_limpio || conv.titulo}
                    </h3>
                  )}

                  {/* Resumen si existe */}
                  {conv.resumen && (
                    <p className="mt-1.5 text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
                      {conv.resumen}
                    </p>
                  )}

                  {/* Meta info */}
                  <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-gray-500 dark:text-gray-400">
                    {/* Fecha BOE */}
                    <span className="flex items-center">
                      <svg className="mr-1 h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      {new Date(conv.boe_fecha).toLocaleDateString('es-ES', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric'
                      })}
                    </span>

                    {/* Fecha límite inscripción */}
                    {conv.fecha_limite_inscripcion && (
                      <span className={`flex items-center ${
                        inscripcionAbierta
                          ? 'text-green-600 dark:text-green-400'
                          : 'text-red-500 dark:text-red-400'
                      }`}>
                        <svg className="mr-1 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Límite: {new Date(conv.fecha_limite_inscripcion).toLocaleDateString('es-ES', {
                          day: 'numeric',
                          month: 'short'
                        })}
                      </span>
                    )}

                    {/* Ubicación */}
                    {ubicacion && (
                      <span className="flex items-center">
                        <svg className="mr-1 h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        <span className="truncate max-w-[180px]">{ubicacion}</span>
                      </span>
                    )}

                    {/* Departamento */}
                    {conv.departamento_nombre && (
                      <span className="flex items-center">
                        <svg className="mr-1 h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                        <span className="truncate max-w-[200px]">
                          {conv.departamento_nombre.replace('MINISTERIO DE ', '').replace('MINISTERIO PARA ', '')}
                        </span>
                      </span>
                    )}
                  </div>

                  {/* Detalles de plazas si hay desglose */}
                  {(conv.num_plazas_libre || conv.num_plazas_pi) && (
                    <div className="mt-2 flex gap-3 text-xs text-gray-500 dark:text-gray-400">
                      {conv.num_plazas_libre && (
                        <span>Libre: {conv.num_plazas_libre}</span>
                      )}
                      {conv.num_plazas_pi && (
                        <span>PI: {conv.num_plazas_pi}</span>
                      )}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between">
                    <div className="flex gap-4">
                      {conv.oposicion_relacionada && (
                        <Link
                          href={`/oposiciones/${conv.oposicion_relacionada}`}
                          className="text-sm font-medium text-green-600 dark:text-green-400 hover:underline flex items-center"
                        >
                          <svg className="mr-1 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                          </svg>
                          Ver oposición
                        </Link>
                      )}
                      {conv.boe_url_html && (
                        <a
                          href={conv.boe_url_html}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={handleBoeClick}
                          className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline flex items-center"
                        >
                          <svg className="mr-1 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                          Ver BOE
                        </a>
                      )}
                      {/* Botón expandir relacionadas */}
                      {tieneRelacionadas && (
                        <button
                          onClick={() => toggleExpanded(conv.id)}
                          className="text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white flex items-center transition-colors"
                        >
                          <svg
                            className={`mr-1 h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                          {isExpanded ? 'Ocultar' : 'Ver'} actualizaciones
                        </button>
                      )}
                    </div>
                    <span className="text-xs text-gray-400 dark:text-gray-500">
                      {conv.boe_id}
                    </span>
                  </div>
                </div>

                {/* Cajón de publicaciones relacionadas */}
                {tieneRelacionadas && isExpanded && (
                  <div className="border-t border-green-200 dark:border-green-700/50 bg-gray-50 dark:bg-gray-800/50 px-4 py-3">
                    <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                      Publicaciones relacionadas ({relacionadas.length})
                    </h4>
                    <div className="space-y-0">
                      {relacionadas.map((pub) => (
                        <PublicacionRelacionadaItem
                          key={pub.id}
                          pub={pub}
                          onBoeClick={handleBoeClick}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </article>
        );
      })}

      {/* Toast de feedback */}
      {showToast && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 animate-slide-up">
          <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 rounded-lg shadow-lg">
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <span className="text-sm font-medium">Abriendo BOE...</span>
          </div>
        </div>
      )}
    </div>
  );
}
