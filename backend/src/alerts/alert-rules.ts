import { sql, type SQL } from 'drizzle-orm';
import type { AlertNotification } from './notification-adapter';

/**
 * Definición declarativa de una regla de alerta.
 *
 * El cron rules engine ejecuta `query` sobre la BD; si `shouldFire`
 * devuelve true para el resultado, llama `buildNotification` y dispara.
 *
 * `cooldownMin` evita spam: si una regla disparó hace <N min, se silencia.
 * Tracking del último firing en memoria del proceso (basta para Fargate
 * single-task; si crece a N tasks, mover a Redis con key `alert_lastfire:${rule}`).
 *
 * Bloque 4 Gap 8 del manual de observabilidad.
 */
export interface AlertRule<T = unknown> {
  /** Identificador estable de la regla (snake_case). */
  name: string;

  /** Severidad de la notificación que se dispararía. */
  severity: 'warn' | 'error' | 'critical';

  /**
   * Query SQL que devuelve filas. El resultado se pasa a `shouldFire` y
   * `buildNotification`. Si la query no devuelve filas, equivale a "no
   * fire" — no llama buildNotification.
   */
  query: SQL;

  /**
   * Predicado: ¿deben dispararse las notificaciones para este resultado?
   * Si devuelve false, no se envía nada.
   */
  shouldFire: (rows: T[]) => boolean;

  /** Construye el contenido de la notificación a enviar. */
  buildNotification: (rows: T[]) => Omit<AlertNotification, 'rule' | 'severity'>;

  /**
   * Tiempo mínimo entre dos firings consecutivos de la misma regla.
   * Evita spam si la condición persiste.
   */
  cooldownMin: number;
}

// ────────────────────────────────────────────────────────────────
// Catálogo de reglas iniciales — extensible
// ────────────────────────────────────────────────────────────────

/** Spike de errores 5xx — alertar si >20 en últimos 5 minutos. */
export const RULE_HTTP_5XX_SPIKE: AlertRule<{ n: number; topEndpoint: string | null }> = {
  name: '5xx_spike',
  severity: 'critical',
  query: sql`
    SELECT COUNT(*)::int AS n,
           MODE() WITHIN GROUP (ORDER BY endpoint) AS "topEndpoint"
    FROM observable_events
    WHERE event_type IN ('http_5xx', 'http_timeout')
      AND ts > NOW() - INTERVAL '5 minutes'
  `,
  shouldFire: (rows) => (rows[0]?.n ?? 0) > 20,
  buildNotification: (rows) => {
    const n = rows[0]?.n ?? 0;
    const top = rows[0]?.topEndpoint ?? '(varios)';
    return {
      title: `Spike de errores 5xx — ${n} errores en 5 min`,
      body: `Endpoint con más errores: ${top}\n\nInvestigar en /admin/salud-sistema o:\n\n  SELECT endpoint, error_type, COUNT(*) FROM observable_events\n  WHERE event_type='http_5xx' AND ts > NOW() - INTERVAL '5 minutes'\n  GROUP BY endpoint, error_type ORDER BY COUNT(*) DESC;`,
      metadata: { count: n, topEndpoint: top, windowMin: 5 },
      fingerprint: `5xx_spike_${top}`,
    };
  },
  cooldownMin: 30,
};

/**
 * Cron no se ejecutó en 2× su intervalo esperado.
 *
 * La lista de intervalos esperados vive aquí para que cron rules sea
 * 100% declarativo. Si añades un cron nuevo a backend, añadirlo aquí
 * para que su staleness se vigile.
 */
const CRON_EXPECTED_INTERVAL_MIN: Record<string, number> = {
  // every-5min crons
  'refresh-rankings': 5,
  'process-outbox': 5,
  // daily crons
  'archive-interactions': 60 * 24,
  'refresh-theme-cache': 60 * 24,
  'update-streaks': 60 * 24,
  'detect-timeline-silence': 60 * 24,
  'check-boe-changes': 60 * 24,
  'observability-cleanup': 60 * 24,
  // 4× daily
  'process-verification-queue': 60 * 6,
  // weekly
  'avatar-rotation': 60 * 24 * 7,
  // L-V daily (1 vez por día laboral)
  'check-seguimiento': 60 * 24,
  'detect-oep-llm': 60 * 24,
  'detect-generic-sources': 60 * 24,
  // solo lunes
  'detect-regional-oeps': 60 * 24 * 7,
};

export const RULE_CRON_OVERDUE: AlertRule<{
  endpoint: string;
  minutesSinceLast: number;
}> = {
  name: 'cron_overdue',
  severity: 'critical',
  query: sql`
    SELECT endpoint,
           EXTRACT(EPOCH FROM (NOW() - MAX(ts))) / 60 AS "minutesSinceLast"
    FROM observable_events
    WHERE event_type = 'cron_run'
      AND ts > NOW() - INTERVAL '14 days'  -- ventana para cubrir weekly
    GROUP BY endpoint
  `,
  shouldFire: (rows) => {
    return rows.some((r) => {
      const expected = CRON_EXPECTED_INTERVAL_MIN[r.endpoint];
      if (!expected) return false;
      // Permitir 2× el intervalo + 30 min de gracia
      return r.minutesSinceLast > expected * 2 + 30;
    });
  },
  buildNotification: (rows) => {
    const overdue = rows.filter((r) => {
      const expected = CRON_EXPECTED_INTERVAL_MIN[r.endpoint];
      return expected && r.minutesSinceLast > expected * 2 + 30;
    });
    const lines = overdue.map((r) => {
      const expected = CRON_EXPECTED_INTERVAL_MIN[r.endpoint];
      const hours = (r.minutesSinceLast / 60).toFixed(1);
      return `  - ${r.endpoint}: ${hours}h sin emitir (esperado cada ${expected} min)`;
    });
    return {
      title: `${overdue.length} cron${overdue.length > 1 ? 's' : ''} overdue`,
      body: `Los siguientes crons no emiten "cron_run" desde hace más de 2× su intervalo esperado:\n\n${lines.join('\n')}\n\nVerificar ECS task vence-backend, CloudWatch Logs, o BD.`,
      metadata: { overdueCrons: overdue.map((r) => r.endpoint) },
    };
  },
  cooldownMin: 60,
};

/** Deploy fallido — alertar inmediato si aparece event deploy_failed. */
export const RULE_DEPLOY_FAILED: AlertRule<{ n: number; lastMsg: string | null }> = {
  name: 'deploy_failed',
  severity: 'critical',
  query: sql`
    SELECT COUNT(*)::int AS n,
           (ARRAY_AGG(error_message ORDER BY ts DESC))[1] AS "lastMsg"
    FROM observable_events
    WHERE event_type = 'deploy_failed'
      AND ts > NOW() - INTERVAL '10 minutes'
  `,
  shouldFire: (rows) => (rows[0]?.n ?? 0) > 0,
  buildNotification: (rows) => ({
    title: `${rows[0]?.n ?? 0} deploy(s) fallido(s) últimos 10 min`,
    body: `Último mensaje:\n\n${rows[0]?.lastMsg ?? '(sin detalle)'}\n\nVerificar GitHub Actions / Vercel dashboard.`,
    metadata: { count: rows[0]?.n ?? 0 },
  }),
  cooldownMin: 5,
};

