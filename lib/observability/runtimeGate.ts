// lib/observability/runtimeGate.ts
//
// Fuente única: ¿este proceso debe PERSISTIR eventos de observabilidad
// (validation_error_logs, observable_events) o es un runtime no-productivo
// cuyo tráfico no debe contar como señal de producción?
//
// El .env.local de este repo apunta las sesiones de desarrollo (`next dev`) a
// la MISMA RDS de producción — así es como se trabaja aquí (CLAUDE.md: "verificar
// contra la BD real"). Eso significa que cualquier servidor local que no esté en
// NODE_ENV=production comparte TABLA con el panel de salud real.
//
// `validation-error-log/queries.ts` ya llevaba este freno para `validation_error_logs`
// (antes inline, como `SKIP_PERSISTENCE`). T-572 (05/08/2026) encontró la grieta
// gemela en `withErrorLogging`: el `request_completed` que emite a `observable_events`
// para timing/volumen NO tenía este freno — un worktree local con la clave RS256 rota
// (PEM inválida en mintAccessToken) escribió 89 eventos httpStatus=500 en 4 minutos,
// host=localhost:3210, y esos 89 eventos eran el 88% de los "101 5xx de 24h" que veía
// el panel de salud — con `validation_error_logs` (la fuente real del indicador 1) en
// CERO durante esa misma ventana. Un `sslmode`-style gotcha gemelo: dos puertas al
// mismo destino con criterios distintos no protegen, dejan una abierta.
export function shouldSkipObservabilityPersistence(): boolean {
  return process.env.NODE_ENV !== 'production'
}
