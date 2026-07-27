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
  /** Examen de un usuario SIN CUENTA, contestado. Normal: al no haber usuario no
   *  hay `tests` al que anclarlo, así que no puede traer testId. Es el flujo de
   *  probar sin registrarse. */
  | 'anon_exam'
  /** Sin testId cuando SÍ debería haberlo (sesión iniciada), o sin contestar
   *  (pedir correcciones sin haber hecho el examen = uso de oráculo). */
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
  /** ¿Hay sesión iniciada? Un cliente LOGUEADO siempre manda testId; uno anónimo
   *  no puede. Sin este dato, todo examen anónimo parecía sospechoso. */
  authenticated?: boolean
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

    // El lote desmedido es sospechoso venga de quien venga.
    if (batchSize > ORPHAN_BULK_THRESHOLD) {
      reasons.push(`lote_${batchSize}_supera_maximo_real`)
      return { shape: 'orphan_bulk', severity: 'error', reasons }
    }

    // CALIBRACIÓN 27/07/2026, con datos de la primera hora del trazo en prod:
    // 9 de las 13 llamadas eran `orphan`… y las 9 eran ANÓNIMAS, de lote 25 y con
    // 24-25 respuestas contestadas. O sea, el flujo normal de "probar un examen
    // sin registrarse": sin usuario no hay `tests` al que anclar, así que NO
    // PUEDEN traer testId. Marcarlas `warn` metía ~300 avisos/día en el catch-all
    // de /admin/salud-sistema — ruido que devalúa la señal buena.
    //
    // Lo que SÍ queda como sospechoso, y es lo que importaba desde el principio:
    //   · con sesión iniciada y sin testId → el cliente real siempre lo manda;
    //   · sin contestar nada → pedir correcciones sin haber hecho el examen es
    //     literalmente el uso del endpoint como oráculo.
    if (!input.authenticated && answeredCount > 0) {
      reasons.push('anonimo_sin_cuenta_a_la_que_anclar')
      return { shape: 'anon_exam', severity: 'info', reasons }
    }
    if (input.authenticated) reasons.push('con_sesion_deberia_traer_test_id')
    return { shape: 'orphan', severity: 'warn', reasons }
  }

  if (answeredCount === 0) {
    reasons.push('examen_entregado_en_blanco')
    return { shape: 'exam_blank', severity: 'info', reasons }
  }

  return { shape: 'exam', severity: 'info', reasons }
}