/** Spike de fallos de cron — algún cron falló múltiples veces seguidas. */
export const RULE_CRON_FAILURE_BURST: AlertRule<{
  endpoint: string;
  failures: number;
}> = {
  name: 'cron_failure_burst',
  severity: 'error',
  query: sql`
    SELECT endpoint, COUNT(*)::int AS failures
    FROM observable_events
    WHERE event_type = 'cron_run'
      AND severity = 'error'
      AND ts > NOW() - INTERVAL '1 hour'
    GROUP BY endpoint
    HAVING COUNT(*) >= 3
  `,
  shouldFire: (rows) => rows.length > 0,
  buildNotification: (rows) => ({
    title: `${rows.length} cron(s) con fallos repetidos`,
    body: rows
      .map((r) => `  - ${r.endpoint}: ${r.failures} fallos en última hora`)
      .join('\n'),
    metadata: { burst: rows.map((r) => `${r.endpoint}:${r.failures}`).join(',') },
  }),
  cooldownMin: 30,
};

// ────────────────────────────────────────────────────────────────
// Reglas añadidas 2026-05-26 (Bloque 4 Fase 1.6 del roadmap):
// cubren los eventos nuevos capturados en esta sesión (runtime_kill
// del Gap 14, tts_error cascade, hydration mismatch tras deploy,
// workflow_failure GHA). Sin estas reglas, los eventos quedan en BD
// sin disparar alertas → defeats the purpose de la captura.
// ────────────────────────────────────────────────────────────────

/**
 * Runtime kill (504 SIGTERM) — disparo INMEDIATO. Llega vía Vercel Log
 * Drain (Gap 14). Cualquier ocurrencia merece atención: significa que
 * un endpoint excedió maxDuration y Vercel mató la lambda. Hay un user
 * mirando un 504. Sin esta regla, el evento queda silencioso en obs_events.
 */
export const RULE_RUNTIME_KILL: AlertRule<{
  n: number;
  topEndpoint: string | null;
}> = {
  name: 'runtime_kill',
  severity: 'critical',
  query: sql`
    SELECT COUNT(*)::int AS n,
           MODE() WITHIN GROUP (ORDER BY endpoint) AS "topEndpoint"
    FROM observable_events
    WHERE event_type = 'runtime_kill'
      AND ts > NOW() - INTERVAL '5 minutes'
  `,
  shouldFire: (rows) => (rows[0]?.n ?? 0) > 0,
  buildNotification: (rows) => {
    const n = rows[0]?.n ?? 0;
    const top = rows[0]?.topEndpoint ?? '(varios)';
    return {
      title: `${n} runtime kill(s) últimos 5 min — endpoint principal: ${top}`,
      body: `Vercel mató ${n} lambda(s) por SIGTERM (excedieron maxDuration). Cada runtime_kill = un usuario vio 504 sin posibilidad de retry.\n\nAcciones:\n  1. Inspeccionar el endpoint en /admin/salud-sistema.\n  2. Añadir maxDuration corto + withDbTimeout si aún no lo tiene.\n  3. Si es BD lenta, mirar pg_stat_statements del último 1h.\n\n  SELECT endpoint, COUNT(*), MAX(error_message)\n  FROM observable_events\n  WHERE event_type='runtime_kill' AND ts > NOW() - INTERVAL '15 minutes'\n  GROUP BY endpoint ORDER BY COUNT(*) DESC;`,
      metadata: { count: n, topEndpoint: top, windowMin: 5 },
      fingerprint: `runtime_kill_${top}`,
    };
  },
  cooldownMin: 10,
};

/**
 * TTS cascade — si una sola sesión emite ≥10 tts_error en 5 min, el
 * circuit breaker (lib/tts/engine.ts MAX_CONSECUTIVE_CHUNK_ERRORS=5)
 * está roto o eludido. Pre-fix (25/05) había sesiones con 100-240
 * errores; el fix corta a 5. Si vuelve a haber ≥10, hay regresión.
 */
export const RULE_TTS_ERROR_BURST: AlertRule<{
  sessionId: string;
  browser: string | null;
  isMobile: string | null;
  errors: number;
}> = {
  name: 'tts_error_burst',
  severity: 'warn',
  query: sql`
    SELECT
      metadata->>'sessionId' AS "sessionId",
      metadata->>'browser' AS browser,
      metadata->>'isMobile' AS "isMobile",
      COUNT(*)::int AS errors
    FROM observable_events
    WHERE event_type = 'tts_error'
      AND ts > NOW() - INTERVAL '5 minutes'
    GROUP BY 1, 2, 3
    HAVING COUNT(*) >= 10
  `,
  shouldFire: (rows) => rows.length > 0,
  buildNotification: (rows) => {
    const lines = rows
      .slice(0, 10)
      .map(
        (r) =>
          `  - ${r.errors} errors / sesión ${(r.sessionId ?? '?').slice(0, 8)} (${r.browser ?? '?'}, mobile=${r.isMobile ?? '?'})`,
      );
    return {
      title: `${rows.length} sesión(es) TTS con ≥10 errores en 5 min — circuit breaker eludido`,
      body: `El fix del 26/05 (lib/tts/engine.ts MAX_CONSECUTIVE_CHUNK_ERRORS=5) debería cortar tras 5 errores consecutivos. Si una sesión llega a 10+ errores, el breaker no funcionó:\n\n${lines.join('\n')}\n\nInvestigar:\n  - ¿onend OK entre errores está reseteando el contador indebidamente?\n  - ¿Hay un retry path nuevo que bypaseó el handler?\n  - ¿Cambió el shape del evento error tras refactor?`,
      metadata: { sessionsAffected: rows.length, topBrowsers: rows.map((r) => r.browser).filter(Boolean) },
    };
  },
  cooldownMin: 60,
};

/**
 * Hydration mismatch spike — si tras un deploy nuevo aparecen ≥5
 * hydration mismatches en 15 min agrupados por (endpoint, deploy_version),
 * hay regresión real. El test arquitectural
 * (__tests__/architecture/no-date-in-temario-client.test.ts) cubre
 * /temario/[slug]; esta regla detecta el resto del repo donde no llega
 * el guardarraíl.
 */
export const RULE_HYDRATION_MISMATCH_SPIKE: AlertRule<{
  endpoint: string | null;
  deployVersion: string | null;
  n: number;
}> = {
  name: 'hydration_mismatch_spike',
  severity: 'error',
  query: sql`
    SELECT endpoint,
           deploy_version AS "deployVersion",
           COUNT(*)::int AS n
    FROM observable_events
    WHERE event_type = 'react_hydration_mismatch'
      AND ts > NOW() - INTERVAL '15 minutes'
    GROUP BY endpoint, deploy_version
    HAVING COUNT(*) >= 5
  `,
  shouldFire: (rows) => rows.length > 0,
  buildNotification: (rows) => {
    const lines = rows.map(
      (r) => `  - ${r.endpoint ?? '(unknown)'} [${r.deployVersion ?? '?'}]: ${r.n} mismatches`,
    );
    return {
      title: `${rows.length} ruta(s) con spike de hydration mismatch`,
      body: `React #418 / text content mismatch en producción. Suele ser un componente client que renderiza diferente en SSR vs CSR (timestamps, Date.now, Math.random, valores de localStorage sin guard SSR):\n\n${lines.join('\n')}\n\nInvestigar:\n  - grep "new Date()" en los componentes client de las rutas afectadas.\n  - Verificar que el último deploy no introdujo no-determinismo.\n  - Si es ruta /temario/[slug], el test arquitectural debería haber bloqueado; revisar coverage.`,
      metadata: { routesAffected: rows.length },
    };
  },
  cooldownMin: 60,
};

/**
 * Workflow failure burst (GHA) — ≥2 fallos del MISMO workflow en 30 min.
 * El 25/05 hubo 4 fallos seguidos de `frontend-deploy` (Bloque 5 Fase E.1)
 * que solo se vieron por email — esta regla los habría notificado
 * inmediatamente y de forma estructurada.
 */
