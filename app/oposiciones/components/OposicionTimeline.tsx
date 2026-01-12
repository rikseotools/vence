'use client';

/**
 * Timeline de publicaciones de una oposición
 * Agrupa por año/convocatoria y muestra cajones expandibles
 */

import Link from 'next/link';
import { useState } from 'react';

interface Publicacion {
  id: string;
  boe_id: string;
  boe_fecha: string;
  titulo: string;
  titulo_limpio: string | null;
  tipo: string | null;
  categoria: string | null;
  num_plazas: number | null;
  departamento_nombre: string | null;
  boe_url_pdf: string | null;
  boe_url_html: string | null;
  resumen: string | null;
  fecha_limite_inscripcion: string | null;
  acceso: string | null;
}

interface Props {
  publicaciones: Publicacion[];
  oposicionSlug: string;
}

const TIPO_INFO: Record<string, { icon: string; label: string; color: string }> = {
  convocatoria: { icon: '📢', label: 'Convocatoria', color: 'green' },
  admitidos: { icon: '📋', label: 'Admitidos', color: 'blue' },
  tribunal: { icon: '⚖️', label: 'Tribunal', color: 'purple' },
  resultado: { icon: '🏆', label: 'Resultado', color: 'yellow' },
  correccion: { icon: '✏️', label: 'Corrección', color: 'orange' },
  otro: { icon: '📄', label: 'Otro', color: 'gray' },
};

// Agrupar publicaciones por año
function agruparPorAno(publicaciones: Publicacion[]) {
  const grupos: Record<string, {
    ano: string;
    convocatoria: Publicacion | null;
    relacionadas: Publicacion[];
  }> = {};

  // Primero identificar convocatorias
  publicaciones.forEach(pub => {
    const ano = pub.boe_fecha.substring(0, 4);

    if (!grupos[ano]) {
      grupos[ano] = { ano, convocatoria: null, relacionadas: [] };
    }

    if (pub.tipo === 'convocatoria') {
      // Si ya hay una convocatoria, quedarse con la más reciente
      if (!grupos[ano].convocatoria || pub.boe_fecha > grupos[ano].convocatoria!.boe_fecha) {
        if (grupos[ano].convocatoria) {
          grupos[ano].relacionadas.push(grupos[ano].convocatoria!);
        }
        grupos[ano].convocatoria = pub;
      } else {
        grupos[ano].relacionadas.push(pub);
      }
    } else {
      grupos[ano].relacionadas.push(pub);
    }
  });

  // Ordenar relacionadas por fecha descendente
  Object.values(grupos).forEach(grupo => {
    grupo.relacionadas.sort((a, b) => b.boe_fecha.localeCompare(a.boe_fecha));
  });

  // Convertir a array y ordenar por año descendente
  return Object.values(grupos).sort((a, b) => parseInt(b.ano) - parseInt(a.ano));
}

