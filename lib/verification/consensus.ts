// lib/verification/consensus.ts
// Lógica PURA de consenso de la verificación de contenido (S1 scope / S2 epígrafe).
// Extraída para poder testearla sin BD ni agentes (capa unit). El runbook
// docs/runbooks/verificar-epigrafes-scope.md la describe:
//   - CORRECT/LITERAL solo si TODOS los agentes coinciden.
//   - Discrepancia → si hay 3er juez, mayoría; si no, el veredicto "problemático"
//     (conservador: fuerza revisión).

export type ScopeVerdict = 'CORRECT' | 'ISSUES'
export type EpigrafeVerdict = 'literal' | 'drift' | 'no_verificable'

/**
 * Consenso de scope (S1). Devuelve el verdict a persistir:
 * 'correct' | 'issues' | 'needs_human'.
 *
 * Regla clave (petición Manuel): solo hay veredicto automático cuando los dos
 * agentes independientes ACUERDAN. Cualquier DUDA (discrepancia) → 'needs_human'
 * para ALERTAR a un humano que decida — NO cae en 'issues' silencioso. El humano
 * es el árbitro, no un tercer agente.
 */
export function scopeConsensus(
  analyst: ScopeVerdict,
  skeptic: ScopeVerdict
): 'correct' | 'issues' | 'needs_human' {
  if (analyst === 'CORRECT' && skeptic === 'CORRECT') return 'correct'
  if (analyst === 'ISSUES' && skeptic === 'ISSUES') return 'issues'
  return 'needs_human' // discrepancia = duda → alerta humano
}

/**
 * Consenso de literalidad de epígrafe (S2). Si algún agente ve 'drift' → drift.
 * 'no_verificable' (boletín no parseable) no bloquea el literal de los demás,
 * pero si TODOS son no_verificable → 'no_verificable'.
 */
export function epigrafeConsensus(verdicts: EpigrafeVerdict[]): 'literal' | 'drift' | 'no_verificable' {
  if (verdicts.length === 0) return 'no_verificable'
  if (verdicts.some((v) => v === 'drift')) return 'drift'
  if (verdicts.every((v) => v === 'no_verificable')) return 'no_verificable'
  return 'literal'
}

/**
 * ¿Un tema está PENDIENTE de verificación de contenido? (alimenta el badge)
 * scopeState  = topic_scope_verification.state (o 'never_verified')
 * epiEffState = topic_epigrafe_verification_effective.effective_state (o 'never_sourced')
 */
export function isContentVerificationPending(
  scopeState: string | null | undefined,
  epiEffState: string | null | undefined
): boolean {
  const scope = scopeState ?? 'never_verified'
  const epi = epiEffState ?? 'never_sourced'
  const scopePending = ['never_verified', 'stale', 'verified_issues'].includes(scope)
  const epiPending = epi !== 'verified_literal'
  return scopePending || epiPending
}
