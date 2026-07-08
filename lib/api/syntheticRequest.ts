// lib/api/syntheticRequest.ts
// Detección de tráfico SINTÉTICO (canaries de salud) por un marcador canónico.
//
// MOTIVACIÓN — incidente 08/07/2026:
//   El canary `answer-premium` ejercía `/api/exam/answer` cada 5 min y generaba
//   un 5xx que `withErrorLogging` escribía en `validation_error_logs`. El
//   veredicto de salud contaba esos 73 errores como "user-facing" y disparaba
//   ROJO — pero ningún usuario real estaba afectado. Los canaries tienen su
//   PROPIO canal de alerta (`canary_*_failed`); duplicar sus fallos en el log
//   de errores de endpoint es ruido que envenena el veredicto.
//
// SEÑAL CANÓNICA — el header `x-vence-canary`:
//   TODOS los canaries de `backend/src/canary-*` ya envían `x-vence-canary: '1'`.
//   Usarlo como única fuente de verdad es:
//     - Agnóstico: no acopla a user-ids ni user-agents concretos.
//     - Escalable: cualquier canary presente o futuro que mande el header queda
//       excluido SIN tocar este módulo. Cero mantenimiento por-canary.
//   NOTA de seguridad: este header solo se usa para DEGRADAR observabilidad
//   (no loguear como error), NUNCA para conceder acceso ni saltar validaciones.
//   Un atacante que lo falsifique solo consigue que SUS propios errores no se
//   registren en VLE — no obtiene ningún privilegio. Riesgo nulo.

/** Forma mínima de request que necesitamos: acceso a headers.get(). */
type HeaderReadable = {
  headers?: { get?: (name: string) => string | null } | null
} | null | undefined

/**
 * `true` si la request proviene de un canary sintético (marcada con el header
 * canónico `x-vence-canary`). Defensivo: nunca lanza aunque `request` o
 * `headers` sean null/undefined (el logging es fire-and-forget).
 */
export function isSyntheticRequest(request: HeaderReadable): boolean {
  const value = request?.headers?.get?.('x-vence-canary')
  return value === '1' || value === 'true'
}
