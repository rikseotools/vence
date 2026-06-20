'use client'
// app/oposiciones/components/CatalogadaCard.tsx
//
// Card de una convocatoria CATALOGADA (sin test todavía en Vence) en la página
// /oposiciones/inscripcion-abierta. Enlaza a la convocatoria OFICIAL (seguimiento_url),
// nunca a una landing interna inexistente.
//
// Es 'use client' SOLO para medir el clic: antes este clic era ciego. Emite
// 'catalogada_inscription_clicked' con el slug (señal de demanda: qué catalogada
// interesa de verdad → qué construir después) y flush con beacon para no perderlo en
// la navegación externa. NO se mide impresión por-card (la página lista N catalogadas;
// un evento por card en cada carga sería ruido — el clic es la señal con intención).

import { emitClientEvent, flushClientObservability } from '@/lib/observability/client'

interface CatalogadaCardProps {
  slug: string
  nombre: string
  plazasLibres: number | null
  inscriptionDeadline: string | null
  seguimientoUrl: string | null
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return ''
  try {
    return new Date(dateStr).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })
  } catch {
    return ''
  }
}

export default function CatalogadaCard(props: CatalogadaCardProps) {
  return (
    <a
      href={props.seguimientoUrl ?? '#'}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => {
        emitClientEvent({
          severity: 'info',
          eventType: 'catalogada_inscription_clicked',
          metadata: { slug: props.slug },
        })
        flushClientObservability(true)
      }}
      className="block bg-white dark:bg-gray-800 border border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-5 hover:shadow-lg transition-shadow"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900 dark:text-white text-base leading-tight">{props.nombre}</h3>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 animate-pulse">
              Inscripción Abierta
            </span>
            <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300">
              Sin test todavía
            </span>
          </div>
        </div>
        {(props.plazasLibres ?? 0) > 0 && (
          <div className="text-right flex-shrink-0">
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{props.plazasLibres}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">plazas</div>
          </div>
        )}
      </div>
      {props.inscriptionDeadline && (
        <div className="mt-3 text-xs text-green-700 dark:text-green-400 font-medium">
          Inscripción hasta {formatDate(props.inscriptionDeadline)}
        </div>
      )}
      <div className="mt-3 text-sm text-blue-600 dark:text-blue-400 font-medium">
        Ver convocatoria oficial →
      </div>
    </a>
  )
}
