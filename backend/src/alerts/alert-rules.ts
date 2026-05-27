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
  // Salud del frontend desde server-side metrics (no depende del cliente)
  RULE_TRAFFIC_DROP as AlertRule,
];