export const RULE_WORKFLOW_FAILURE_BURST: AlertRule<{
  workflow: string | null;
  failures: number;
}> = {
  name: 'workflow_failure_burst',
  severity: 'error',
  query: sql`
    SELECT
      metadata->>'workflow' AS workflow,
      COUNT(*)::int AS failures
    FROM observable_events
    WHERE event_type = 'workflow_failure'
      AND ts > NOW() - INTERVAL '30 minutes'
    GROUP BY 1
    HAVING COUNT(*) >= 2
  `,
  shouldFire: (rows) => rows.length > 0,
  buildNotification: (rows) => {
    const lines = rows.map(
      (r) => `  - ${r.workflow ?? '(unknown)'}: ${r.failures} fallos`,
    );
    return {
      title: `${rows.length} workflow(s) GHA con fallos repetidos en 30 min`,
      body: `Probable problema persistente (no transitorio). Caso real del 25/05: 4 fallos de frontend-deploy por error en Docker build, solo nos enteramos por email:\n\n${lines.join('\n')}\n\nInvestigar en GitHub Actions o:\n\n  SELECT created_at, metadata->>'run_id' AS run, metadata->>'sha' AS sha, error_message\n  FROM observable_events\n  WHERE event_type='workflow_failure' AND ts > NOW() - INTERVAL '1 hour'\n  ORDER BY created_at DESC;`,
      metadata: { workflowsAffected: rows.length },
    };
  },
  cooldownMin: 30,
};

/**
 * Subscription drift — si el cron de reconciliación detecta usuarios con
 * subscription activa pero plan_type != premium, alertar.
 *
 * Origen: incidente 2026-05-26 — webhook Stripe roto durante horas, Andrea
 * pagó 20€ sin activarse, NADIE se enteró hasta que ella escribió al
 * soporte. El cron de reconciliación (.github/workflows/subscription-
 * reconciliation.yml, cada hora) detecta y corrige automáticamente, pero
 * queremos saberlo aunque corrija — si dispara seguido es señal de webhook
 * roto sostenidamente.
 *
 * Esta regla mira event_type='subscription_drift' emitido por el GHA wf
 * con metadata.detected = nº de inconsistencias. Si en última hora hubo
 * cualquier detection > 0, alertar.
 *
 * Limitación: no cubre el caso "Stripe tiene sub pero BD no tiene fila"
 * (caso Andrea exacto). Requiere ampliar el endpoint de reconciliación
 * para consultar Stripe API — pendiente como mejora futura.
 */
export const RULE_SUBSCRIPTION_DRIFT: AlertRule<{
  detected: number;
  fixed: number;
  lastRun: Date;
}> = {
  name: 'subscription_drift',
  severity: 'warn',
  query: sql`
    SELECT
      COALESCE((metadata->>'detected')::int, 0) AS detected,
      COALESCE((metadata->>'fixed')::int, 0) AS fixed,
      ts AS "lastRun"
    FROM observable_events
    WHERE event_type = 'subscription_drift'
      AND ts > NOW() - INTERVAL '1 hour'
    ORDER BY ts DESC
    LIMIT 1
  `,
  shouldFire: (rows) => rows.length > 0 && rows[0].detected > 0,
  buildNotification: (rows) => {
    const r = rows[0];
    return {
      title: `Subscription drift detectado: ${r.detected} inconsistencias (${r.fixed} corregidas auto)`,
      body: `El cron de reconciliación detectó ${r.detected} usuarios con subscription activa pero plan_type != premium. ${r.fixed} se corrigieron automáticamente.\n\nSi esto se repite cada hora, el webhook Stripe puede estar fallando — investigar Stripe Dashboard → Webhooks → /api/stripe/webhook.\n\nIncidente origen: 2026-05-26 (webhook roto silenciosamente, Andrea pagó sin activarse).`,
      metadata: { detected: r.detected, fixed: r.fixed, lastRun: r.lastRun },
    };
  },
  cooldownMin: 60,
};

/**
 * Webhook Stripe unhealthy — disparada por el cron check-webhook-health
 * (/api/cron/check-webhook-health, cada 15min). Emite evento
 * 'webhook_unhealthy' cuando >10% de eventos Stripe en última hora siguen
 * pending → indica que el webhook responde non-2xx sostenidamente.
 *
 * Origen: incidente 2026-05-26 (Andrea pagó 20€ sin activarse). Detecta
 * en <15min en vez de "cuando un usuario escriba al soporte".
 */
export const RULE_WEBHOOK_UNHEALTHY: AlertRule<{
  pendingPct: number;
  pending: number;
  total: number;
  oldestType: string | null;
  oldestAgeS: number | null;
}> = {
  name: 'webhook_unhealthy',
  severity: 'error',
  query: sql`
    SELECT
      (metadata->>'pending_pct')::numeric AS "pendingPct",
      (metadata->>'pending_events_1h')::int AS pending,
      (metadata->>'total_events_1h')::int AS total,
      metadata->>'oldest_pending_type' AS "oldestType",
      (metadata->>'oldest_pending_age_s')::int AS "oldestAgeS"
    FROM observable_events
    WHERE event_type = 'webhook_unhealthy'
      AND ts > NOW() - INTERVAL '30 minutes'
    ORDER BY ts DESC
    LIMIT 1
  `,
  shouldFire: (rows) => rows.length > 0,
  buildNotification: (rows) => {
    const r = rows[0];
    return {
      title: `Webhook Stripe unhealthy: ${r.pending}/${r.total} eventos pending (${r.pendingPct}%)`,
      body: `El cron check-webhook-health detectó que ${r.pendingPct}% de los eventos Stripe en la última hora siguen pending. Investigar inmediatamente:\n\n  - Evento más antiguo pending: ${r.oldestType ?? 'unknown'} (${r.oldestAgeS ?? '?'}s)\n  - Stripe Dashboard → Webhooks → /api/stripe/webhook → tab "Webhook attempts"\n\nIncidente origen 2026-05-26: webhook respondía 400 a todos los eventos por un bug en withErrorLogging consumiendo el raw body. Andrea pagó 20€ sin activarse.`,
      metadata: { pendingPct: r.pendingPct, pending: r.pending, total: r.total },
    };
  },
  cooldownMin: 15,
};

/**
 * Fallos 5xx en endpoints /api/stripe/* — cada error = un cliente que
 * intentó pagar y no pudo. Threshold bajo (>=3 en 10min) porque el
 * coste por fallo es directo en ingresos.
 *
 * Origen: incidente 2026-05-27 — bug del Dockerfile (ARG NEXT_PUBLIC_STRIPE_PRICE_*
 * faltante) dejó 'price_quarterly_placeholder' inlinado en el bundle JS
 * de /premium. Usuario tamalla.240@gmail.com (iPhone) intentó 8 veces
 * comprar premium quarterly entre 06:10-06:34 CEST y todas fallaron con
 * resource_missing. Detectado horas después por revisión manual de
 * observable_events. Si esta regla hubiera existido, alerta a los ~5min
 * del 3er fallo.
 */
