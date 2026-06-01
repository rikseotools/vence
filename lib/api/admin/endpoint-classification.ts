// lib/api/admin/endpoint-classification.ts
// Clasificación de endpoints en `admin` (interno/operativo) vs `user_facing`
// (UX cliente). Usado por el health-check para distinguir errores que
// afectan a usuarios reales de errores en herramientas internas/crones.
//
// MOTIVACIÓN — incidente de diagnóstico 2026-06-01:
//   El runbook health-check disparaba veredicto ROJO porque 13 errores en
//   `/api/verify-articles/sync-all` (admin tool, 0 impacto UX) cruzaban el
//   umbral de 5 errores 5xx en 24h pensado para endpoints de usuario.
//   Resultado: falso positivo. Necesitábamos sub-categorizar.
//
// FILOSOFÍA — whitelist explícito de patrones admin, default user-facing:
//   - Más seguro: un endpoint nuevo sin clasificar cuenta como user-facing
//     (umbral más estricto). Solo se relaja si se marca explícitamente.
//   - Evita el bug "olvidé añadirlo a la lista" — el caso por defecto NUNCA
//     es "tolera 20 errores antes de avisar".
//
// FUENTE DE VERDAD ÚNICA — este módulo es importado por:
//   - app/api/admin/system-health/route.ts (panel /admin/salud-sistema)
//   - docs/runbooks/health-check.md (script CLI Node — mantiene patrones en
//     sincronía manualmente porque bash no puede importar TS; ver comentario
//     en el script)

/**
 * Patrones de endpoint clasificados como `admin` (interno/operativo).
 * Coinciden con el inicio del path (anchored `^`).
 *
 * Criterio: cualquier endpoint que solo es usado por:
 *   - Panel admin (admins.vence.es / vencemitfg.es)
 *   - Crones internos (Fargate o GHA)
 *   - Herramientas de mantenimiento / verificación
 *   - Debug / development tools
 *   - Armando-tools (partner operacional)
 */
export const ADMIN_ENDPOINT_PATTERNS: readonly RegExp[] = [
  /^\/api\/admin(\/|$)/,
  /^\/api\/v2\/admin(\/|$)/,
  /^\/api\/cron(\/|$)/,
  /^\/api\/debug(\/|$)/,
  /^\/api\/verify-articles(\/|$)/,
  /^\/api\/armando(\/|$)/,
] as const

export type EndpointCategory = 'admin' | 'user_facing'

/**
 * Clasifica un endpoint en `admin` o `user_facing`.
 *
 * Default `user_facing` por defensa: si un endpoint nuevo no está en la
 * whitelist admin, asumimos que afecta a usuarios reales y aplicamos los
 * umbrales más estrictos. Es preferible "alerta de más" que "alerta de menos".
 *
 * @param endpoint Path del endpoint (e.g. `/api/profile`, `/api/admin/feedback`,
 *   `/api/topics/[numero]`). Acepta dynamic route segments tipo Next.js.
 * @returns `'admin'` si matchea algún patrón de `ADMIN_ENDPOINT_PATTERNS`,
 *   `'user_facing'` en caso contrario (incluido endpoint vacío/null/undefined).
 *
 * @example
 *   classifyEndpoint('/api/profile')                  // 'user_facing'
 *   classifyEndpoint('/api/admin/feedback')           // 'admin'
 *   classifyEndpoint('/api/v2/answer-and-save')       // 'user_facing'
 *   classifyEndpoint('/api/cron/check-stats-drift')   // 'admin'
 *   classifyEndpoint('/api/topics/[numero]')          // 'user_facing'
 */
export function classifyEndpoint(
  endpoint: string | null | undefined,
): EndpointCategory {
  if (!endpoint || typeof endpoint !== 'string') return 'user_facing'

  for (const pattern of ADMIN_ENDPOINT_PATTERNS) {
    if (pattern.test(endpoint)) return 'admin'
  }
  return 'user_facing'
}

/**
 * Umbrales de errores 5xx para el verdict del health-check, diferenciados
 * por categoría.
 *
 * Rationale:
 *   - `user_facing`: cualquier error afecta a un usuario real → umbral bajo.
 *   - `admin`: bajo tráfico, errores ocasionales son aceptables sin disparar
 *     incidente. 4× más permisivo refleja "es importante pero no es UX".
 *
 * Si cambian, sincronizar también:
 *   - app/api/admin/system-health/route.ts (uso directo de las constantes)
 *   - docs/runbooks/health-check.md §4 (documentación de umbrales)
 */
export const ERROR_5XX_THRESHOLDS = {
  user_facing: { amber: 1, red: 5 },
  admin: { amber: 5, red: 20 },
} as const
