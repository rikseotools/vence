// Clasificación robusta "en blanco" vs "fallo real" para la vista de fallos.
//
// FUENTE DE VERDAD: `user_answer` vacío = en blanco. NO usamos la columna
// `was_blank` porque no se setea de forma fiable (en exámenes abandonados
// —is_completed=false— las preguntas sin contestar quedan con was_blank=false).
// El mismo criterio que ya usa el repaso de examen (ExamReviewLayout: `!userAnswer`).
//
// Las blancas SIGUEN contando como fallo para el motor de áreas débiles (se
// resurfacean igual); esto solo permite ETIQUETARLAS aparte para que el opositor
// distinga lo que falló de lo que no llegó a contestar.

/** ¿La respuesta del usuario quedó en blanco (sin contestar)? */
export function isBlankAnswer(userAnswer: string | null | undefined): boolean {
  return userAnswer == null || String(userAnswer).trim() === ''
}

export interface FailedBreakdown {
  /** Veces que el usuario contestó y falló (fallo real). */
  wrongCount: number
  /** Veces que la dejó en blanco. */
  blankCount: number
  /** true si NUNCA la contestó: todas las apariciones fueron en blanco. */
  onlyBlank: boolean
}

/**
 * Acumula una aparición fallada (is_correct=false) en un desglose por pregunta.
 * Reutilizable por la query principal y la de por-tema → un solo criterio.
 */
export function accumulateFailure(prev: FailedBreakdown, userAnswer: string | null | undefined): FailedBreakdown {
  const blank = isBlankAnswer(userAnswer)
  const wrongCount = prev.wrongCount + (blank ? 0 : 1)
  const blankCount = prev.blankCount + (blank ? 1 : 0)
  return { wrongCount, blankCount, onlyBlank: wrongCount === 0 }
}

export const EMPTY_BREAKDOWN: FailedBreakdown = { wrongCount: 0, blankCount: 0, onlyBlank: true }