export const RULE_STRIPE_CHECKOUT_FAILED: AlertRule<{
  n: number;
  topEndpoint: string | null;
}> = {
  name: 'stripe_checkout_failed',
  severity: 'critical',
  query: sql`
    SELECT COUNT(*)::int AS n,
           MODE() WITHIN GROUP (ORDER BY endpoint) AS "topEndpoint"
    FROM observable_events
    WHERE source = 'vercel'
      AND http_status >= 500
      AND endpoint LIKE '/api/stripe/%'
      AND ts > NOW() - INTERVAL '10 minutes'
  `,
  shouldFire: (rows) => (rows[0]?.n ?? 0) >= 3,
  buildNotification: (rows) => {
    const n = rows[0]?.n ?? 0;
    const top = rows[0]?.topEndpoint ?? '/api/stripe/*';
    return {
      title: `${n} fallos en checkout Stripe en 10min — clientes perdidos`,
      body: `Endpoint: ${top}\n\nCada 5xx en /api/stripe/* es un usuario que intentó pagar y no pudo. Investigar en:\n\n  - SELECT ts, endpoint, http_status, error_message, metadata FROM observable_events\n    WHERE endpoint LIKE '/api/stripe/%' AND http_status >= 500\n      AND ts > NOW() - INTERVAL '15 minutes'\n    ORDER BY ts DESC LIMIT 10;\n  - CloudWatch /ecs/vence-frontend filter "Error creando" OR "Stripe"\n  - Stripe Dashboard → Logs → recent failures\n\nIncidente origen 2026-05-27: bug del Dockerfile dejó 'price_quarterly_placeholder' en el bundle. Usuario perdió 8 intentos de checkout antes de rendirse. Sin esta regla, lo detectamos horas después manualmente.`,
      metadata: { count: n, topEndpoint: top, windowMin: 10 },
      fingerprint: `stripe_checkout_failed_${top}`,
    };
  },
  cooldownMin: 30,
};

/**
 * Caída brutal de tráfico — proxy de salud del frontend.
 *
 * Origen: incidente 2026-05-26 — entre 12:00-13:00 UTC el tráfico
 * cayó de 1272 req/h a 74 (94% caída) por OOM/crash loop ECS, y entre
 * 16:00-17:00 cayó de 1250 a 370 (70% caída) por 4 deploys frontend
 * fallidos consecutivos. Lidia y mbcapitas intentaron pagar durante
 * esos lapsos y pulsaron "Pagar" sin resultado. NADIE se enteró desde
 * la observabilidad — Andrea escribió cuando ya había pagado y no se
 * activó.
 *
 * Lógica (revisada 2026-05-27 tras 10 falsos positivos nocturnos):
 * comparar la hora previa cerrada contra la mediana de la MISMA HORA
 * DEL DÍA en los últimos 7 días (excluyendo hoy). Esto neutraliza el
 * patrón diurno — antes la regla comparaba la última hora (madrugada,
 * ~50 req) contra mediana de 6h anteriores (que incluían inicio de
 * noche con ~800 req) → 90% falsa caída cada noche entre 01:00 y 08:00
 * CEST. Spam de 10 emails CRITICAL madrugada del 27/05.
 *
 * Threshold de baseline > 30 req: si la app no tiene actividad ni
 * siquiera en su hora normal, no es un drop accionable (probable
 * apagado/maintenance ventana, no incidente).
 *
 * Warm-up de 7 días: si el slot horario no tiene >=1 muestra histórica
 * (observable_events empezó 2026-05-26), base.median = NULL y el WHERE
 * no se cumple → no dispara. Tradeoff aceptado: durante warm-up la
 * regla queda silente pero sin falsos positivos. Otras reglas
 * (RULE_HTTP_5XX_SPIKE, RULE_RUNTIME_KILL, monitor post-deploy
 * manual) cubren detección de incidentes mientras tanto.
 *
 * Excluye localhost (dev). Excluye la hora en curso (incompleta).
 */
export const RULE_TRAFFIC_DROP: AlertRule<{
  currentN: number;
  baselineMedian: number;
  dropPct: number;
}> = {
  name: 'traffic_drop',
  severity: 'critical',
  query: sql`
    WITH cur AS (
      -- Hora previa cerrada (la que ya tenemos completa)
      SELECT COUNT(*)::int AS n
      FROM observable_events
      WHERE event_type = 'request_completed'
        AND ts >= date_trunc('hour', NOW() - INTERVAL '1 hour')
        AND ts <  date_trunc('hour', NOW())
        AND (metadata->>'host' IS NULL OR metadata->>'host' NOT LIKE 'localhost%')
    ),
    same_hour_history AS (
      -- Misma hora-del-día UTC, últimos 7 días (excluyendo hoy)
      SELECT date_trunc('hour', ts) AS hr, COUNT(*)::int AS n
      FROM observable_events
      WHERE event_type = 'request_completed'
        AND ts >= NOW() - INTERVAL '8 days'
        AND ts <  date_trunc('hour', NOW() - INTERVAL '1 hour')
        AND EXTRACT(HOUR FROM ts AT TIME ZONE 'UTC')
            = EXTRACT(HOUR FROM (NOW() - INTERVAL '1 hour') AT TIME ZONE 'UTC')
        AND (metadata->>'host' IS NULL OR metadata->>'host' NOT LIKE 'localhost%')
      GROUP BY 1
    ),
    base AS (
      SELECT PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY n)::int AS median
      FROM same_hour_history
    )
    SELECT
      cur.n AS "currentN",
      base.median AS "baselineMedian",
      ROUND(100.0 * (1 - cur.n::numeric / NULLIF(base.median,0)))::int AS "dropPct"
    FROM cur, base
    WHERE base.median > 30
      AND cur.n < base.median * 0.4
  `,
  shouldFire: (rows) => rows.length > 0,
  buildNotification: (rows) => {
    const r = rows[0];
    return {
      title: `Tráfico HTTP cayó ${r.dropPct}% — frontend probablemente caído`,
      body: `Última hora: ${r.currentN} req. Mediana 6h previas: ${r.baselineMedian} req. Caída del ${r.dropPct}%.\n\nProbables causas:\n  - OOM / crash loop en frontend ECS (mirar CloudWatch ECS metrics)\n  - Deploy reciente caído (cobertura: regla 'workflow_failure_burst')\n  - Incidente Vercel o Supabase\n  - DNS / red\n\nIncidente origen 2026-05-26: dos caídas brutales (94% y 70%) durante las cuales Lidia, mbcapitas y otros intentaron pagar y los clicks "Pagar" no producían redirect a Stripe.`,
      metadata: { currentN: r.currentN, baselineMedian: r.baselineMedian, dropPct: r.dropPct },
    };
  },
  cooldownMin: 30,
};

/**
 * Cancel-flow void invoice failed — cualquier ocurrencia de
 * `subscription_void_invoice_failed` indica que el path past_due/unpaid
 * de cancelSubscription NO pudo voidear una invoice abierta. Consecuencia
 * real: Stripe SIGUE intentando cobrar al usuario en background tras
 * "cancelar". Caso Mariangeles 21/05/2026: 7 intentos de cancel fallaron,
 * ella esperó 5 días viendo los emails de payment_failed antes de pedir
 * borrado de cuenta.
 *
 * Disparo INMEDIATO con N≥1 (no acumulamos, cada fallo es un usuario con
 * cobros activos pendientes).
 */
