// lib/test/practiceResultBreakdown.ts
//
// Desglose de un test de PRÁCTICA en correctas / incorrectas / en blanco.
// PURO → testeable y sin depender del render.
//
// POR QUÉ EXISTE (feedback Pablo 13/07): en práctica un blanco se guarda con
// `is_correct=false` A PROPÓSITO — significa "no lo sé" y alimenta debilidades /
// adaptativo. Pero la pantalla de fin solo mostraba "score/total" y "% aciertos",
// así que el usuario percibía que sus blancos "contaban como fallo". No es un error
// de cálculo (en examen el blanco es neutro y ya se muestra aparte; en la revisión
// también se separa) sino de TRANSPARENCIA. Este helper deriva el contador "en
// blanco" para mostrarlo también al terminar un test de práctica.
//
// Convención (ver TestLayout): un blanco se registra en answeredQuestions con
// `selectedAnswer === -1`. Una incorrecta real tiene `selectedAnswer !== -1` y
// `correct === false`. Una correcta tiene `correct === true`.

export interface PracticeResultBreakdown {
  correct: number
  incorrect: number
  blank: number
  answered: number // respondidas de verdad (correctas + incorrectas, SIN blancos)
}

interface AnswerLike {
  selectedAnswer: number
  correct: boolean
}

/** Marca de "dejada en blanco" en answeredQuestions (selectedAnswer sentinela). */
export const BLANK_SELECTED_ANSWER = -1

/**
 * Desglosa las respuestas de un test de práctica. NO cuenta un blanco como
 * incorrecta: el blanco va a su propia categoría (paridad con examen/revisión).
 */
export function summarizePracticeResults(entries: readonly AnswerLike[]): PracticeResultBreakdown {
  let correct = 0
  let incorrect = 0
  let blank = 0
  for (const e of entries) {
    if (e.selectedAnswer === BLANK_SELECTED_ANSWER) blank++
    else if (e.correct) correct++
    else incorrect++
  }
  return { correct, incorrect, blank, answered: correct + incorrect }
}
