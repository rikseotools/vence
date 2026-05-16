// components/test/SimulacroPaywallModal.tsx
//
// Modal Premium que se muestra cuando un usuario FREE intenta entrar al
// Simulacro de Examen. Bloquea el acceso (no permite "continuar gratis")
// para evitar que el usuario gaste su cuota diaria en un test que NO podrá
// completar (110 preguntas vs 25 diarias).
//
// Conversion-friendly:
//   - Explica el motivo del bloqueo con números concretos del simulacro.
//   - Trackea clicks ("paywall_simulacro_view" al abrirse, "paywall_simulacro_upgrade_click"
//     al pulsar Premium) para medir tasa de conversión de este punto.

'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { useInteractionTracker } from '@/hooks/useInteractionTracker'
import type { SimulacroPublicConfig } from '@/lib/api/simulacro/config'

interface Props {
  isOpen: boolean
  onClose: () => void
  /** Config del simulacro (totalQuestions, durationMinutes, shortBreakdown) */
  config: SimulacroPublicConfig
  /** Cuota diaria del usuario FREE (típicamente 25) */
  dailyLimit: number
  /** Slug de la oposición — usado para tracking */
  oposicionSlug: string
}

export default function SimulacroPaywallModal({
  isOpen,
  onClose,
  config,
  dailyLimit,
  oposicionSlug,
}: Props) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tracker = useInteractionTracker() as any
  const trackClick = tracker?.trackClick as
    | ((source: string, action: string, extra?: Record<string, unknown>) => void)
    | undefined

  // Trackear al abrirse el paywall (medimos exposiciones para tasa de
  // conversión: views vs upgrade_clicks).
  useEffect(() => {
    if (isOpen && trackClick) {
      trackClick('Simulacro', 'paywall_view', { oposicionSlug })
    }
  }, [isOpen, oposicionSlug, trackClick])

  if (!isOpen) return null

  const daysToComplete = Math.ceil(config.totalQuestions / Math.max(1, dailyLimit))

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="simulacro-paywall-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl max-w-md w-full shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-5 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-3xl">🏆</span>
              <div>
                <h2 id="simulacro-paywall-title" className="text-xl font-bold">
                  Simulacro de Examen
                </h2>
                <p className="text-sm opacity-90">Función Premium</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-white/80 hover:text-white text-2xl leading-none"
              aria-label="Cerrar"
            >
              ×
            </button>
          </div>
        </div>

        <div className="px-6 py-5 space-y-4">
          <p className="text-gray-800">
            Este simulacro tiene <strong>{config.totalQuestions} preguntas</strong> con el formato oficial
            ({config.shortBreakdown}) en <strong>{config.durationMinutes} minutos</strong> con cuenta atrás.
          </p>

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
            <p className="text-sm text-amber-900">
              <strong>Tu plan gratuito permite {dailyLimit} preguntas al día.</strong>{' '}
              Necesitarías unos {daysToComplete} días para completar un solo simulacro.
            </p>
          </div>

          <p className="text-gray-700 text-sm">
            Con <strong>Vence Premium</strong> puedes hacer simulacros completos sin
            límite, con cronómetro real, reanudación y feedback de ritmo.
          </p>

          <div className="flex flex-col sm:flex-row gap-2 pt-2">
            <Link
              href="/premium"
              onClick={() => {
                if (trackClick) {
                  trackClick('Simulacro', 'paywall_upgrade_click', { oposicionSlug })
                }
              }}
              className="flex-1 text-center bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-semibold py-3 px-4 rounded-lg shadow-md transition-all"
            >
              ⭐ Hazte Premium
            </Link>
            <button
              type="button"
              onClick={() => {
                if (trackClick) {
                  trackClick('Simulacro', 'paywall_dismiss', { oposicionSlug })
                }
                onClose()
              }}
              className="flex-1 text-center text-gray-600 hover:text-gray-800 py-3 px-4 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
            >
              Quizás más tarde
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