export const RULE_SUBSCRIPTION_VOID_FAILED: AlertRule<{
  n: number;
  topUser: string | null;
  lastError: string | null;
}> = {
  name: 'subscription_void_failed',
  severity: 'error',
  query: sql`
    SELECT COUNT(*)::int AS n,
           MODE() WITHIN GROUP (ORDER BY user_id) AS "topUser",
           (ARRAY_AGG(error_message ORDER BY ts DESC))[1] AS "lastError"
    FROM observable_events
    WHERE event_type = 'subscription_void_invoice_failed'
      AND ts > NOW() - INTERVAL '15 minutes'
  `,
  shouldFire: (rows) => (rows[0]?.n ?? 0) > 0,
  buildNotification: (rows) => {
    const r = rows[0];
    return {
      title: `${r.n} void(s) de invoice fallido(s) en 15 min — usuarios siguen recibiendo cobros`,
      body: `cancelSubscription en modo immediate intentó voidear invoices abiertas y falló. El usuario afectado tiene cancelaciones contabilizadas pero Stripe seguirá reintentando charge_automatically hasta agotar smart retries (~3 semanas).\n\nUsuario top: ${(r.topUser ?? '?').slice(0, 8)}\nÚltimo error Stripe: ${r.lastError ?? '(n/a)'}\n\nAcciones:\n  1. /admin/salud-sistema → buscar el user_id y verificar estado en Stripe Dashboard.\n  2. Void manual desde dashboard si la invoice sigue abierta.\n  3. SELECT user_id, metadata->>'subscriptionId' AS sub, metadata->>'invoiceId' AS inv\n     FROM observable_events WHERE event_type='subscription_void_invoice_failed'\n     AND ts > NOW() - INTERVAL '1 hour';`,
      metadata: { count: r.n, topUser: r.topUser, lastError: r.lastError },
      fingerprint: `void_failed_${r.topUser ?? 'any'}`,
    };
  },
  cooldownMin: 30,
};

/**
 * Cancel-flow force-cancel burst — > 5 cancelaciones inmediatas
 * (past_due/unpaid/incomplete) en 1h indica un problema sistémico de
 * cobros (gateway de pago degradado, tarjetas masivamente caducadas tras
 * cambio anual, etc.). Si la tasa diaria normal es ~1-2, un burst de 5+
 * en 1h merece investigación inmediata.
 */
export const RULE_SUBSCRIPTION_FORCE_CANCEL_BURST: AlertRule<{ n: number }> = {
  name: 'subscription_force_cancel_burst',
  severity: 'warn',
  query: sql`
    SELECT COUNT(*)::int AS n
    FROM observable_events
    WHERE event_type = 'subscription_force_canceled_past_due'
      AND ts > NOW() - INTERVAL '1 hour'
  `,
  shouldFire: (rows) => (rows[0]?.n ?? 0) >= 5,
  buildNotification: (rows) => {
    const n = rows[0]?.n ?? 0;
    return {
      title: `${n} cancelaciones forzadas (past_due/unpaid) en 1h — posible problema de cobros sistémico`,
      body: `cancelSubscription tuvo que cancelar inmediatamente ${n} subscripciones que ya estaban en past_due/unpaid/incomplete. La tasa normal es <2/h. Posibles causas:\n  - Gateway de pago Stripe degradado (mirar status.stripe.com)\n  - Caducidad masiva de tarjetas (típico inicio de año/mes)\n  - Cambio en políticas anti-fraude del banco\n\nInvestigar:\n  SELECT user_id, metadata->>'originalStatus' AS status, ts\n  FROM observable_events WHERE event_type='subscription_force_canceled_past_due'\n  AND ts > NOW() - INTERVAL '2 hours' ORDER BY ts DESC;`,
      metadata: { count: n, windowMin: 60 },
    };
  },
  cooldownMin: 60,
};

/**
 * Cancel endpoint error burst — ≥3 errores no controlados (excepciones)
 * en /api/stripe/cancel en 15 min. Cualquier excepción que escape del
 * try/catch principal de cancelSubscription emite este evento. Si pasa
 * a la vez varias veces, la API de Stripe puede estar caída o nuestro
 * código tiene un bug que afecta a varios usuarios.
 */
export const RULE_SUBSCRIPTION_CANCEL_ERROR_BURST: AlertRule<{
  n: number;
  lastMsg: string | null;
}> = {
  name: 'subscription_cancel_error_burst',
  severity: 'error',
  query: sql`
    SELECT COUNT(*)::int AS n,
           (ARRAY_AGG(error_message ORDER BY ts DESC))[1] AS "lastMsg"
    FROM observable_events
    WHERE event_type = 'subscription_cancel_error'
      AND ts > NOW() - INTERVAL '15 minutes'
  `,
  shouldFire: (rows) => (rows[0]?.n ?? 0) >= 3,
  buildNotification: (rows) => {
    const r = rows[0];
    return {
      title: `${r.n} errores en /api/stripe/cancel en 15 min`,
      body: `Excepciones no controladas en cancelSubscription. Probable: API Stripe degradada o regresión del código.\n\nÚltimo mensaje: ${r.lastMsg ?? '(n/a)'}\n\nInvestigar:\n  - status.stripe.com\n  - SELECT user_id, error_message, metadata, ts FROM observable_events\n    WHERE event_type='subscription_cancel_error' AND ts > NOW() - INTERVAL '1 hour'\n    ORDER BY ts DESC;`,
      metadata: { count: r.n, lastMsg: r.lastMsg },
    };
  },
  cooldownMin: 30,
};

/**
 * Subscription drift "missing in DB" — el caso Andrea exacto.
 *
 * El cron de reconciliation Pass-2 (post-27/05/2026) consulta Stripe directo
 * y compara contra user_subscriptions. Si encuentra suscripciones active en
 * Stripe sin fila en BD, emite este evento con `detected: N`. Eso significa
 * usuarios que han PAGADO pero NO se ha aplicado premium — probable webhook
 * roto silenciosamente.
 *
 * Disparo: detected > 0. El cron además auto-arregla (INSERT fila + UPDATE
 * profile.plan_type), por eso la severity es 'error' no 'critical' — el
 * daño está mitigado, pero el bug raíz (webhook) sigue ahí y hay que
 * investigarlo igual.
 *
 * Caso real: 27/05/2026 — STRIPE_WEBHOOK_SECRET desincronizado tras redeploy.
 * Rocío + Mercedes pagaron sin que se aplicara premium. Detectado solo por
 * feedback al chat. Con esta regla + el Pass-2 del cron: detección y auto-fix
 * en ≤1h sin intervención humana.
 */
export const RULE_SUBSCRIPTION_DRIFT_MISSING_IN_DB: AlertRule<{
  detected: number;
  fixed: number;
}> = {
  name: 'subscription_drift_missing_in_db',
  severity: 'error',
  query: sql`
    SELECT
      COALESCE((metadata->>'detected')::int, 0) AS detected,
      COALESCE((metadata->>'fixed')::int, 0) AS fixed
    FROM observable_events
    WHERE event_type = 'subscription_drift_missing_in_db'
      AND ts > NOW() - INTERVAL '2 hours'
    ORDER BY ts DESC
    LIMIT 1
  `,
  shouldFire: (rows) => (rows[0]?.detected ?? 0) > 0,
  buildNotification: (rows) => {
    const r = rows[0];
    return {
      title: `${r.detected} pago(s) procesado(s) en Stripe sin sincronizar a BD (${r.fixed} auto-fix)`,
      body: `El cron de reconciliation Pass-2 detectó suscripciones active en Stripe que NO estaban en user_subscriptions de BD — significa que el WEBHOOK STRIPE está roto y usuarios pagan sin recibir premium.\n\nLas ${r.fixed} se han auto-corregido (INSERT user_subscriptions + UPDATE profile.plan_type=premium). El daño al usuario está mitigado.\n\nPERO el bug raíz (webhook) sigue: investigar /api/stripe/webhook URGENTE.\n\n  - Comprobar https://dashboard.stripe.com/webhooks → endpoint vence-produccion → ¿% de errores?\n  - Si signature failed: ver regla stripe_webhook_signature_failed (runbook para rotar secret).\n  - Si 4xx no-signature: ver stripe_webhook_4xx_burst.\n\nIncidente origen: 2026-05-27 (Rocío/Mercedes/Andrea).`,
      metadata: { detected: r.detected, fixed: r.fixed },
      fingerprint: 'subscription_drift_missing_in_db',
    };
  },
  cooldownMin: 30,
};

