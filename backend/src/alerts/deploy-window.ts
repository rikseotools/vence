import { sql, type SQL } from 'drizzle-orm';

/**
 * Ventana de "churn de infraestructura" — un deploy/rolling/reinicio en
 * curso o recién terminado. Algunas reglas de alerta vigilan estados
 * TRANSITORIOS que un deploy provoca por diseño (conexiones del pool del
 * frontend que quedan en ClientRead cuando el task viejo cierra TCP al
 * morir en el rolling). Durante esa ventana, esos estados son ruido
 * esperado, no incidente.
 *
 * Diseño deliberado (diagnóstico 2026-06-01):
 *   - SOLO se usa para silenciar reglas que lo piden explícitamente vía
 *     `ctx.deployWindow` Y que tienen su propia válvula de escape de
 *     severidad (ej. pool_hung_clientread sigue alertando si el recuento
 *     de conexiones colgadas es alto — eso es saturación real, no rolling).
 *   - NUNCA se usa para silenciar `cron_overdue`: ese caso resultó ser una
 *     alerta legítima (detect-oep-llm parado desde el incidente outbox), y
 *     el backend ni siquiera reinicia en un deploy de frontend.
 *   - Fail-open: si la query de detección falla, la ventana se considera
 *     INACTIVA → no se suprime nada → preferimos alerta de más que silencio.
 *
 * Señales (cualquiera activa la ventana), ventana de 15 min:
 *   - `frontendVersions >= 2`: rolling deploy del frontend sirviendo dos
 *     versiones a la vez (old task + new task).
 *   - `dbReadyWarmup > 0`: el readiness probe /api/health/db-ready devolvió
 *     503 (container Fargate frío calentando el pool). Señal directa de
 *     arranque de container. Sobrevive al fix de expectedStatuses porque
 *     ese 503 sigue emitiendo `request_completed` (sólo dejó de emitir
 *     http_5xx).
 *   - `deployFailed > 0`: GitHub Actions reportó un deploy fallido
 *     (source=gha) — churn de reinicio aunque la versión no progrese.
 */
export interface DeployWindow {
  active: boolean;
  reasons: string[];
}

/** Filas crudas que devuelve DEPLOY_WINDOW_QUERY. */
export interface DeployWindowRow {
  frontendVersions: number;
  dbReadyWarmup: number;
  deployFailed: number;
}

/**
 * Una sola query (tres subconsultas) para no penalizar el tick del
 * alerts-engine. Se ejecuta UNA vez por tick, no por regla.
 */
export const DEPLOY_WINDOW_QUERY: SQL = sql`
  SELECT
    (SELECT COUNT(DISTINCT deploy_version)::int
       FROM observable_events
      WHERE event_type = 'request_completed'
        AND deploy_version IS NOT NULL
        AND ts > NOW() - INTERVAL '15 minutes') AS "frontendVersions",
    (SELECT COUNT(*)::int
       FROM observable_events
      WHERE endpoint = '/api/health/db-ready'
        AND http_status = 503
        AND ts > NOW() - INTERVAL '15 minutes') AS "dbReadyWarmup",
    (SELECT COUNT(*)::int
       FROM observable_events
      WHERE event_type = 'deploy_failed'
        AND ts > NOW() - INTERVAL '15 minutes') AS "deployFailed"
`;

/**
 * Pura: traduce las filas de la query a la ventana. Si no hay filas (query
 * falló y el caller pasó []), devuelve inactiva (fail-open).
 */
export function evaluateDeployWindow(rows: DeployWindowRow[]): DeployWindow {
  const r = rows[0] ?? {
    frontendVersions: 0,
    dbReadyWarmup: 0,
    deployFailed: 0,
  };
  const reasons: string[] = [];
  if ((r.frontendVersions ?? 0) >= 2) {
    reasons.push(`frontend_rolling: ${r.frontendVersions} versiones sirviendo`);
  }
  if ((r.dbReadyWarmup ?? 0) > 0) {
    reasons.push(`db_ready_warmup: ${r.dbReadyWarmup} probes 503`);
  }
  if ((r.deployFailed ?? 0) > 0) {
    reasons.push(`deploy_failed: ${r.deployFailed} en 15min`);
  }
  return { active: reasons.length > 0, reasons };
}
