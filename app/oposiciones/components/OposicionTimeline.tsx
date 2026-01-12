'use client';

/**
 * Timeline de publicaciones de una oposición
 * Agrupa por PROCESO SELECTIVO (convocatoria), no por año de publicación
 */

import Link from 'next/link';
import { useState, useMemo } from 'react';

interface Publicacion {
  id: string;
  boe_id: string;
  boe_fecha: string;
  fecha_disposicion: string | null;
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

interface ProcesoSelectivo {
  id: string; // Fecha de la convocatoria como identificador
  convocatoria: Publicacion | null;
  relacionadas: Publicacion[];
  fechaConvocatoria: string;
  plazas: number | null;
}

const TIPO_INFO: Record<string, { icon: string; label: string; color: string }> = {
  convocatoria: { icon: '📢', label: 'Convocatoria', color: 'green' },
  admitidos: { icon: '📋', label: 'Admitidos', color: 'blue' },
  tribunal: { icon: '⚖️', label: 'Tribunal', color: 'purple' },
  resultado: { icon: '🏆', label: 'Resultado', color: 'yellow' },
  correccion: { icon: '✏️', label: 'Corrección', color: 'orange' },
  otro: { icon: '📄', label: 'Otro', color: 'gray' },
};

const MESES_MAP: Record<string, number> = {
  'enero': 1, 'febrero': 2, 'marzo': 3, 'abril': 4,
  'mayo': 5, 'junio': 6, 'julio': 7, 'agosto': 8,
  'septiembre': 9, 'octubre': 10, 'noviembre': 11, 'diciembre': 12
};

/**
 * Extrae la fecha de la convocatoria original referenciada en el título
 */
function extraerFechaConvocatoriaOrigen(titulo: string): string | null {
  const patrones = [
    /convocad[ao]s?\s+(?:por\s+)?(?:la\s+)?(?:Resolución|Orden|Real Decreto)\s+de\s+(\d{1,2})\s+de\s+(\w+)\s+de\s+(\d{4})/i,
    /proceso\s+selectivo\s+convocado\s+(?:por\s+)?(?:la\s+)?(?:Resolución|Orden)\s+de\s+(\d{1,2})\s+de\s+(\w+)\s+de\s+(\d{4})/i,
    /pruebas\s+selectivas\s+convocadas?\s+(?:por\s+)?(?:la\s+)?(?:Resolución|Orden)\s+de\s+(\d{1,2})\s+de\s+(\w+)\s+de\s+(\d{4})/i,
  ];

  for (const patron of patrones) {
    const match = titulo.match(patron);
    if (match) {
      const dia = match[1].padStart(2, '0');
      const mesNombre = match[2].toLowerCase();
      const ano = match[3];
      const mes = MESES_MAP[mesNombre];

      if (mes) {
        return `${ano}-${String(mes).padStart(2, '0')}-${dia}`;
      }
    }
  }

  return null;
}

/**
 * Agrupa publicaciones por proceso selectivo (convocatoria)
 *
 * IMPORTANTE: Las convocatorias se identifican por su fecha_disposicion (fecha de la resolución),
 * que es lo que otras publicaciones (admitidos, resultado) referencian en sus títulos.
 * Por ejemplo: "Convocatoria de 23 de diciembre de 2024" → fecha_disposicion = 2024-12-23
 */
function agruparPorProcesoSelectivo(publicaciones: Publicacion[]): ProcesoSelectivo[] {
  const procesos: Map<string, ProcesoSelectivo> = new Map();

  // Paso 1: Identificar todas las convocatorias (definen procesos)
  // Usamos fecha_disposicion como clave (es la fecha que referencian otras publicaciones)
  publicaciones
    .filter(p => p.tipo === 'convocatoria')
    .forEach(conv => {
      // Preferir fecha_disposicion (la fecha de la resolución que se referencia)
      // Fallback a boe_fecha si no hay fecha_disposicion
      const fechaClave = conv.fecha_disposicion || conv.boe_fecha;

      procesos.set(fechaClave, {
        id: fechaClave,
        convocatoria: conv,
        relacionadas: [],
        fechaConvocatoria: fechaClave,
        plazas: conv.num_plazas,
      });
    });

  // Paso 2: Asignar otras publicaciones a su convocatoria de origen
  publicaciones
    .filter(p => p.tipo !== 'convocatoria')
    .forEach(pub => {
      const fechaRef = extraerFechaConvocatoriaOrigen(pub.titulo);

      if (fechaRef) {
        // Buscar proceso con esa fecha exacta
        let procesoEncontrado: ProcesoSelectivo | undefined;

        if (procesos.has(fechaRef)) {
          procesoEncontrado = procesos.get(fechaRef);
        } else {
          // Si no hay proceso con esa fecha exacta, crear uno huérfano
          // (falta la convocatoria original en la BD)
          procesoEncontrado = {
            id: fechaRef,
            convocatoria: null,
            relacionadas: [],
            fechaConvocatoria: fechaRef,
            plazas: null,
          };
          procesos.set(fechaRef, procesoEncontrado);
        }

        if (procesoEncontrado) {
          procesoEncontrado.relacionadas.push(pub);
        }
      } else {
        // Sin referencia detectada: agrupar por año como fallback
        const ano = pub.boe_fecha.substring(0, 4);
        const fallbackId = `${ano}-fallback`;

        if (!procesos.has(fallbackId)) {
          procesos.set(fallbackId, {
            id: fallbackId,
            convocatoria: null,
            relacionadas: [],
            fechaConvocatoria: `${ano}-01-01`,
            plazas: null,
          });
        }
        procesos.get(fallbackId)!.relacionadas.push(pub);
      }
    });

  // Ordenar relacionadas por fecha descendente
  procesos.forEach(proceso => {
    proceso.relacionadas.sort((a, b) => b.boe_fecha.localeCompare(a.boe_fecha));
  });

  // Convertir a array y ordenar por fecha de convocatoria descendente
  return Array.from(procesos.values())
    .filter(p => p.convocatoria || p.relacionadas.length > 0)
    .sort((a, b) => b.fechaConvocatoria.localeCompare(a.fechaConvocatoria));
}

/**
 * Formatea la fecha de convocatoria para mostrar
 */
function formatearFechaConvocatoria(fecha: string): string {
  if (fecha.endsWith('-fallback')) {
    return `Otras publicaciones ${fecha.split('-')[0]}`;
  }
  try {
    const d = new Date(fecha);
    return d.toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  } catch {
    return fecha;
  }
}

export default function OposicionTimeline({ publicaciones, oposicionSlug }: Props) {
  const procesos = useMemo(() => agruparPorProcesoSelectivo(publicaciones), [publicaciones]);
  const hoy = new Date().toISOString().split('T')[0];

  // Encontrar convocatoria activa (con inscripción abierta)
  const convocatoriaActiva = publicaciones.find(
    p => p.tipo === 'convocatoria' && p.fecha_limite_inscripcion && p.fecha_limite_inscripcion >= hoy
  );

  // Estado para cajones abiertos (el primero abierto por defecto)
  const [abiertos, setAbiertos] = useState<Set<string>>(new Set([procesos[0]?.id]));

  const toggleProceso = (id: string) => {
    const nuevos = new Set(abiertos);
    if (nuevos.has(id)) {
      nuevos.delete(id);
    } else {
      nuevos.add(id);
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

      {/* Timeline por proceso selectivo */}
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        Historial de procesos selectivos
      </h2>

      {procesos.length === 0 ? (
        <div className="text-center py-8 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <p className="text-gray-500 dark:text-gray-400">No hay publicaciones para esta oposición.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {procesos.map((proceso) => {
            const isAbierto = abiertos.has(proceso.id);
            const totalPubs = (proceso.convocatoria ? 1 : 0) + proceso.relacionadas.length;
            const esFallback = proceso.id.endsWith('-fallback');

            return (
              <div
                key={proceso.id}
                className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden"
              >
                {/* Header del cajón */}
                <button
                  onClick={() => toggleProceso(proceso.id)}
                  className="w-full flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors text-left"
                >
                  <div className="flex items-center gap-3">
                    <div>
                      <span className="text-lg font-bold text-gray-900 dark:text-white">
                        {esFallback ? proceso.id.split('-')[0] : `Convocatoria ${formatearFechaConvocatoria(proceso.fechaConvocatoria)}`}
                      </span>
                      {esFallback && (
                        <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">
                          (sin convocatoria identificada)
                        </span>
                      )}
                    </div>
                    {proceso.convocatoria && (
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">
                          ✓ Convocatoria
                        </span>
                        {proceso.plazas && (
                          <span className="text-sm text-gray-500 dark:text-gray-400">
                            {proceso.plazas} plazas
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
                    {proceso.convocatoria && (
                      <PublicacionCard publicacion={proceso.convocatoria} destacada />
                    )}

                    {/* Otras publicaciones */}
                    {proceso.relacionadas.map(pub => (
                      <PublicacionCard key={pub.id} publicacion={pub} />
                    ))}

                    {!proceso.convocatoria && proceso.relacionadas.length === 0 && (
                      <p className="text-gray-500 dark:text-gray-400 text-sm py-4 text-center">
                        Sin publicaciones
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
