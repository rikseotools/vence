// lib/premium/isPremiumPlan.ts — ¿este plan desbloquea premium? FUENTE ÚNICA server-side.
//
// Reexporta la verdad que ya vivía en lib/api/daily-limit/config.ts (PREMIUM_PLAN_TYPES)
// para que TODO el gating premium (preguntas, cursos, contenido editorial, features) mire
// el MISMO conjunto. Defensa en profundidad: ocultar un botón en el cliente NO basta para
// features que cuestan (IA) o sirven contenido (cursos/temas) — la API DEBE validar aquí.
import { PREMIUM_PLAN_TYPES } from '@/lib/api/daily-limit/config'

export { PREMIUM_PLAN_TYPES }

/**
 * `true` si el plan_type desbloquea premium. Case-insensitive y null-safe.
 * Usar en handlers de API antes de servir contenido/feature premium:
 *   if (!isPremiumPlan(profile.plan_type)) return gateResponse(...)
 */
export function isPremiumPlan(planType: string | null | undefined): boolean {
  if (!planType) return false
  const p = planType.toLowerCase().trim()
  return (PREMIUM_PLAN_TYPES as readonly string[]).includes(p)
}