/**
 * Stripe webhook signature failed — disparo INMEDIATO (≥1 en 5 min, critical).
 *
 * Cada `Webhook signature verification failed` (HTTP 400 de /api/stripe/webhook)
 * significa que Stripe envía un evento, nuestro endpoint NO puede verificar la
 * firma, lo rechaza. Causa: STRIPE_WEBHOOK_SECRET incorrecto o desincronizado
 * con el dashboard de Stripe.
 *
 * Origen: incidente 2026-05-27 — tras un redeploy, el secret en SSM no se
 * actualizó. Stripe rechazó 59 eventos en 4h (incluidas 2 nuevas suscripciones
 * de Rocío y Mercedes, que pagaron y no se activaron). Detectado solo por
 * feedback manual al chat de soporte.
 *
 * Esta regla mira directamente validation_error_logs (escritura en tiempo
 * real desde el frontend ECS Fargate) en lugar de depender del cron
 * check-webhook-health (que llevaba 5h sin ejecutarse en el incidente
 * original). Detección en ≤5min, sin depender de ningún cron externo.
 *
 * Cualquier ocurrencia = pago potencial sin procesar = P1 inmediato.
 */
export const RULE_STRIPE_WEBHOOK_SIGNATURE_FAILED: AlertRule<{
  n: number;
  lastMsg: string | null;
}> = {
  name: 'stripe_webhook_signature_failed',
  severity: 'critical',
  query: sql`
    SELECT COUNT(*)::int AS n,
           (ARRAY_AGG(error_message ORDER BY created_at DESC))[1] AS "lastMsg"
    FROM validation_error_logs
    WHERE endpoint LIKE '%stripe/webhook%'
      AND error_message ILIKE '%signature verification failed%'
      AND created_at > NOW() - INTERVAL '5 minutes'
  `,
  shouldFire: (rows) => (rows[0]?.n ?? 0) > 0,
  buildNotification: (rows) => {
    const r = rows[0];
    return {
      title: `🚨 ${r.n} signature fail(s) en /api/stripe/webhook en 5 min — pagos sin procesar`,
      body: `Stripe está rechazando eventos por firma inválida. Cada evento rechazado puede ser un pago/suscripción que NO se está aplicando en BD.\n\nCAUSA TÍPICA: STRIPE_WEBHOOK_SECRET desincronizado entre SSM y el dashboard de Stripe (tras un redeploy o rotación manual).\n\nACCIONES:\n  1. https://dashboard.stripe.com/webhooks → endpoint vence-produccion → "Reveal signing secret"\n  2. aws ssm put-parameter --profile vence --region eu-west-2 \\\n       --name /vence-frontend/STRIPE_WEBHOOK_SECRET --value 'whsec_...' --type SecureString --overwrite\n  3. aws ecs update-service --profile vence --region eu-west-2 \\\n       --cluster vence-backend --service vence-frontend --force-new-deployment\n  4. Una vez OK, reenviar eventos fallidos desde el dashboard de Stripe.\n\nÚltimo error: ${r.lastMsg ?? '(n/a)'}\n\nIncidente origen: 2026-05-27 — caso Rocío Jodar/Mercedes Martínez.`,
      metadata: { count: r.n, lastMsg: r.lastMsg, windowMin: 5 },
      fingerprint: 'stripe_webhook_signature_failed',
    };
  },
  cooldownMin: 15,
};

/**
 * Stripe webhook 4xx burst — ≥5 errores 4xx en 10 min en /api/stripe/webhook.
 *
 * Complementa a `stripe_webhook_signature_failed` para detectar OTROS bugs
 * de validación: body roto, Content-Type inválido, schema cambiado en Stripe,
 * route handler en bug, etc.
 *
 * Excluye explícitamente "signature verification failed" para no duplicar
 * alertas con la regla específica de arriba (esa es critical instant,
 * ésta es error con cooldown más alto).
 */
export const RULE_STRIPE_WEBHOOK_4XX_BURST: AlertRule<{
  n: number;
  topError: string | null;
}> = {
  name: 'stripe_webhook_4xx_burst',
  severity: 'error',
  query: sql`
    SELECT COUNT(*)::int AS n,
           (ARRAY_AGG(error_message ORDER BY created_at DESC))[1] AS "topError"
    FROM validation_error_logs
    WHERE endpoint LIKE '%stripe/webhook%'
      AND http_status >= 400 AND http_status < 500
      AND error_message NOT ILIKE '%signature verification failed%'
      AND created_at > NOW() - INTERVAL '10 minutes'
  `,
  shouldFire: (rows) => (rows[0]?.n ?? 0) >= 5,
  buildNotification: (rows) => {
    const r = rows[0];
    return {
      title: `${r.n} errores 4xx (no-signature) en /api/stripe/webhook en 10 min`,
      body: `Burst de 4xx distintos de signature failed. Probable causa: shape de evento Stripe cambiado, validación de body en bug, route handler con regresión.\n\nÚltimo error: ${r.topError ?? '(n/a)'}\n\nInvestigar:\n  SELECT created_at, http_status, error_type, error_message\n  FROM validation_error_logs\n  WHERE endpoint LIKE '%stripe/webhook%' AND created_at > NOW() - INTERVAL '30 minutes'\n  ORDER BY created_at DESC LIMIT 30;`,
      metadata: { count: r.n, topError: r.topError, windowMin: 10 },
    };
  },
  cooldownMin: 30,
};

/**
 * Canary auth failed — el cron `canary-smoke-auth` (Fargate cada 5min, Nivel 3
 * del roadmap canary-y-simulaciones) ejecuta login + GET /api/profile contra
 * producción. Cualquier fallo es alarma critical inmediata.
 *
 * Hubiera cazado el incidente Rocío/Mercedes (2026-05-27) en ≤5 min,
 * sin depender del feedback humano.
 *
 * Cooldown 15 min para evitar spam si la regresión persiste; con 1 sola
 * ocurrencia ya dispara (sin agregación) porque cada fallo de auth en
 * producción es P1 por definición.
 */
export const RULE_CANARY_AUTH_FAILED: AlertRule<{
  n: number;
  lastStep: string | null;
  lastError: string | null;
  lastStatus: number | null;
}> = {
  name: 'canary_auth_failed',
  severity: 'critical',
  query: sql`
    SELECT COUNT(*)::int AS n,
           (ARRAY_AGG(metadata->>'step' ORDER BY created_at DESC))[1] AS "lastStep",
           (ARRAY_AGG(error_message ORDER BY created_at DESC))[1] AS "lastError",
           (ARRAY_AGG(http_status ORDER BY created_at DESC))[1] AS "lastStatus"
    FROM observable_events
    WHERE event_type = 'canary_auth_failed'
      AND created_at > NOW() - INTERVAL '10 minutes'
  `,
  shouldFire: (rows) => (rows[0]?.n ?? 0) > 0,
  buildNotification: (rows) => {
    const r = rows[0];
    return {
      title: `🚨 Canary auth en producción FALLÓ (${r.n} en 10 min) — flow login+profile roto`,
      body: `El canary HTTP autenticado (cron Fargate cada 5 min) detectó que el flow crítico login → GET /api/profile NO funciona en https://www.vence.es.\n\nESTO ES P1: cualquier usuario nuevo o existente que intente loguearse/ver su perfil ahora mismo está afectado. Mismo patrón que el incidente Rocío/Mercedes (27/05/2026) donde tardamos horas en darnos cuenta por feedback humano.\n\nÚltimo fallo:\n  - step: ${r.lastStep ?? '(n/a)'}\n  - http_status: ${r.lastStatus ?? '(n/a)'}\n  - error: ${r.lastError ?? '(n/a)'}\n\nACCIONES:\n  1. Verificar /admin/salud-sistema → SLO-05 (5xx user-facing).\n  2. Ver últimos deploys: Vercel + ECS vence-frontend.\n  3. Reproducir manualmente: curl POST /api/auth/login con smoke@vence.es.\n  4. Si reciente deploy → rollback Vercel (1 click) o ECS (force-new-deployment con task def anterior).\n  5. Logs Fargate del cron canary-smoke-auth para el step exacto.\n\nRoadmap canary: docs/roadmap/canary-y-simulaciones.md §Nivel 3.`,
      metadata: {
        count: r.n,
        lastStep: r.lastStep,
        lastError: r.lastError,
        lastStatus: r.lastStatus,
        windowMin: 10,
      },
      fingerprint: 'canary_auth_failed',
    };
  },
  cooldownMin: 15,
};

