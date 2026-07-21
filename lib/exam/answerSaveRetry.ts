// lib/exam/answerSaveRetry.ts — Decisiones PURAS del guardado por-respuesta del examen
// (fix caso Marta 21/07/2026). Extraídas de ExamLayout.saveAnswerToAPI para poder
// testear la lógica de ramificación (reintentar / no reintentar / avisar) en aislamiento,
// sin montar el componente ni mockear fetch. El bucle en el componente es glue fino sobre
// estas funciones.

/** Clasificación de una respuesta de /api/exam/answer de cara al reintento. */
export type SaveResponseClass = 'ok' | 'device_limit' | 'permanent' | 'retriable'

/**
 * Decide qué hacer con una respuesta HTTP del guardado:
 *  - 'ok'          → guardado correcto, terminar.
 *  - 'device_limit'→ 403 con deviceLimitReached: avisar una vez, NO reintentar (permanente esta sesión).
 *  - 'permanent'   → 4xx (salvo 429): input/permiso, NO reintentar.
 *  - 'retriable'   → 5xx / 429 / cualquier no-ok sin éxito: reintentar con backoff.
 */
export function classifyAnswerSaveResponse(
  status: number,
  ok: boolean,
  success: boolean,
  deviceLimitReached: boolean,
): SaveResponseClass {
  if (ok && success) return 'ok'
  if (status === 403 && deviceLimitReached) return 'device_limit'
  if (status >= 400 && status < 500 && status !== 429) return 'permanent'
  return 'retriable'
}

/** Backoff entre reintentos: 1s, 2s, … (lineal por intento). */
export function answerSaveBackoffMs(attempt: number): number {
  return 1000 * attempt
}

/**
 * ¿Avisar al usuario y emitir telemetría de guardado degradado? Solo tras `threshold`
 * fallos seguidos y UNA vez por sesión (para que RULE_CLIENT_ERROR_SPIKE vea un evento
 * por sesión, no uno por respuesta de un usuario con mala conexión).
 */
export function shouldEmitSaveDegraded(
  failStreak: number,
  alreadyEmitted: boolean,
  threshold = 3,
): boolean {
  return failStreak >= threshold && !alreadyEmitted
}
