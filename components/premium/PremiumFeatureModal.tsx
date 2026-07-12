// components/premium/PremiumFeatureModal.tsx
//
// Modal ÚNICO y genérico de "Función Premium" — parametrizado por una feature del
// registro (lib/premium/features.ts). Reemplaza tener un modal por feature: todo gate
// premium (UI toggles, cursos, temas editoriales) usa ESTE, con su copy del registro.
//
// Se renderiza a partir del estado de usePremiumGate():
//   const { activeFeature, activeContext, closeGate } = usePremiumGate()
//   {activeFeature && <PremiumFeatureModal feature={activeFeature} context={activeContext} onClose={closeGate} />}
//
// Observabilidad: `premium_gate_shown` ya lo emitió el hook al abrir; aquí se emite
// `premium_gate_cta_click` al pulsar "Hazte Premium" (embudo shown → cta → checkout).

'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import { trackPremiumGateCtaClick } from '@/lib/services/conversionTracker'
import type { PremiumFeature } from '@/lib/premium/features'

interface Props {
  feature: PremiumFeature
  context?: string
  onClose: () => void
}

export default function PremiumFeatureModal({ feature, context, onClose }: Props) {
  const { user } = useAuth() as { user: { id: string } | null }

  // Cerrar con ESC (accesibilidad).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const onCta = () => {
    if (user?.id) {
      void trackPremiumGateCtaClick(user.id, { feature: feature.id, kind: feature.kind, context })
    }
    // el <Link> navega; no cerramos aquí para que el tracking salga antes del unmount.
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="premium-feature-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white dark:bg-gray-800 shadow-2xl p-6 relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          aria-label="Cerrar"
          className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xl leading-none"
        >
          ✕
        </button>

        <div className="text-center">
          <div className="text-4xl mb-2">👑</div>
          <p className="text-xs font-bold uppercase tracking-wide text-amber-600 dark:text-amber-400 mb-1">
            Función Premium
          </p>
          <h2 id="premium-feature-title" className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-3">
            {feature.modalTitle}
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">{feature.modalBody}</p>

          <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg px-4 py-3 mb-5 text-left">
            <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">✓ {feature.benefit}</p>
            <p className="text-xs text-amber-700/80 dark:text-amber-300/80 mt-1">
              Con Premium: preguntas y chat IA ilimitados, todas las oposiciones y los cursos.
            </p>
          </div>

          <Link
            href={`/premium?feature=${encodeURIComponent(feature.id)}`}
            onClick={onCta}
            className="block w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg transition mb-2"
          >
            ⭐ Hazte Premium
          </Link>
          <button onClick={onClose} className="text-xs text-gray-500 dark:text-gray-400 hover:underline">
            Ahora no
          </button>
        </div>
      </div>
    </div>
  )
}
