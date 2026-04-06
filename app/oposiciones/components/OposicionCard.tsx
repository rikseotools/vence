// app/oposiciones/components/OposicionCard.tsx
// Card de una oposición para el directorio /oposiciones
import Link from 'next/link'

interface OposicionCardProps {
  slug: string
  nombre: string
  plazasLibres: number | null
  plazasDiscapacidad: number | null
  estadoProceso: string | null
  isConvocatoriaActiva: boolean
  examDate: string | null
  inscriptionDeadline: string | null
  subgrupo: string | null
}

const ESTADO_LABELS: Record<string, { label: string; color: string }> = {
  sin_oep: { label: 'Pendiente OEP', color: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300' },
  oep_aprobada: { label: 'OEP Aprobada', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' },
  convocada: { label: 'Convocada', color: 'bg-indigo-100 text-indigo-800' },
  inscripcion_abierta: { label: 'Inscripción Abierta', color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 animate-pulse' },
  inscripcion_cerrada: { label: 'Inscripción Cerrada', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' },
  lista_admitidos: { label: 'Listas Admitidos', color: 'bg-orange-100 text-orange-800' },
  pendiente_examen: { label: 'Pendiente Examen', color: 'bg-purple-100 text-purple-800' },
  examen_realizado: { label: 'Examen Realizado', color: 'bg-pink-100 text-pink-800' },
  resultados: { label: 'Resultados', color: 'bg-teal-100 text-teal-800' },
  nombramientos: { label: 'Nombramientos', color: 'bg-gray-100 text-gray-600' },
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return ''
  try {
    return new Date(dateStr).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })
  } catch { return '' }
}

export default function OposicionCard(props: OposicionCardProps) {
  const estado = ESTADO_LABELS[props.estadoProceso ?? ''] ?? ESTADO_LABELS.sin_oep
  const totalPlazas = (props.plazasLibres ?? 0) + (props.plazasDiscapacidad ?? 0)
  const isUrgent = props.estadoProceso === 'inscripcion_abierta'

  return (
    <Link
      href={`/${props.slug}`}
      className={`block bg-white dark:bg-gray-800 border rounded-xl p-5 hover:shadow-lg transition-shadow ${
        isUrgent ? 'border-green-400 ring-1 ring-green-200' : 'border-gray-200 dark:border-gray-700'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900 dark:text-white text-base leading-tight">
            {props.nombre}
          </h3>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${estado.color}`}>
              {estado.label}
            </span>
            {props.subgrupo && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300 font-medium">
                {props.subgrupo}
              </span>
            )}
          </div>
        </div>

        {totalPlazas > 0 && (
          <div className="text-right flex-shrink-0">
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{totalPlazas}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">plazas</div>
          </div>
        )}
      </div>

      <div className="mt-3 flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
        {props.inscriptionDeadline && props.estadoProceso === 'inscripcion_abierta' && (
          <span className="text-green-700 dark:text-green-400 font-medium">
            Inscripción hasta {formatDate(props.inscriptionDeadline)}
          </span>
        )}
        {props.examDate && (
          <span>Examen: {formatDate(props.examDate)}</span>
        )}
        {!props.examDate && !props.inscriptionDeadline && props.estadoProceso === 'oep_aprobada' && (
          <span>Pendiente de convocatoria</span>
        )}
      </div>

      <div className="mt-3 text-sm text-blue-600 dark:text-blue-400 font-medium">
        Ver temario, tests y detalles →
      </div>
    </Link>
  )
}