export default function OposicionTimeline({ publicaciones, oposicionSlug }: Props) {
  const grupos = agruparPorAno(publicaciones);
  const hoy = new Date().toISOString().split('T')[0];

  // Encontrar convocatoria activa (con inscripción abierta)
  const convocatoriaActiva = publicaciones.find(
    p => p.tipo === 'convocatoria' && p.fecha_limite_inscripcion && p.fecha_limite_inscripcion >= hoy
  );

  // Estado para cajones abiertos (el primero abierto por defecto)
  const [abiertos, setAbiertos] = useState<Set<string>>(new Set([grupos[0]?.ano]));

  const toggleAno = (ano: string) => {
    const nuevos = new Set(abiertos);
    if (nuevos.has(ano)) {
      nuevos.delete(ano);
    } else {
      nuevos.add(ano);
    }
    setAbiertos(nuevos);
  };

  return (
    <div className="space-y-6">
      {/* Convocatoria activa destacada */}
      {convocatoriaActiva && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <span className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></span>
            Convocatoria con inscripción abierta
          </h2>
          <ConvocatoriaActiva convocatoria={convocatoriaActiva} />
        </div>
      )}

      {/* Timeline por años */}
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        Historial de publicaciones
      </h2>

      {grupos.length === 0 ? (
        <div className="text-center py-8 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <p className="text-gray-500 dark:text-gray-400">No hay publicaciones para esta oposición.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {grupos.map(({ ano, convocatoria, relacionadas }) => {
            const isAbierto = abiertos.has(ano);
            const totalPubs = (convocatoria ? 1 : 0) + relacionadas.length;

            return (
              <div
                key={ano}
                className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden"
              >
                {/* Header del cajón */}
                <button
                  onClick={() => toggleAno(ano)}
                  className="w-full flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors text-left"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl font-bold text-gray-900 dark:text-white">{ano}</span>
                    {convocatoria && (
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">
                          Convocatoria
                        </span>
                        {convocatoria.num_plazas && (
                          <span className="text-sm text-gray-500 dark:text-gray-400">
                            {convocatoria.num_plazas} plazas
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      {totalPubs} {totalPubs === 1 ? 'publicación' : 'publicaciones'}
                    </span>
                    <svg
                      className={`w-5 h-5 text-gray-400 transform transition-transform ${isAbierto ? 'rotate-180' : ''}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </button>

                {/* Contenido del cajón */}
                {isAbierto && (
                  <div className="border-t border-gray-200 dark:border-gray-700 p-4 space-y-3">
                    {/* Convocatoria principal */}
                    {convocatoria && (
                      <PublicacionCard publicacion={convocatoria} destacada />
                    )}

                    {/* Otras publicaciones */}
                    {relacionadas.map(pub => (
                      <PublicacionCard key={pub.id} publicacion={pub} />
                    ))}

                    {!convocatoria && relacionadas.length === 0 && (
                      <p className="text-gray-500 dark:text-gray-400 text-sm py-4 text-center">
                        Sin publicaciones este año
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* CTA para practicar */}
      <div className="mt-12 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl p-6 text-center">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          ¿Preparando esta oposición?
        </h3>
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          Practica con tests de exámenes oficiales y prepárate para aprobar
        </p>
        <Link
          href={`/${oposicionSlug}/test`}
          className="inline-flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
        >
          Empezar a practicar →
        </Link>
      </div>
    </div>
  );
}

function ConvocatoriaActiva({ convocatoria }: { convocatoria: Publicacion }) {
  const hoy = new Date().toISOString().split('T')[0];
  const diasRestantes = convocatoria.fecha_limite_inscripcion
    ? Math.ceil((new Date(convocatoria.fecha_limite_inscripcion).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
    : null;

  return (
    <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border-2 border-green-500 rounded-xl p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {convocatoria.titulo_limpio || convocatoria.titulo}
          </h3>
          {convocatoria.resumen && (
            <p className="mt-2 text-gray-600 dark:text-gray-400 text-sm">
              {convocatoria.resumen}
            </p>
          )}
          <div className="mt-3 flex flex-wrap gap-4 text-sm">
            <span className="text-gray-500 dark:text-gray-400">
              📅 BOE: {new Date(convocatoria.boe_fecha).toLocaleDateString('es-ES')}
            </span>
            {convocatoria.fecha_limite_inscripcion && (
              <span className={`font-medium ${diasRestantes && diasRestantes <= 5 ? 'text-orange-600' : 'text-green-600'} dark:text-green-400`}>
                ⏰ Límite: {new Date(convocatoria.fecha_limite_inscripcion).toLocaleDateString('es-ES')}
                {diasRestantes !== null && ` (${diasRestantes} días)`}
              </span>
            )}
          </div>
        </div>
        {convocatoria.num_plazas && (
          <div className="text-center bg-white dark:bg-gray-800 rounded-lg px-4 py-2">
            <span className="text-3xl font-bold text-green-600 dark:text-green-400">
              {convocatoria.num_plazas}
            </span>
            <p className="text-sm text-green-600 dark:text-green-400">plazas</p>
          </div>
        )}
      </div>
      <div className="mt-4 flex flex-wrap gap-3">
        {convocatoria.boe_url_pdf && (
          <a
            href={convocatoria.boe_url_pdf}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
          >
            📄 Descargar convocatoria (PDF)
          </a>
        )}
        {convocatoria.boe_url_html && (
          <a
            href={convocatoria.boe_url_html}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors text-sm"
          >
            🔗 Ver en BOE
          </a>
        )}
      </div>
    </div>
  );
}

function PublicacionCard({ publicacion, destacada = false }: { publicacion: Publicacion; destacada?: boolean }) {
  const info = TIPO_INFO[publicacion.tipo || 'otro'] || TIPO_INFO.otro;

  return (
    <div className={`flex items-start gap-4 p-3 rounded-lg ${
      destacada
        ? 'bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800'
        : 'bg-gray-50 dark:bg-gray-700/30'
    }`}>
      <span className="text-2xl flex-shrink-0">{info.icon}</span>
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2 mb-1">
          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-${info.color}-100 dark:bg-${info.color}-900/30 text-${info.color}-700 dark:text-${info.color}-300`}>
            {info.label}
          </span>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {new Date(publicacion.boe_fecha).toLocaleDateString('es-ES', {
              day: 'numeric',
              month: 'short',
              year: 'numeric'
            })}
          </span>
          {publicacion.num_plazas && destacada && (
            <span className="text-xs font-medium text-green-600 dark:text-green-400">
              {publicacion.num_plazas} plazas
            </span>
          )}
        </div>
        <p className="text-sm text-gray-900 dark:text-white line-clamp-2">
          {publicacion.titulo_limpio || publicacion.titulo}
        </p>
        <div className="mt-2 flex flex-wrap gap-3">
          {publicacion.boe_url_pdf && (
            <a
              href={publicacion.boe_url_pdf}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
            >
              📄 PDF
            </a>
          )}
          {publicacion.boe_url_html && (
            <a
              href={publicacion.boe_url_html}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-gray-600 dark:text-gray-400 hover:underline"
            >
              Ver en BOE
            </a>
          )}
          <span className="text-xs text-gray-400">{publicacion.boe_id}</span>
        </div>
      </div>
    </div>
  );
}
