// lib/api/challengeBridge.ts
//
// Puente entre el mundo "plain fetch" (fetchWithChallenge, sin React) y el
// mundo React (ChallengeProvider, que monta el modal con el widget).
//
// El provider registra aquí su `solver`; el wrapper de fetch lo invoca cuando
// el servidor responde "challenge required". Así el wrapper no depende de React
// y cualquier llamada fetch del app puede resolver retos de forma transparente.

export type ChallengeSolver = (action?: string) => Promise<string>

let _solver: ChallengeSolver | null = null

/** Lo llama ChallengeProvider al montar. Devuelve un unregister. */
export function registerChallengeSolver(solver: ChallengeSolver): () => void {
  _solver = solver
  return () => {
    if (_solver === solver) _solver = null
  }
}

/**
 * Pide un token humano mostrando el modal. Rechaza si no hay provider montado
 * (el caller debe degradar: típicamente reintentar más tarde o mostrar error).
 */
export function solveChallenge(action?: string): Promise<string> {
  if (!_solver) {
    return Promise.reject(
      new Error(
        'No hay ChallengeProvider montado: no se puede resolver el reto humano.',
      ),
    )
  }
  return _solver(action)
}

/** ¿Hay un provider capaz de resolver retos ahora mismo? */
export function canSolveChallenge(): boolean {
  return _solver !== null
}
