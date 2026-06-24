// components/temario/TopicMetricsInfoModal.tsx
// Modal informativo del temario: explica el % de acierto y las flechitas de
// tendencia (▲/▼) y, si el usuario tiene progreso, muestra un resumen con SUS
// datos reales en la oposición. Presentacional puro (props in, sin fetch) para
// poder testearlo con React Testing Library.
'use client'

import { useEffect } from 'react'
import type { TrendSummary } from '@/lib/utils/topicTrend'

interface TopicMetricsInfoModalProps {
  open: boolean
  onClose: () => void
  summary: TrendSummary | null
  /** Nombre de la oposición para personalizar el título (ej. "Administrativo CARM"). */
  oposicionName?: string
}

export default function TopicMetricsInfoModal({ open, onClose, summary, oposicionName }: TopicMetricsInfoModalProps) {
  // Cerrar con Escape (mismo patrón que OposicionChangeModal/ArticleModal).
  useEffect(() => {
    if (!open) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [open, onClose])

  if (!open) return null

  const hasData = summary != null && summary.temasPracticados > 0

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="topic-metrics-info-title"
        className="relative w-full max-w-md max-h-[85vh] overflow-y-auto bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 p-5 sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar"
          className="absolute top-3 right-3 sm:top-4 sm:right-4 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <h3 id="topic-metrics-info-title" className="text-lg font-bold text-gray-900 dark:text-white mb-4 pr-8">
          ¿Qué significan estos números?
        </h3>

        <div className="space-y-4 text-sm text-gray-700 dark:text-gray-300">
          <div>
            <div className="font-semibold text-gray-900 dark:text-white mb-1">El porcentaje (% de acierto)</div>
            <p>
              Es tu <span className="font-medium">porcentaje de acierto en ese tema</span>, calculado con las preguntas que ya has respondido. Sale en <span className="text-green-600 font-medium">verde</span> cuando dominas el tema (70% o más) y en <span className="text-amber-600 font-medium">ámbar</span> cuando aún te conviene repasarlo. Solo aparece en los temas que ya has practicado.
            </p>
          </div>
          <div>
            <div className="font-semibold text-gray-900 dark:text-white mb-1">Las flechitas ▲ / ▼</div>
            <p>
              Indican tu <span className="font-medium">tendencia de los últimos 30 días</span> comparada con tu media histórica: <span className="text-green-500 font-medium">▲ verde</span> si estás mejorando y <span className="text-red-500 font-medium">▼ roja</span> si has bajado un poco. Si prefieres no verlas, puedes ocultarlas desde tu perfil; el porcentaje se sigue mostrando.
            </p>
          </div>

          {hasData ? (
            <div className="mt-2 p-4 rounded-xl bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700">
              <div className="font-semibold text-gray-900 dark:text-white mb-2">{oposicionName ? `Tus datos en ${oposicionName}` : 'Tus datos en esta oposición'}</div>
              <ul className="space-y-1.5">
                <li>📚 Temas practicados: <span className="font-semibold">{summary!.temasPracticados}</span> ({summary!.totalRespondidas} preguntas)</li>
                <li>🎯 Media de acierto: <span className={`font-semibold ${summary!.mediaAciertos >= 70 ? 'text-green-600' : 'text-amber-600'}`}>{summary!.mediaAciertos}%</span></li>
                {summary!.mejorTema && (
                  <li>🏆 Tu mejor tema: <span className="font-semibold">{summary!.mejorTema.titulo}</span> ({summary!.mejorTema.accuracy}%)</li>
                )}
                {summary!.temaReforzar && summary!.temasPracticados > 1 && (
                  <li>💪 A reforzar: <span className="font-semibold">{summary!.temaReforzar.titulo}</span> ({summary!.temaReforzar.accuracy}%)</li>
                )}
                {(summary!.tendencia.mejorando > 0 || summary!.tendencia.empeorando > 0) && (
                  <li>
                    📈 Últimos 30 días:{' '}
                    {summary!.tendencia.mejorando > 0 && (
                      <span className="text-green-500 font-semibold">▲ {summary!.tendencia.mejorando} mejorando</span>
                    )}
                    {summary!.tendencia.mejorando > 0 && summary!.tendencia.empeorando > 0 && ' · '}
                    {summary!.tendencia.empeorando > 0 && (
                      <span className="text-red-500 font-semibold">▼ {summary!.tendencia.empeorando} a repasar</span>
                    )}
                  </li>
                )}
              </ul>
            </div>
          ) : (
            <div className="mt-2 p-4 rounded-xl bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400">
              Aún no has practicado temas de {oposicionName || 'esta oposición'}. En cuanto respondas algunas preguntas, aquí verás tu progreso real.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
