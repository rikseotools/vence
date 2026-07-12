'use client'
// hooks/usePremiumGate.ts — GUARD CENTRAL del gating premium (cliente).
//
// Uso ergonómico (envolver el onClick/onChange de un control premium):
//   const { gate, activeFeature, activeContext, closeGate, isPremium } = usePremiumGate()
//   ...
//   <button onClick={() => gate('exclude_recent', () => setExcludeRecent(true), 'test_configurator')}>…</button>
//   {activeFeature && <PremiumFeatureModal feature={activeFeature} context={activeContext} onClose={closeGate} />}
//
// - Si el usuario es premium → ejecuta `onAllowed` (deja pasar).
// - Si es free → NO ejecuta, abre el modal (setActiveFeature) y emite `premium_gate_shown{feature}`.
// - Id desconocido en el registro → FAIL-OPEN (deja pasar): un typo NUNCA bloquea a un usuario.
//
// Solo mide/decide en cliente. Las features que CUESTAN o sirven contenido (cursos, temas,
// IA) DEBEN además validarse en su API con isPremiumPlan() — este hook es la capa de UX.
import { useCallback, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { getPremiumFeature, type PremiumFeature } from '@/lib/premium/features'
import {
  trackPremiumGateShown,
  trackPremiumGateDismiss,
} from '@/lib/services/conversionTracker'

interface ActiveGate {
  feature: PremiumFeature
  context?: string
}

export function usePremiumGate() {
  const { user, isPremium } = useAuth() as { user: { id: string } | null; isPremium: boolean }
  const [active, setActive] = useState<ActiveGate | null>(null)

  /**
   * Intercepta una acción premium.
   * @returns `true` si se dejó pasar (premium o id desconocido), `false` si se abrió el gate.
   */
  const gate = useCallback(
    (featureId: string, onAllowed?: () => void, context?: string): boolean => {
      if (isPremium) {
        onAllowed?.()
        return true
      }
      const feature = getPremiumFeature(featureId)
      if (!feature) {
        // Id no registrado → no bloquear (fail-open). Aviso en dev para cazar typos.
        if (process.env.NODE_ENV !== 'production') {
          console.warn(`[usePremiumGate] feature desconocida "${featureId}" → fail-open (no gateada)`)
        }
        onAllowed?.()
        return true
      }
      setActive({ feature, context })
      if (user?.id) {
        void trackPremiumGateShown(user.id, { feature: feature.id, kind: feature.kind, context })
      }
      return false
    },
    [isPremium, user?.id],
  )

  const closeGate = useCallback(() => {
    if (active && user?.id) {
      void trackPremiumGateDismiss(user.id, { feature: active.feature.id, kind: active.feature.kind, context: active.context })
    }
    setActive(null)
  }, [active, user?.id])

  return {
    /** Interceptor: gate(featureId, onAllowed?, context?) → bool (dejó pasar). */
    gate,
    /** Feature actualmente gateada (para renderizar el modal) o null. */
    activeFeature: active?.feature ?? null,
    /** Contexto de dónde se disparó (para el modal + analítica). */
    activeContext: active?.context,
    /** Cierra el modal (emite dismiss). */
    closeGate,
    isPremium,
  }
}
