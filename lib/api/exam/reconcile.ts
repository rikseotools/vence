// lib/api/exam/reconcile.ts
//
// Lógica PURA de reconciliación del modo examen. La BD (`test_questions`) es la
// fuente AUTORITATIVA de la nota: los guardados realtime por-respuesta
// (`/api/exam/answer` → saveAnswer) emparejan `questionId` ↔ respuesta del
// usuario en el servidor y calculan `is_correct` contra la pregunta real, así
// que son fiables por construcción e INDEPENDIENTES del índice de array.
//
// El batch que el cliente envía a `/api/exam/validate` va indexado por POSICIÓN
// (`userAnswers[index]` ↔ `effectiveQuestions[index]`). Si ese orden se
// desalinea entre responder y corregir, el batch empareja respuestas con
// preguntas equivocadas → la nota del batch sale mal aunque la BD esté bien.
// (Caso real: Isabel, 16/06/2026 — pantalla 0/71 con la BD en 62/71.)
//
// Por eso, al corregir, la nota mostrada y el detalle por-pregunta se derivan de
// la BD, no del batch. Estos helpers son puros para poder testearlos sin BD.

export interface DbAnswerRow {
  questionId: string | null
  userAnswer: string
  isCorrect: boolean
}

export interface ExamScoreSummary {
  totalQuestions: number
  totalAnswered: number
  totalCorrect: number
  percentage: number
}

export interface ExamQuestionResult {
  questionId: string
  userAnswer: string | null
  correctAnswer: string
  correctIndex: number
  isCorrect: boolean
  explanation?: string | null
}

/** ¿La respuesta cuenta como contestada (no en blanco)? */
function isAnswered(userAnswer: string | null | undefined): boolean {
  return userAnswer != null && userAnswer !== ''
}

/**
 * Nota autoritativa calculada desde las filas de `test_questions` ya
 * persistidas (incluye los guardados realtime). `totalQuestions` lo fija el
 * tamaño del examen (longitud del batch), no el nº de filas, para que un save
 * realtime perdido no reduzca el total.
 */
export function summarizeDbScore(rows: DbAnswerRow[], totalQuestions: number): ExamScoreSummary {
  let totalCorrect = 0
  let totalAnswered = 0
  for (const r of rows) {
    if (isAnswered(r.userAnswer)) totalAnswered++
    if (r.isCorrect) totalCorrect++
  }
  return {
    totalQuestions,
    totalAnswered,
    totalCorrect,
    percentage: totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0,
  }
}

/**
 * Superpone sobre los resultados del batch la respuesta+corrección AUTORITATIVA
 * de la BD (por `questionId`). Si la BD tiene esa pregunta con respuesta no
 * blanca, gana sobre el batch (el batch pudo venir desalineado). Si la BD no la
 * tiene (save realtime perdido y validate la rellenó), se conserva el batch.
 *
 * El orden de salida es el MISMO del batch — el cliente lo casa por índice con
 * `effectiveQuestions[index]`, así que no se debe reordenar.
 */
export function overlayResultsWithDb(
  payloadResults: ExamQuestionResult[],
  dbByQuestionId: Map<string, DbAnswerRow>,
): ExamQuestionResult[] {
  return payloadResults.map((r) => {
    const db = dbByQuestionId.get(r.questionId)
    if (db && isAnswered(db.userAnswer)) {
      return { ...r, userAnswer: db.userAnswer, isCorrect: db.isCorrect }
    }
    return r
  })
}

/**
 * ¿Diverge la nota del batch (cliente) de la autoritativa (BD)? Señal de
 * desalineado/corrupción del estado del cliente — se emite a observabilidad.
 */
export function scoreDivergence(
  payloadCorrect: number,
  dbCorrect: number,
): { diverged: boolean; delta: number } {
  return { diverged: payloadCorrect !== dbCorrect, delta: dbCorrect - payloadCorrect }
}

/** Mapa questionId → fila de BD, descartando filas sin questionId. */
export function indexDbRowsByQuestionId(rows: DbAnswerRow[]): Map<string, DbAnswerRow> {
  const map = new Map<string, DbAnswerRow>()
  for (const r of rows) {
    if (r.questionId) map.set(r.questionId, r)
  }
  return map
}
