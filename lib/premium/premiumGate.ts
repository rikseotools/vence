// lib/premium/premiumGate.ts
//
// Clasificador PURO de la respuesta de una acción premium gateada en SERVIDOR.
//
// Principio (fix bug Iván 24/07/2026, feedback 23d38071): el gate lo decide el
// SERVIDOR en el momento de la acción, no un `isPremium` cacheado en el cliente que
// puede ir obsoleto (p.ej. justo tras pagar). El `plan_type` del AuthContext es una
// PISTA COSMÉTICA (la corona 👑), nunca un bloqueo funcional. Así, un usuario que el
// servidor tiene por premium NUNCA puede ver el muro "hazte premium", aunque su cliente
// aún crea que es free.
//
// Esta función traduce (httpStatus, lo-que-creía-el-cliente) → decisión + señales de
// desincronía, para que el componente actúe (descargar / abrir modal) y RECONCILIE el
// estado del cliente (dispara `profileUpdated`) sin polls ni heurísticos temporales.

export type PremiumGateOutcome = 'allowed' | 'blocked' | 'too_large' | 'error'

export interface PremiumGateDecision {
  outcome: PremiumGateOutcome
  // El servidor AUTORIZÓ (200) pero el cliente creía que era free → estaba obsoleto:
  // hay que reconciliar hacia premium (el caso de Iván).
  staleRecovered: boolean
  // El servidor BLOQUEÓ (403) pero el cliente creía premium → obsoleto al revés
  // (p.ej. suscripción vencida) → reconciliar hacia free.
  staleBlocked: boolean
}

/**
 * @param httpStatus         status HTTP de la acción premium (endpoint autoritativo).
 * @param clientThoughtPremium  lo que el cliente creía ANTES de la acción (isPremium).
 */
export function classifyPremiumGateResponse(
  httpStatus: number,
  clientThoughtPremium: boolean,
): PremiumGateDecision {
  if (httpStatus === 403) {
    return { outcome: 'blocked', staleRecovered: false, staleBlocked: clientThoughtPremium }
  }
  if (httpStatus === 413) {
    return { outcome: 'too_large', staleRecovered: false, staleBlocked: false }
  }
  if (httpStatus >= 200 && httpStatus < 300) {
    return { outcome: 'allowed', staleRecovered: !clientThoughtPremium, staleBlocked: false }
  }
  return { outcome: 'error', staleRecovered: false, staleBlocked: false }
}

/** ¿La decisión implica reconciliar el plan cacheado del cliente con el servidor? */
export function needsPlanReconciliation(d: PremiumGateDecision): boolean {
  return d.staleRecovered || d.staleBlocked
}
