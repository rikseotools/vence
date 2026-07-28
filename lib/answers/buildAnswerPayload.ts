// lib/answers/buildAnswerPayload.ts
//
// Construye el payload que el cliente manda a `/api/v2/answer-and-save` al responder una pregunta.
// PURO (sin React, sin red) para que el viaje de ida y vuelta de la corrección se pueda TESTEAR.
//
// Por qué existe (28/07/2026): esta construcción vivía incrustada dentro de `TestLayout.tsx`, entre
// mil líneas de estado y JSX, así que **nadie podía comprobarla**. Y por ahí viaja el dato del que
// depende que una respuesta se corrija bien: `optionOrder`, la permutación con la que el servidor
// sirvió las opciones. Si ese dato no llega, el servidor interpreta la posición MOSTRADA como si
// fuera la original y **marca fallo a quien acertó** (y al revés), en silencio.
//
// El día que se encendió el piloto de barajado se descubrió que `test_questions.option_order`
// estaba a NULL en el 100 % de las filas de la historia pese a que el servidor SÍ baraja
// (verificado ejecutando la función real de servir: 5 de 20 preguntas volvían permutadas). Con la
// lógica encerrada en el componente no había forma de afirmar dónde se perdía. Ahora sí.

/** Lo que el cliente necesita de la pregunta servida para construir el payload. */
export interface QuestionForPayload {
  id?: string | null
  question?: string | null
  question_text?: string | null
  options?: unknown[] | null
  option_a?: string | null
  option_b?: string | null
  option_c?: string | null
  option_d?: string | null
  option_e?: string | null
  /** Permutación con la que se sirvió (null/ausente = orden natural). NO puede perderse. */
  option_order?: number[] | null
  question_type?: string | null
  [k: string]: unknown
}

export interface BuildAnswerPayloadInput {
  question: QuestionForPayload
  /** Posición MOSTRADA elegida por el usuario (no el índice original). `null` si la dejó en blanco. */
  answerIndex: number | null
  isBlank: boolean
  sessionId: string | null
  questionIndex: number
  tema: number | null
}

export interface AnswerPayload {
  questionId: string | null
  userAnswer: number | null
  isBlank: boolean
  sessionId: string | null
  questionIndex: number
  questionText: string
  options: unknown[]
  optionOrder: number[] | null
  tema: number | null
  questionType: 'legislative' | 'psychometric'
}

/**
 * Una permutación válida es un array de enteros; cualquier otra cosa (undefined, null, `[]`,
 * basura serializada) significa "no se barajó" y viaja como `null`, que es lo que el servidor
 * entiende como orden natural. Se normaliza AQUÍ para que el servidor no tenga que adivinar.
 */
export function normalizeOptionOrder(raw: unknown): number[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null
  if (!raw.every((n) => typeof n === 'number' && Number.isInteger(n) && n >= 0)) return null
  return raw as number[]
}

/** Construye el payload de una respuesta. La permutación se preserva SIEMPRE que exista. */
export function buildAnswerPayload(input: BuildAnswerPayloadInput): AnswerPayload {
  const q = input.question
  const options =
    Array.isArray(q.options) && q.options.length > 0
      ? q.options
      : [q.option_a, q.option_b, q.option_c, q.option_d, q.option_e].filter(Boolean)

  return {
    questionId: q.id ?? null,
    // Feature "Dejar en blanco": userAnswer null cuando isBlank (el servidor lo valida con refine).
    userAnswer: input.isBlank ? null : input.answerIndex,
    isBlank: input.isBlank,
    sessionId: input.sessionId,
    questionIndex: input.questionIndex,
    questionText: (q.question_text || q.question || '') as string,
    options,
    // 🔀 EL DATO CRÍTICO: sin él, el servidor corrige la posición mostrada contra la clave
    // original. Nunca se debe reconstruir la pregunta perdiendo este campo.
    optionOrder: normalizeOptionOrder(q.option_order),
    tema: input.tema,
    questionType: q.question_type === 'psychometric' ? 'psychometric' : 'legislative',
  }
}
