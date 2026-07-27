// lib/api/exam/validateShape.ts
//
// Clasificación PURA de la "forma" de una llamada a `/api/exam/validate`.
//
// POR QUÉ EXISTE (auditoría 27/07/2026): ese endpoint devuelve la respuesta
// correcta + la explicación completa de cada `questionId` que le pases. Es el
// único sitio de la app donde la clave NO viaja con la pregunta (modo examen),
// así que es el único que puede ser usado como ORÁCULO: pides una lista de
// UUIDs y te la corrige.
//
// El agujero de detección no era la corrección en sí — es que cuando la llamada
// NO trae `testId` el servidor no persiste NADA (ni `test_questions`, ni score,
// ni contador diario). Una cosecha por esa vía no dejaba rastro de ningún tipo.
//
// Este módulo NO bloquea ni cambia comportamiento: solo pone nombre a la forma
// de la llamada para que el trazo (`observable_events`) sea explotable después.
// Separado y puro para poder fijarlo con tests sin levantar la ruta.

/** Forma de la llamada, de más legítima a más sospechosa. */
export type ValidateShape =
  /** Examen normal: trae testId y el usuario contestó algo. */
  | 'exam'
  /** Examen entregado entero en blanco. Legítimo (abandono) pero es la firma
   *  del que genera exámenes solo para que se los corrijan. */
  | 'exam_blank'
  /** Sin testId: corrección que no se ancla a ningún examen → no persiste nada.
   *  El cliente real (ExamLayout) SIEMPRE manda testId. */
  | 'orphan'
  /** Sin testId y lote grande: cosecha en bloque. */
  | 'orphan_bulk'

export interface ValidateShapeInput {
  /** Nº de preguntas del lote. */
  batchSize: number
  /** Cuántas traen respuesta del usuario (userAnswer no nulo). */
  answeredCount: number
  /** ¿La llamada ancla a un examen existente? */
  hasTestId: boolean
}

export interface ValidateShapeResult {
  shape: ValidateShape
  /** Severidad para `observable_events`. */
  severity: 'info' | 'warn' | 'error'
  /** Motivos legibles, para el forense y el panel. */
  reasons: string[]
}

/**
 * Umbral por encima del cual un lote sin examen se considera cosecha en bloque.
 * Referencia empírica (90d, prod): el examen más grande REAL son 110 preguntas
 * (p99 = 110, mediana 25). 150 deja margen holgado sobre el máximo legítimo.
 */
export const ORPHAN_BULK_THRESHOLD = 150

/**
 * Clasifica la llamada. Puro y total: nunca lanza, nunca lee entorno.
 *
 * Cuidado al endurecer esto: `exam_blank` NO es fraude por sí solo — 160
 * usuarios reales dejaron exámenes en blanco en 30 días (abandono normal).
 * Lo que discrimina es la ausencia de `testId`, no el blanco.
 */
export function classifyValidateCall(input: ValidateShapeInput): ValidateShapeResult {
  const batchSize = Number.isFinite(input.batchSize) ? Math.max(0, input.batchSize) : 0
  const answeredCount = Number.isFinite(input.answeredCount) ? Math.max(0, input.answeredCount) : 0
  const reasons: string[] = []

  if (!input.hasTestId) {
    reasons.push('sin_test_id')
    if (answeredCount === 0) reasons.push('lote_sin_respuestas')
    if (batchSize > ORPHAN_BULK_THRESHOLD) {
      reasons.push(`lote_${batchSize}_supera_maximo_real`)
      return { shape: 'orphan_bulk', severity: 'error', reasons }
    }
    return { shape: 'orphan', severity: 'warn', reasons }
  }

  if (answeredCount === 0) {
    reasons.push('examen_entregado_en_blanco')
    return { shape: 'exam_blank', severity: 'info', reasons }
  }

  return { shape: 'exam', severity: 'info', reasons }
}