/**
 * Canary Stripe webhook failed — el cron `canary-stripe-webhook` (Fargate
 * cada 5 min, variante Nivel 3) envía evento sintético firmado al endpoint
 * /api/stripe/webhook real. Cualquier fallo = handler/signature/route roto.
 *
 * Cierra el gap del incidente Rocío/Mercedes (2026-05-27): el bug del
 * webhook tardó horas en detectarse porque solo se rompía con eventos
 * reales y no había canary sintético. Ahora: ≤5 min.
 *
 * Cooldown 15 min. Dispara con ≥1 evento en 10 min — cualquier fallo de
 * webhook es P1 (pagos sin procesar potencialmente).
 */
export const RULE_CANARY_WEBHOOK_FAILED: AlertRule<{
  n: number;
  lastStep: string | null;
  lastError: string | null;
  lastStatus: number | null;
}> = {
  name: 'canary_stripe_webhook_failed',
  severity: 'critical',
  query: sql`
    SELECT COUNT(*)::int AS n,
           (ARRAY_AGG(metadata->>'step' ORDER BY created_at DESC))[1] AS "lastStep",
           (ARRAY_AGG(error_message ORDER BY created_at DESC))[1] AS "lastError",
           (ARRAY_AGG(http_status ORDER BY created_at DESC))[1] AS "lastStatus"
    FROM observable_events
    WHERE event_type = 'canary_stripe_webhook_failed'
      AND created_at > NOW() - INTERVAL '10 minutes'
  `,
  shouldFire: (rows) => (rows[0]?.n ?? 0) > 0,
  buildNotification: (rows) => {
    const r = rows[0];
    return {
      title: `🚨 Canary Stripe webhook FALLÓ (${r.n} en 10 min) — pagos potencialmente sin procesar`,
      body: `El canary sintético detectó que /api/stripe/webhook NO procesa correctamente eventos firmados. Esto es exactamente el patrón del incidente Rocío/Mercedes (27/05/2026): si el webhook está roto, los pagos reales NO se sincronizarán en BD y los usuarios pagarán sin recibir premium.\n\nÚltimo fallo:\n  - step: ${r.lastStep ?? '(n/a)'}\n  - http_status: ${r.lastStatus ?? '(n/a)'}\n  - error: ${r.lastError ?? '(n/a)'}\n\nACCIONES:\n  1. Verificar handler vivo: curl https://www.vence.es/api/stripe/webhook → debe devolver 405 (Method Not Allowed para GET).\n  2. Si step='http' status=400: STRIPE_WEBHOOK_SECRET stale en SSM /vence-frontend/ — rotar como en el runbook stripe_webhook_signature_failed.\n  3. Si step='http' status=404: route eliminada del bundle Next.js — investigar últimos deploys del frontend.\n  4. Si step='http' status=5xx: bug en route handler — investigar logs Vercel.\n  5. Si step='sign': bug en el SDK Stripe del backend — verificar versión Stripe SDK.\n\nRoadmap: docs/roadmap/canary-y-simulaciones.md §Nivel 3 (variante webhook).`,
      metadata: {
        count: r.n,
        lastStep: r.lastStep,
        lastError: r.lastError,
        lastStatus: r.lastStatus,
        windowMin: 10,
      },
      fingerprint: 'canary_stripe_webhook_failed',
    };
  },
  cooldownMin: 15,
};

/**
 * Canary answer-save failed — el cron `canary-answer-save` ejecuta cada
 * 5 min POST sintético al endpoint más caliente de la app
 * (/api/v2/answer-and-save). Cualquier fallo = todos los users afectados
 * en este momento al responder preguntas.
 *
 * No dispara con `canary_answer_save_question_invalid` (warn — pregunta
 * canary retirada, accionable distinto).
 *
 * Cooldown 15 min. Dispara con ≥1 fallo en 10 min — endpoint crítico,
 * cualquier rotura es P1.
 */
export const RULE_CANARY_ANSWER_SAVE_FAILED: AlertRule<{
  n: number;
  lastStep: string | null;
  lastError: string | null;
  lastStatus: number | null;
}> = {
  name: 'canary_answer_save_failed',
  severity: 'critical',
  query: sql`
    SELECT COUNT(*)::int AS n,
           (ARRAY_AGG(metadata->>'step' ORDER BY created_at DESC))[1] AS "lastStep",
           (ARRAY_AGG(error_message ORDER BY created_at DESC))[1] AS "lastError",
           (ARRAY_AGG(http_status ORDER BY created_at DESC))[1] AS "lastStatus"
    FROM observable_events
    WHERE event_type = 'canary_answer_save_failed'
      AND created_at > NOW() - INTERVAL '10 minutes'
  `,
  shouldFire: (rows) => (rows[0]?.n ?? 0) > 0,
  buildNotification: (rows) => {
    const r = rows[0];
    return {
      title: `🚨 Canary answer-save FALLÓ (${r.n} en 10 min) — app inutilizable para responder preguntas`,
      body: `El canary detectó que POST /api/v2/answer-and-save NO procesa correctamente respuestas. Esto es P1: cada respuesta de cada user en cada test pasa por aquí. Si está roto, la app está inutilizable.\n\nÚltimo fallo:\n  - step: ${r.lastStep ?? '(n/a)'}\n  - http_status: ${r.lastStatus ?? '(n/a)'}\n  - error: ${r.lastError ?? '(n/a)'}\n\nACCIONES SEGÚN STEP:\n  - sign_token: SUPABASE_JWT_SECRET roto en el backend Fargate (raro).\n  - http 401/403: JwtGuard rechaza el JWT smoke → cambio en JwtVerifier (audience, algorithm).\n  - http 422: schema del request cambió → revisar lib/api/v2/answer-and-save/schemas.ts.\n  - http 5xx: bug en /api/v2/answer-and-save handler — investigar logs Vercel.\n  - http 503: load shedding activo (saturación BD/antifraud) — investigar /admin/salud-sistema.\n  - validate_response: handler devuelve 200 pero sin success=true → bug interno silencioso (PEOR caso).\n  - validate_latency: lentitud >15s — investigar conexiones BD / antifraud cache.\n\nRoadmap: docs/roadmap/canary-y-simulaciones.md §Nivel 3.`,
      metadata: {
        count: r.n,
        lastStep: r.lastStep,
        lastError: r.lastError,
        lastStatus: r.lastStatus,
        windowMin: 10,
      },
      fingerprint: 'canary_answer_save_failed',
    };
  },
  cooldownMin: 15,
};

