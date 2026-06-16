// Helpers puros del selector de nº de preguntas de los configuradores de test.
// Presets 10/25/50/100 + cantidad PERSONALIZADA (ej. 70 para simular el examen
// real). Compartido entre `components/TestConfigurator.tsx` (configurador de un
// tema) y `components/test/RandomTestClient.tsx` (test aleatorio multi-tema), para
// que el campo "O personalizado" funcione igual en ambas pantallas.
//
// Vive en lib/ (y no en TestConfigurator) para que RandomTestClient pueda
// reutilizar los helpers sin arrastrar el bundle de TestConfigurator (~3000 líneas).
// Caso real: feedback de Laura (CARM, examen 21/06) — pedía un test de 70 preguntas
// del tirón y en el test aleatorio solo había presets fijos.

/** Tamaños preset ofrecidos como botones. Fuente única de verdad. */
export const QUESTION_COUNT_PRESETS = [10, 25, 50, 100] as const

/**
 * Tope del nº personalizado en cliente. El backend acepta hasta 500
 * (`lib/api/filtered-questions/schemas.ts`) pero >100 satura Supabase, así que
 * limitamos a 100 y, si hay menos preguntas disponibles, a esas.
 */
export function customQuestionCap(availableQuestions: number): number {
  const HARD_CAP = 100
  if (!Number.isFinite(availableQuestions) || availableQuestions <= 0) return HARD_CAP
  return Math.min(HARD_CAP, Math.floor(availableQuestions))
}

/** ¿El valor actual NO es un preset? → el input personalizado está "activo". */
export function isCustomQuestionCount(selected: number): boolean {
  return !(QUESTION_COUNT_PRESETS as readonly number[]).includes(selected)
}

/**
 * Sanea lo que el usuario teclea en el input personalizado. Devuelve el valor
 * dentro de [1, cap], o `null` si no es un número usable (para que el caller
 * ignore el cambio y no rompa el estado).
 */
export function clampCustomQuestionCount(raw: number, availableQuestions: number): number | null {
  if (!Number.isFinite(raw)) return null
  const cap = customQuestionCap(availableQuestions)
  return Math.max(1, Math.min(Math.floor(raw), cap))
}