/**
 * Canary database pool failed — `SELECT 1` con timeout 1s falla.
 * Significa saturación PgBouncer / max_connections agotados / BD caída.
 * Imposible cubrir en CI (es runtime puro bajo carga real).
 *
 * Cooldown 10min (más corto que los otros canarios — saturación de BD
 * es P0 y cada minuto extra de spam vale la pena para escalar).
 */
export const RULE_CANARY_DB_POOL_FAILED: AlertRule<{
  n: number;
  lastStep: string | null;
  lastError: string | null;
}> = {
  name: 'canary_db_pool_failed',
  severity: 'critical',
  query: sql`
    SELECT COUNT(*)::int AS n,
           (ARRAY_AGG(metadata->>'step' ORDER BY created_at DESC))[1] AS "lastStep",
           (ARRAY_AGG(error_message ORDER BY created_at DESC))[1] AS "lastError"
    FROM observable_events
    WHERE event_type = 'canary_db_pool_failed'
      AND created_at > NOW() - INTERVAL '10 minutes'
  `,
  shouldFire: (rows) => (rows[0]?.n ?? 0) > 0,
  buildNotification: (rows) => {
    const r = rows[0];
    return {
      title: `🚨 Canary DB pool FALLÓ (${r.n} en 10 min) — saturación PgBouncer o BD caída`,
      body: `SELECT 1 desde el backend Fargate NO completó en <1s. Significa una de:\n  - PgBouncer saturado (pool_size agotado, conexiones colgadas).\n  - max_connections de Postgres alcanzado.\n  - Postgres caído o sin red.\n  - Conexión Fargate→Supabase degradada.\n\nÚltimo fallo:\n  - step: ${r.lastStep ?? '(n/a)'}\n  - error: ${r.lastError ?? '(n/a)'}\n\nACCIONES:\n  1. Verificar /admin/salud-sistema → latencia INSERT.\n  2. Supabase Dashboard → Database → Pool size + active connections.\n  3. Si pool saturado: kill connections idle largas, bajar timeout, escalar PgBouncer.\n  4. Si BD caída: status.supabase.com + escalation a soporte.\n\nNO es bug de código — es bug operativo. App entera afectada.`,
      metadata: { count: r.n, lastStep: r.lastStep, lastError: r.lastError, windowMin: 10 },
      fingerprint: 'canary_db_pool_failed',
    };
  },
  cooldownMin: 10,
};

/**
 * Canary Redis Upstash failed — SET/GET/DEL ephemeral falla o devuelve
 * valor incorrecto. Significa caída de Upstash / cuota agotada / network.
 *
 * Si Redis cae, el cache compartido (user_stats, exam_pending, theme_stats)
 * deja de servir → cada user request va a BD → load 10× → 5xx cascada.
 *
 * Cooldown 10min — alta urgencia operativa.
 */
export const RULE_CANARY_REDIS_FAILED: AlertRule<{
  n: number;
  lastStep: string | null;
  lastError: string | null;
}> = {
  name: 'canary_redis_failed',
  severity: 'critical',
  query: sql`
    SELECT COUNT(*)::int AS n,
           (ARRAY_AGG(metadata->>'step' ORDER BY created_at DESC))[1] AS "lastStep",
           (ARRAY_AGG(error_message ORDER BY created_at DESC))[1] AS "lastError"
    FROM observable_events
    WHERE event_type = 'canary_redis_failed'
      AND created_at > NOW() - INTERVAL '10 minutes'
  `,
  shouldFire: (rows) => (rows[0]?.n ?? 0) > 0,
  buildNotification: (rows) => {
    const r = rows[0];
    return {
      title: `🚨 Canary Redis FALLÓ (${r.n} en 10 min) — Upstash caído, cascada BD inminente`,
      body: `SET/GET/DEL contra Upstash falló. Si Redis está caído:\n  - Cache compartido (user_stats, exam_pending, theme_stats) deja de servir.\n  - Cada user request va a BD directa → load 10×.\n  - Cascada: BD se satura → canary-db-pool dispara → 5xx generalizado.\n\nÚltimo fallo:\n  - step: ${r.lastStep ?? '(n/a)'}\n  - error: ${r.lastError ?? '(n/a)'}\n\nACCIONES:\n  1. https://console.upstash.com — verificar Redis OK + cuota.\n  2. Si caído: status Upstash + considerar bypass temporal del cache (fail-open ya hay en CacheService TIMEOUT_SYMBOL).\n  3. Si cuota: upgrade plan o purgar keys low-priority.\n  4. NO redeploy precipitado — la app tiene fail-open en cache; solo monitorizar latencia.\n\nstep=validate significa CORRUPCIÓN (SET un valor, GET devolvió otro) → bug raro pero crítico de Upstash.`,
      metadata: { count: r.n, lastStep: r.lastStep, lastError: r.lastError, windowMin: 10 },
      fingerprint: 'canary_redis_failed',
    };
  },
  cooldownMin: 10,
};

/**
 * Lista canónica de reglas activas. Añadir nuevas reglas aquí.
 * El cron las ejecuta TODAS cada 5 min.
 */
export const ALERT_RULES: AlertRule[] = [
  RULE_HTTP_5XX_SPIKE as AlertRule,
  RULE_CRON_OVERDUE as AlertRule,
  RULE_DEPLOY_FAILED as AlertRule,
  RULE_CRON_FAILURE_BURST as AlertRule,
  // Reglas Fase 1.6 (2026-05-26) — cierran loop de eventos nuevos
  RULE_RUNTIME_KILL as AlertRule,
  RULE_TTS_ERROR_BURST as AlertRule,
  RULE_HYDRATION_MISMATCH_SPIKE as AlertRule,
  RULE_WORKFLOW_FAILURE_BURST as AlertRule,
  // Subscription health (2026-05-26 post-incidente Andrea/Lidia)
  RULE_SUBSCRIPTION_DRIFT as AlertRule,
  RULE_WEBHOOK_UNHEALTHY as AlertRule,
  RULE_STRIPE_CHECKOUT_FAILED as AlertRule,
  // Cancel flow robusto (2026-05-27 post-caso Mariangeles)
  RULE_SUBSCRIPTION_VOID_FAILED as AlertRule,
  RULE_SUBSCRIPTION_FORCE_CANCEL_BURST as AlertRule,
  RULE_SUBSCRIPTION_CANCEL_ERROR_BURST as AlertRule,
  // Webhook entrante robusto (2026-05-27 post-caso Rocío/Mercedes)
  RULE_STRIPE_WEBHOOK_SIGNATURE_FAILED as AlertRule,
  RULE_STRIPE_WEBHOOK_4XX_BURST as AlertRule,
  RULE_SUBSCRIPTION_DRIFT_MISSING_IN_DB as AlertRule,
  // Salud del frontend desde server-side metrics (no depende del cliente)
  RULE_TRAFFIC_DROP as AlertRule,
  // Canary HTTP autenticado (2026-05-27, Nivel 3 sistema canary+simulaciones)
  RULE_CANARY_AUTH_FAILED as AlertRule,
  // Canary Stripe webhook sintético (2026-05-27, cierra gap incidente Rocío/Mercedes)
  RULE_CANARY_WEBHOOK_FAILED as AlertRule,
  // Canary endpoint más caliente (2026-05-27, POST /api/v2/answer-and-save)
  RULE_CANARY_ANSWER_SAVE_FAILED as AlertRule,
  // Canarios de INFRA externa (Sprint 5, 27/05/2026) — únicos no duplicados con CI
  RULE_CANARY_DB_POOL_FAILED as AlertRule,
  RULE_CANARY_REDIS_FAILED as AlertRule,
];
