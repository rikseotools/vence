import { sql, type SQL } from 'drizzle-orm';
import type { CronScheduleService } from '../cron-schedule/cron-schedule.service';
import type { AlertNotification } from './notification-adapter';
import type { DeployWindow } from './deploy-window';

/**
 * Contexto inyectado a las reglas. Permite que una regla mezcle el
 * resultado de su query SQL con metadata derivada de otros servicios
 * (calendario de @Cron, etc.) sin tener que duplicar esa metadata en
 * un mapa hardcoded paralelo al código que la define.
 */
export interface AlertRuleContext {
  /**
   * Resuelve, para cada @Cron registrado en SchedulerRegistry, su tick
   * esperado anterior/siguiente a partir de la expresión declarada en el
   * decorador. Fuente única de verdad: si una regla necesita saber cuándo
   * debió ejecutarse un cron, lo pregunta aquí, no a un mapa duplicado.
   */
  cronSchedule: CronScheduleService;

  /**
   * Ventana de deploy/churn de infraestructura activa, calculada UNA vez
   * por tick por AlertsCron. Las reglas que vigilan estados transitorios
   * causados por deploys (pool_hung_clientread) la consultan para silenciar
   * falsos positivos durante un rolling, salvo señales de severidad alta.
   *
   * Opcional: si falta (tests sin ctx, callers legacy) se interpreta como
   * "sin deploy" → no se suprime nada (fail-open, alerta de más mejor que
   * silencio). NUNCA la consume `cron_overdue` — ver deploy-window.ts.
   */
  deployWindow?: DeployWindow;
}

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
   * Si devuelve false, no se envía nada. `ctx` se puede ignorar para
   * reglas SQL-only puras; las reglas que dependen de él deben validar
   * su presencia y lanzar si falta (invariante respetada por AlertsCron).
   */
  shouldFire: (rows: T[], ctx?: AlertRuleContext) => boolean;

  /** Construye el contenido de la notificación a enviar. */
  buildNotification: (
    rows: T[],
    ctx?: AlertRuleContext,
  ) => Omit<AlertNotification, 'rule' | 'severity'>;

  /**
   * Tiempo mínimo entre dos firings consecutivos de la misma regla.
   * Evita spam si la condición persiste.
   */
  cooldownMin: number;
}

/**
 * Invariante de runtime: una regla que declara que depende de `ctx`
 * (porque consume `cronSchedule` u otro servicio) DEBE recibirlo. Si el
 * caller (AlertsCron) lo omite por un bug, el fallo es ruidoso y nominal
 * (no silencioso ni difícil de diagnosticar).
 */
function assertContextualRule(
  ruleName: string,
  ctx: AlertRuleContext | undefined,
): asserts ctx is AlertRuleContext {
  if (!ctx) {
    throw new Error(
      `Regla '${ruleName}' requiere AlertRuleContext pero recibió undefined. ` +
        'Esto es un bug en el caller (alerts.cron o helper de tests); ' +
        'la regla NO debe asumir un default silencioso.',
    );
  }
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
 * Margen tras el tick esperado antes de considerar un cron overdue.
 *
 * Es proporcional al intervalo nominal del cron (next - prev) para que el
 * mismo umbral funcione tanto para crons cada 5 min como para crons
 * diarios o semanales. Un margen fijo de 30 min sería absurdamente
 * permisivo en crons frecuentes (6 ticks perdidos sin alertar) y
 * absurdamente estricto en crons semanales bajo jitter de scheduling.
 *
 * Bounded: nunca menos de 1 min (cubre la propagación a BD bajo carga) ni
 * más de 30 min (el cron más pesado del proyecto tarda ~3.4 s; cualquier
 * latencia >30 min es bug aparte de schedule overdue).
 */
const MIN_GRACE_MS = 60 * 1000;
const MAX_GRACE_MS = 30 * 60 * 1000;
const GRACE_FRACTION_OF_INTERVAL = 0.2;

function graceForJob(prevTick: Date, nextTick: Date): number {
  const intervalMs = nextTick.getTime() - prevTick.getTime();
  return Math.max(
    MIN_GRACE_MS,
    Math.min(MAX_GRACE_MS, intervalMs * GRACE_FRACTION_OF_INTERVAL),
  );
}

/**
 * Ventana mínima desde el primer tick esperado para empezar a vigilar un
 * cron que NUNCA emitió. Evita disparar durante el bootstrap (deploy
 * recién hecho, primer tick no completado todavía).
 */
const CRON_NEVER_OBSERVED_GRACE_MS = 60 * 60 * 1000;

interface OverdueEntry {
  name: string;
  expression: string;
  timeZone: string;
  prevExpectedTick: Date;
  nextExpectedTick: Date;
  lastActualRun: Date | null;
}

function findOverdueCrons(
  rows: Array<{ endpoint: string; lastTs: Date | string | null }>,
  ctx: AlertRuleContext,
  now: Date = new Date(),
): OverdueEntry[] {
  const lastByEndpoint = new Map<string, Date | null>();
  for (const row of rows) {
    const ts = row.lastTs;
    lastByEndpoint.set(
      row.endpoint,
      ts == null ? null : ts instanceof Date ? ts : new Date(ts),
    );
  }

  const overdue: OverdueEntry[] = [];
  const nowMs = now.getTime();

  for (const job of ctx.cronSchedule.listCronJobs(now)) {
    const prevMs = job.prevExpectedTick.getTime();
    const graceMs = graceForJob(job.prevExpectedTick, job.nextExpectedTick);

    if (nowMs - prevMs < graceMs) {
      // El tick acaba de pasar; aún dentro de la propagación. No se
      // puede juzgar todavía si el cron emitió o no.
      continue;
    }

    const lastRun = lastByEndpoint.get(job.name) ?? null;
    if (lastRun === null) {
      // Nunca observado en la ventana de la query. Silenciar hasta que el
      // primer tick esperado quede lo bastante atrás como para descartar
      // un bootstrap post-deploy.
      if (nowMs - prevMs < CRON_NEVER_OBSERVED_GRACE_MS) continue;
      overdue.push({
        name: job.name,
        expression: job.expression,
        timeZone: job.timeZone,
        prevExpectedTick: job.prevExpectedTick,
        nextExpectedTick: job.nextExpectedTick,
        lastActualRun: null,
      });
      continue;
    }

    if (lastRun.getTime() < prevMs - graceMs) {
      overdue.push({
        name: job.name,
        expression: job.expression,
        timeZone: job.timeZone,
        prevExpectedTick: job.prevExpectedTick,
        nextExpectedTick: job.nextExpectedTick,
        lastActualRun: lastRun,
      });
    }
  }
  return overdue;
}

/**
 * Cron registrado en `SchedulerRegistry` que NO emitió `cron_run` para su
 * tick esperado más reciente.
 *
 * Fuente de verdad del schedule: el propio decorador `@Cron(...)`, leído en
 * runtime a través de `CronScheduleService`. Cualquier cron nuevo entra en
 * la vigilancia automáticamente — sin mapas hardcoded que mantener.
 *
 * Cómo se evalúa cada cron:
 *   1. `cron-parser` resuelve `prevExpectedTick` (último tick que el
 *      schedule dice que debió ocurrir antes de NOW).
 *   2. La query SQL devuelve `MAX(ts)` del evento `cron_run` por endpoint
 *      en los últimos 60 días.
 *   3. Si `lastActualRun < prevExpectedTick - grace` → overdue.
 *   4. Si `prevExpectedTick > NOW - grace` → todavía dentro de la ventana
 *      en la que el tick podría no haberse propagado a BD.
 *   5. Si nunca tickeó en la ventana y el primer tick esperado fue hace
 *      menos de 1h → silencio (bootstrap post-deploy).
 *
 * Reemplaza al mapa `CRON_EXPECTED` + `isCronOverdue` previos, cuya
 * heurística `intervalMin * 2 + 30 min` fallaba cuando un cron se saltaba
 * dos ticks consecutivos (caso 31/05/2026: `detect-oep-llm` /
 * `detect-generic-sources` paralizados por el incidente outbox del 28-29/05,
 * lo que generaba alertas legítimas pero indistinguibles del bug de la
 * heurística).
 */
export const RULE_CRON_OVERDUE: AlertRule<{
  endpoint: string;
  lastTs: Date | string | null;
}> = {
  name: 'cron_overdue',
  severity: 'critical',
  query: sql`
    SELECT endpoint,
           MAX(ts) AS "lastTs"
    FROM observable_events
    WHERE event_type = 'cron_run'
      AND ts > NOW() - INTERVAL '60 days'
    GROUP BY endpoint
  `,
  shouldFire: (rows, ctx) => {
    assertContextualRule('cron_overdue', ctx);
    return findOverdueCrons(rows, ctx).length > 0;
  },
  buildNotification: (rows, ctx) => {
    assertContextualRule('cron_overdue', ctx);
    const overdue = findOverdueCrons(rows, ctx);
    const lines = overdue.map((e) => {
      const lastStr = e.lastActualRun
        ? e.lastActualRun.toISOString()
        : '(never observed in last 60d)';
      const graceMin = Math.round(
        graceForJob(e.prevExpectedTick, e.nextExpectedTick) / 60000,
      );
      return `  - ${e.name} ['${e.expression}' ${e.timeZone}, margen ${graceMin}min]\n      esperado: ${e.prevExpectedTick.toISOString()}\n      último real: ${lastStr}\n      próximo: ${e.nextExpectedTick.toISOString()}`;
    });
    return {
      title: `${overdue.length} cron${overdue.length > 1 ? 's' : ''} overdue`,
      body: `Los siguientes crons no emitieron "cron_run" para su tick esperado más reciente (margen proporcional al intervalo):\n\n${lines.join('\n\n')}\n\nVerificar ECS task vence-backend, CloudWatch Logs, o BD.`,
      metadata: {
        overdueCrons: overdue.map((e) => e.name),
      },
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
      -- Misma hora-del-día UTC + mismo DÍA-DE-SEMANA, últimos 28 días.
      -- Fix 30/05/2026: la versión anterior comparaba con cualquier día → en
      -- fin de semana disparaba falsos positivos "tráfico cayó 70%" porque la
      -- mediana incluía días laborables con más tráfico. Recibimos 11 alertas
      -- traffic_drop el sábado 30/05 entre 07-11 UTC. Comparar sábado vs
      -- sábados pasados elimina el ruido del weekend.
      SELECT date_trunc('hour', ts) AS hr, COUNT(*)::int AS n
      FROM observable_events
      WHERE event_type = 'request_completed'
        AND ts >= NOW() - INTERVAL '29 days'
        AND ts <  date_trunc('hour', NOW() - INTERVAL '1 hour')
        AND EXTRACT(HOUR FROM ts AT TIME ZONE 'UTC')
            = EXTRACT(HOUR FROM (NOW() - INTERVAL '1 hour') AT TIME ZONE 'UTC')
        AND EXTRACT(DOW FROM ts AT TIME ZONE 'UTC')
            = EXTRACT(DOW FROM (NOW() - INTERVAL '1 hour') AT TIME ZONE 'UTC')
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
 * Un fallo de canary cuyo error es un timeout/abort de red es, con UNA sola
 * ocurrencia, indistinguible de un blip transitorio: latencia puntual de
 * Upstash / Supavisor / Fargate↔Supabase que se auto-recupera al siguiente
 * tick. Con cadencia de 5 min, exigir 2 fallos en la ventana de 10 min = 2
 * ticks consecutivos = degradación SOSTENIDA, no blip. Mismo criterio que la
 * alarma CloudWatch Synthetics (`evaluation_periods = 2` en synthetics.tf).
 *
 * Un fallo SUSTANTIVO (HTTP 4xx/5xx con cuerpo, validación incorrecta, shape
 * roto) NO es transitorio → dispara INSTANTÁNEO con 1 sola ocurrencia: es un
 * bug real, no un hipo de red.
 *
 * Recalibrado 2026-06-03: los canaries auth/webhook/redis/topic-data emitían
 * 1 email CRITICAL por cada timeout suelto (datos 24h: 4/290 stripe, 1/290
 * redis, 1/290 topic-data, 3/290 auth — TODOS auto-recuperados al tick
 * siguiente) → spam que ahogaba los CRITICAL reales (filosofía martillo,
 * observability.md §20: "alarma no accionable = ruido"). `answer-save` y
 * `db-pool` NO usan este helper: siguen instantáneos con n≥1 porque app
 * inutilizable / saturación de BD = P0 y un solo fallo ya es accionable.
 */
const TRANSIENT_CANARY_ERROR =
  /timeout|abort|ETIMEDOUT|ECONNRESET|ECONNREFUSED|EAI_AGAIN|socket hang up|network|fetch failed/i;

function canaryFailureShouldFire(
  rows: Array<{ n: number; lastError: string | null }>,
): boolean {
  const r = rows[0];
  const n = r?.n ?? 0;
  if (n === 0) return false;
  if (n >= 2) return true; // 2+ fallos = 2 ticks consecutivos = sostenido
  // n === 1: un único fallo. Si es timeout/abort de red, esperar la
  // confirmación del siguiente tick (blip transitorio). Si es sustantivo
  // (4xx/5xx, validación, shape), disparar ya — es un bug real.
  return !TRANSIENT_CANARY_ERROR.test(r?.lastError ?? '');
}

/**
 * Canary auth failed — el cron `canary-smoke-auth` (Fargate cada 5min, Nivel 3
 * del roadmap canary-y-simulaciones) ejecuta login + GET /api/profile contra
 * producción. Cualquier fallo es alarma critical inmediata.
 *
 * Hubiera cazado el incidente Rocío/Mercedes (2026-05-27) en ≤5 min,
 * sin depender del feedback humano.
 *
 * Cooldown 15 min para evitar spam si la regresión persiste. Disparo vía
 * `canaryFailureShouldFire`: un fallo sustantivo (401/403/5xx con cuerpo)
 * dispara instantáneo (P1 real); un timeout/abort suelto espera la
 * confirmación del siguiente tick (blip de red auto-recuperable).
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
  shouldFire: (rows) => canaryFailureShouldFire(rows),
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
 * Cooldown 15 min. Disparo vía `canaryFailureShouldFire`: un fallo sustantivo
 * (400 signature, 404 route, 5xx) dispara instantáneo (pago en riesgo = P1);
 * un timeout/abort suelto espera el siguiente tick. Las firmas inválidas de
 * eventos Stripe REALES siguen cubiertas instantáneamente por la regla
 * hermana `stripe_webhook_signature_failed` (mira validation_error_logs).
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
  shouldFire: (rows) => canaryFailureShouldFire(rows),
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
 * Cooldown 10min — alta urgencia operativa. Disparo vía
 * `canaryFailureShouldFire`: corrupción/valor incorrecto (step=validate)
 * dispara instantáneo; un timeout suelto de Upstash espera el siguiente tick
 * (la app tiene fail-open en cache, 5 min extra no es catastrófico).
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
  shouldFire: (rows) => canaryFailureShouldFire(rows),
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
 * Watchdog de respuesta — burst de UI congeladas en ExamLayout/TestLayout.
 *
 * El hook `useAnswerWatchdog` (12s threshold) detecta cuando `isSaving`/
 * `processingAnswer` se queda en true >12s, indica UI congelada (API
 * `/api/exam/validate` o `/api/answer` colgada, tab en background con
 * timers throttled, conexión móvil débil) y resetea el estado +
 * registra un evento.
 *
 * Caso real 30/05/2026: 9 eventos en un día durante incidente cron-coincidence
 * (8 crons cada 5 min coincidían en mismo segundo, saturaban pool BD).
 * Durations vistas: hasta 308.109ms (5 minutos) con UI bloqueada.
 *
 * Pre-fix los eventos quedaban silenciosos en validation_error_logs sin
 * disparar alerta. Esta regla cierra ese gap.
 */
export const RULE_ANSWER_WATCHDOG_BURST: AlertRule<{
  n: number;
  maxDurationMs: number;
  uniqueUsers: number;
}> = {
  name: 'answer_watchdog_burst',
  severity: 'warn',
  query: sql`
    SELECT
      COUNT(*)::int AS n,
      MAX(duration_ms)::int AS "maxDurationMs",
      COUNT(DISTINCT user_id)::int AS "uniqueUsers"
    FROM public.validation_error_logs
    WHERE error_message ILIKE '%Watchdog%'
      AND created_at > NOW() - INTERVAL '30 minutes'
  `,
  shouldFire: (rows) => (rows[0]?.n ?? 0) >= 3,
  buildNotification: (rows) => {
    const n = rows[0]?.n ?? 0;
    const maxMs = rows[0]?.maxDurationMs ?? 0;
    const users = rows[0]?.uniqueUsers ?? 0;
    const maxSec = (maxMs / 1000).toFixed(1);
    return {
      title: `${n} watchdog event${n > 1 ? 's' : ''} de UI congelada últimos 30 min`,
      body: `${users} user(s) tuvieron la UI bloqueada en ExamLayout/TestLayout. Máxima duración: ${maxSec}s.\n\nCausas típicas:\n  1. Saturación pool BD → /api/exam/validate o /api/answer cuelgan\n  2. Tab en background con timers throttled (Chrome) → watchdog dispara tarde\n  3. Conexión móvil débil → timeout cliente 10s + retries 21s superan watchdog 12s\n\nInvestigar:\n  SELECT created_at, user_id, duration_ms, deploy_version\n  FROM validation_error_logs\n  WHERE error_message ILIKE '%Watchdog%'\n    AND created_at > NOW() - INTERVAL '1 hour'\n  ORDER BY created_at DESC;\n\nSi coincide con incidente de saturación BD → mirar /admin/observability ventana 1h.`,
      metadata: { count: n, maxDurationMs: maxMs, uniqueUsers: users, windowMin: 30 },
      fingerprint: 'answer_watchdog_burst',
    };
  },
  cooldownMin: 30,
};

/**
 * Canary topic-data failed — el cron `canary-topic-data` (Fargate cada 5 min,
 * Nivel 3 sintético) hace GET sintético a `/api/topics/[numero]` con shape
 * assertions. Cualquier fallo = el endpoint que sirve el contenido del tema
 * está roto en producción real (caída de Redis, BD, flag MV mal configurado,
 * MV stale, regresión de shape).
 *
 * Origen: 31/05/2026, post Fase D-bis Iter 1.5. Cubre el path Next.js + Redis
 * + BD + flag TOPIC_MV_ENABLED en runtime real, que ningún test CI puede
 * cubrir (regla de oro PASS).
 *
 * Cooldown 15 min. Disparo vía `canaryFailureShouldFire`: un fallo sustantivo
 * (503/5xx, parse, shape roto) dispara instantáneo; un timeout/abort de red
 * suelto espera la confirmación del siguiente tick (blip auto-recuperable).
 */
export const RULE_CANARY_TOPIC_DATA_FAILED: AlertRule<{
  n: number;
  lastStep: string | null;
  lastError: string | null;
  lastStatus: number | null;
}> = {
  name: 'canary_topic_data_failed',
  severity: 'critical',
  query: sql`
    SELECT COUNT(*)::int AS n,
           (ARRAY_AGG(metadata->>'step' ORDER BY created_at DESC))[1] AS "lastStep",
           (ARRAY_AGG(error_message ORDER BY created_at DESC))[1] AS "lastError",
           (ARRAY_AGG((metadata->>'httpStatus')::int ORDER BY created_at DESC))[1] AS "lastStatus"
    FROM observable_events
    WHERE event_type = 'canary_topic_data_failed'
      AND created_at > NOW() - INTERVAL '10 minutes'
  `,
  shouldFire: (rows) => canaryFailureShouldFire(rows),
  buildNotification: (rows) => {
    const r = rows[0];
    return {
      title: `🚨 Canary topic-data FALLÓ (${r.n} en 10 min) — endpoint /api/topics/[numero] roto`,
      body: `El canary sintético detectó que GET /api/topics/[numero] NO responde correctamente. Esto afecta a cualquier user que abra la página de un tema (catálogo + estadísticas).\n\nÚltimo fallo:\n  - step: ${r.lastStep ?? '(n/a)'}\n  - http_status: ${r.lastStatus ?? '(n/a)'}\n  - error: ${r.lastError ?? '(n/a)'}\n\nACCIONES SEGÚN STEP:\n  - http 503: pool BD saturado o withDbTimeout disparó. Mirar /admin/infraestructura.\n  - http 5xx (no 503): excepción en handler. Logs Vercel/ECS frontend.\n  - parse: el response no es JSON. Probable middleware emitiendo HTML 500.\n  - shape: response.success != true. Bug en getTopicFullData.\n  - shape_empty: totalQuestions=0 — MV corrupta o refresh falló. Forzar refresh con POST /api/v2/admin/topic-summary/refresh.\n  - shape_no_articles: articlesByLaw vacío — bug en MV agg o en topic_scope.\n  - validate_latency: > 8s sostenido. Probable saturación pool o flag MV inactivo cuando debería estar activo.\n\nRoadmap: docs/roadmap/canary-y-simulaciones.md §Nivel 3 sintético.\nFase D-bis Iter 1.5: docs/ARCHITECTURE_ROADMAP.md.`,
      metadata: {
        count: r.n,
        lastStep: r.lastStep,
        lastError: r.lastError,
        lastStatus: r.lastStatus,
        windowMin: 10,
      },
      fingerprint: 'canary_topic_data_failed',
    };
  },
  cooldownMin: 15,
};

/**
 * Watchdog wall-clock residual — detecta que el fix del 31/05/2026 (commit
 * `a4051a6b`, hook `useAnswerWatchdog` Page Visibility-aware) sigue
 * funcionando bien en TODOS los navegadores en producción.
 *
 * Pre-fix: ~80% de los watchdog events tenían duration_ms > 60s (Chrome
 * throttle setTimeout cuando la pestaña va a background; el contador wall
 * clock seguía subiendo y disparaba al volver con duraciones de 58 min).
 * Post-fix: durationMs reporta tiempo VISIBLE, debería ser <14s (12s
 * threshold + 2s grace).
 *
 * Si vemos >20% de events con dur>60s sostenido en 24h, hay una regresión
 * en algún navegador real (Safari, Firefox, mobile específico) donde la
 * Page Visibility API no se comporta como esperamos. Tests CI (JSDOM) no
 * lo detectan.
 *
 * Filtra por `deploy_version = current_deploy` para que el historial
 * pre-fix NO contamine el ratio (fix 31/05/2026 — primera versión sufría
 * falsos positivos porque la ventana 24h incluía events del hook viejo
 * de los deploys anteriores). Mismo patrón que health-check.md con 5xx.
 *
 * Severity warn (no critical) porque el fix YA mitigó el síntoma — esto
 * es trending. Cooldown 4h para no spamear.
 */
export const RULE_WATCHDOG_WALLCLOCK_RESIDUAL: AlertRule<{
  total: number;
  over60s: number;
  pctResidual: number;
}> = {
  name: 'watchdog_wallclock_residual',
  severity: 'warn',
  query: sql`
    WITH current_deploy AS (
      -- Deploy actual = el más frecuente entre eventos recientes en la
      -- misma tabla. Evita contar events de deploys anteriores donde
      -- el hook aún era wall-clock (ratio histórico siempre alto).
      SELECT deploy_version
      FROM validation_error_logs
      WHERE created_at > NOW() - INTERVAL '4 hours'
        AND deploy_version IS NOT NULL
      GROUP BY deploy_version
      ORDER BY COUNT(*) DESC
      LIMIT 1
    )
    SELECT
      COUNT(*) FILTER (WHERE vel.duration_ms > 60000)::int AS "over60s",
      COUNT(*)::int                                        AS total,
      COALESCE(
        ROUND(100.0 * COUNT(*) FILTER (WHERE vel.duration_ms > 60000) / NULLIF(COUNT(*), 0), 1),
        0
      )::numeric                                           AS "pctResidual"
    FROM public.validation_error_logs vel, current_deploy cd
    WHERE vel.error_message ILIKE '%Watchdog%'
      AND vel.created_at > NOW() - INTERVAL '24 hours'
      AND vel.deploy_version = cd.deploy_version
  `,
  shouldFire: (rows) => {
    const r = rows[0];
    if (!r) return false;
    return Number(r.total) >= 5 && Number(r.pctResidual) > 20;
  },
  buildNotification: (rows) => {
    const r = rows[0];
    return {
      title: `Watchdog residual wall-clock ${r.pctResidual}% (${r.over60s}/${r.total} > 60s)`,
      body: `El refactor 31/05/2026 (commit a4051a6b) Page Visibility-aware debía mantener este % en ~0%. Drift detectado:\n\n  - ${r.over60s} de ${r.total} watchdog events en últimas 24h reportan duration_ms > 60s.\n  - Pre-fix esto era esperado (Chrome tab-throttling). Post-fix NO debería pasar.\n\nProbables causas (en orden de frecuencia):\n  1. Safari no respeta el visibilitychange como Chrome — investigar User-Agent de los events afectados.\n  2. Mobile (iOS Safari) con suspensión agresiva del JS.\n  3. Edge case del hook donde lastTickRef no se reinicia tras un cambio de pestaña corto.\n\nInvestigar:\n  SELECT created_at, user_id, duration_ms, error_message,\n         metadata->>'userAgent' AS ua\n  FROM validation_error_logs\n  WHERE error_message ILIKE '%Watchdog%' AND duration_ms > 60000\n    AND created_at > NOW() - INTERVAL '24 hours'\n  ORDER BY duration_ms DESC LIMIT 20;`,
      metadata: { total: r.total, over60s: r.over60s, pctResidual: r.pctResidual, windowH: 24 },
      fingerprint: 'watchdog_wallclock_residual',
    };
  },
  // 4 horas — drift es trending, no incidente; no spamear.
  cooldownMin: 240,
};

// ════════════════════════════════════════════════════════════════════
// Pool capacity sampler (Acción 2 observability-capacity, 2026-06-01)
// ────────────────────────────────────────────────────────────────────
// El cron pool-capacity-sampler escribe en `pool_capacity_samples` cada
// minuto. Estas 4 reglas explotan esa data para detección granular de
// problemas en el pool DB ANTES de que se traduzcan en 5xx (leading
// indicator) y para garantizar que la pieza de observabilidad sigue viva.
// ════════════════════════════════════════════════════════════════════

/**
 * Zombie crítico: hay conexiones `idle in transaction` >5s desde un
 * cliente real (no autovacuum). Es la firma de Hipótesis B del roadmap
 * pool-segregation: `after()`/Stripe webhook retiene slot pool.
 *
 * Una sola muestra con esta bandera ya merece alerta — es un slot
 * perdido del pool max:8 que no se recupera hasta que el cliente cierre
 * la conexión o el `idle_in_transaction_session_timeout` (60s) actúe.
 */
export const RULE_POOL_IDLE_IN_TX_DETECTED: AlertRule<{
  n: number;
  lastAt: Date | string | null;
}> = {
  name: 'pool_idle_in_tx_detected',
  severity: 'critical',
  query: sql`
    SELECT COUNT(*)::int AS n,
           MAX(sample_at) AS "lastAt"
    FROM pool_capacity_samples
    WHERE sample_at > NOW() - INTERVAL '5 minutes'
      AND idle_in_tx_over_5s > 0
  `,
  shouldFire: (rows) => (rows[0]?.n ?? 0) >= 2,
  buildNotification: (rows) => {
    const n = rows[0]?.n ?? 0;
    return {
      title: `Pool: ${n} muestras con idle-in-transaction >5s en 5 min`,
      body:
        `Hay clientes manteniendo transacciones abiertas sin commit/rollback.\n` +
        `Firma típica de Hipótesis B (after()/Stripe webhook retiene slot).\n\n` +
        `Diagnóstico:\n` +
        `  SELECT pid, application_name, state, query, NOW()-state_change AS age\n` +
        `  FROM pg_stat_activity\n` +
        `  WHERE state='idle in transaction' AND NOW()-state_change > INTERVAL '5 seconds';\n\n` +
        `Si persiste >5 min, considerar pg_terminate_backend(pid) sobre el zombi.`,
      metadata: { samples: n, windowMin: 5 },
      fingerprint: 'pool_idle_in_tx',
    };
  },
  cooldownMin: 30,
};

/**
 * Conexiones colgadas en wait_event=ClientRead con state NO-IDLE >10s.
 * (ClientRead+idle es comportamiento normal y se excluye del filtro
 * a nivel SQL en `take_pool_capacity_sample`).
 *
 * Esto indica:
 *   - Cliente cerró TCP sin commit/abort (Supavisor blip, kill -9 del task).
 *   - O autovacuum/worker en estado raro con ClientRead — improbable
 *     porque filtramos backend_type='client backend'.
 *
 * Deploy-aware (diagnóstico 2026-06-01): en cada rolling deploy del frontend,
 * el task viejo cierra TCP sin commit al morir → 1-2 conexiones quedan en
 * ClientRead ~2-3 min → la regla disparaba un email CRITICAL por deploy
 * (ruido). Si hay ventana de deploy activa (ver `ctx.deployWindow`), se
 * silencia SALVO que el recuento de conn-min colgadas supere
 * `POOL_HUNG_DEPLOY_OVERRIDE_CONNMIN` — eso ya no es el goteo de un rolling
 * sino saturación real (ej. el pico de 14 conn-min visto el 2026-06-01
 * 07:49) y debe alertar aunque haya deploy.
 *
 * Piso de conn-min siempre-activo (recalibrado 2026-06-03): incluso FUERA de
 * deploy hay un goteo permanente de 1-2 conexiones hung en ClientRead, con
 * `frontend_active_conns = 0` — NO es el pool postgres-js del frontend, sino
 * el residual del path `getDb()` (escritura/auth) que aún cuelga del Supavisor
 * regional (raíz conocida en [[project_supavisor_zombie_conn_root_cause]],
 * Capa 2 pendiente, se cierra del todo con RDS). A 1-2 conns es inofensivo,
 * pero disparaba un email CRITICAL cada 30 min (cooldown) → spam que ahogaba
 * los CRITICAL reales. El piso exige acumulación real: una cascada (caso
 * 27/05) satura múltiples conns durante minutos = decenas de conn-min, muy por
 * encima del piso, y además la cubren en paralelo `canary_db_pool` (SELECT 1
 * timeout, instantáneo), `pool_frontend_saturation` y `5xx_spike`.
 */
const POOL_HUNG_DEPLOY_OVERRIDE_CONNMIN = 5;
const POOL_HUNG_MIN_CONNMIN = 10;

export const RULE_POOL_HUNG_CLIENTREAD_DETECTED: AlertRule<{
  n: number;
  totalHung: number;
}> = {
  name: 'pool_hung_clientread_detected',
  severity: 'critical',
  query: sql`
    SELECT COUNT(*)::int AS n,
           COALESCE(SUM(hung_clientread_over_10s), 0)::int AS "totalHung"
    FROM pool_capacity_samples
    WHERE sample_at > NOW() - INTERVAL '5 minutes'
      AND hung_clientread_over_10s > 0
  `,
  shouldFire: (rows, ctx) => {
    const n = rows[0]?.n ?? 0;
    const totalHung = rows[0]?.totalHung ?? 0;
    if (n < 2) return false;
    // Piso siempre-activo: por debajo de POOL_HUNG_MIN_CONNMIN es el goteo
    // residual del path getDb() (front_active=0), no accionable. Ver doc arriba.
    if (totalHung < POOL_HUNG_MIN_CONNMIN) return false;
    // Durante un deploy, el goteo de 1-2 conexiones colgadas es ruido
    // esperado del rolling. Se silencia salvo recuento alto (saturación
    // real). Sin ventana de deploy (o ctx ausente) → siempre alerta.
    if (
      ctx?.deployWindow?.active &&
      totalHung < POOL_HUNG_DEPLOY_OVERRIDE_CONNMIN
    ) {
      return false;
    }
    return true;
  },
  buildNotification: (rows, ctx) => {
    const n = rows[0]?.n ?? 0;
    const total = rows[0]?.totalHung ?? 0;
    const deployNote = ctx?.deployWindow?.active
      ? `\n\n⚠️ Deploy/churn en curso (${ctx.deployWindow.reasons.join('; ')}), ` +
        `pero ${total} conn-min colgadas supera el umbral ` +
        `${POOL_HUNG_DEPLOY_OVERRIDE_CONNMIN} → no es solo goteo del rolling.`
      : '';
    return {
      title: `Pool: ${n} muestras con conexiones colgadas en ClientRead (${total} conn-min)`,
      body:
        `Conexiones cliente en estado active/idle-in-tx con wait_event=ClientRead\n` +
        `durante >10s. Firma típica de cliente que cerró TCP sin\n` +
        `commit/abort, o Supavisor blip (Hipótesis A pool-segregation).\n\n` +
        `Diagnóstico:\n` +
        `  SELECT pid, application_name, state, wait_event, NOW()-state_change AS age\n` +
        `  FROM pg_stat_activity\n` +
        `  WHERE wait_event='ClientRead' AND state IN ('active','idle in transaction')\n` +
        `    AND NOW()-state_change > INTERVAL '10 seconds';` +
        deployNote,
      metadata: {
        samples: n,
        totalHungConnMin: total,
        windowMin: 5,
        deployWindowActive: ctx?.deployWindow?.active ?? false,
      },
      fingerprint: 'pool_hung_clientread',
    };
  },
  cooldownMin: 30,
};

/**
 * Saturación alta del pool del frontend. Con 2 tasks Fargate × max:8
 * en createPoolerDbClient (post-Fase 1), el techo lógico es 16. Si
 * sostenidamente vemos >=13 conexiones activas (~81%), estamos cerca
 * del techo y el siguiente burst puede tirar el endpoint.
 *
 * Cooldown 15 min — saturación sostenida es un patrón que justifica
 * notificar más rápido que zombis ocasionales.
 */
export const RULE_POOL_FRONTEND_SATURATION_HIGH: AlertRule<{
  maxActive: number;
  samples: number;
}> = {
  name: 'pool_frontend_saturation_high',
  severity: 'warn',
  query: sql`
    SELECT
      COALESCE(MAX(frontend_active_conns), 0)::int AS "maxActive",
      COUNT(*)::int AS samples
    FROM pool_capacity_samples
    WHERE sample_at > NOW() - INTERVAL '5 minutes'
      AND frontend_active_conns >= 13
  `,
  shouldFire: (rows) => (rows[0]?.samples ?? 0) >= 3,
  buildNotification: (rows) => {
    const samples = rows[0]?.samples ?? 0;
    const max = rows[0]?.maxActive ?? 0;
    return {
      title: `Pool frontend saturación alta: ${samples} muestras con ≥13 conns activas (pico ${max})`,
      body:
        `El pool postgres-js del frontend (2 tasks × max:8 = 16 techo)\n` +
        `lleva ${samples} muestras de los últimos 5 min cerca del techo.\n` +
        `Si sube más, próximo burst de tráfico = 503 cascada.\n\n` +
        `Considerar:\n` +
        `  - Subir desiredCount: 2 → 3 (escalar horizontal).\n` +
        `  - Investigar qué endpoint consume conexiones más tiempo:\n` +
        `    SELECT endpoint, AVG(duration_ms), COUNT(*)\n` +
        `    FROM observable_events\n` +
        `    WHERE event_type='request_completed' AND ts > NOW()-INTERVAL '15 min'\n` +
        `    GROUP BY endpoint ORDER BY 2 DESC LIMIT 10;`,
      metadata: { samples, peakActiveConns: max, ceilingEstimate: 16 },
      fingerprint: 'pool_saturation',
    };
  },
  cooldownMin: 15,
};

/**
 * El cron pool-capacity-sampler NO ha emitido muestra en >3 min.
 * Sin sampler vivo, perdemos el leading indicator → ceguera operativa.
 *
 * Esta regla es meta-observabilidad: vigila al vigilante.
 */
export const RULE_POOL_SAMPLER_STALE: AlertRule<{
  lastAt: Date | string | null;
  ageMin: number;
}> = {
  name: 'pool_sampler_stale',
  severity: 'critical',
  query: sql`
    SELECT
      MAX(sample_at) AS "lastAt",
      EXTRACT(EPOCH FROM (NOW() - MAX(sample_at)))::int / 60 AS "ageMin"
    FROM pool_capacity_samples
  `,
  shouldFire: (rows) => {
    const ageMin = Number(rows[0]?.ageMin ?? 0);
    return ageMin > 3 || rows[0]?.lastAt == null;
  },
  buildNotification: (rows) => {
    const lastAt = rows[0]?.lastAt;
    const ageMin = Number(rows[0]?.ageMin ?? 0);
    return {
      title: `Pool capacity sampler MUERTO: última muestra hace ${ageMin} min`,
      body:
        `El cron pool-capacity-sampler debería emitir cada 1 min pero NO\n` +
        `lo hace desde ${lastAt ?? '(nunca)'}.\n\n` +
        `Pérdida de leading indicator del pool. Investigar:\n` +
        `  - Logs CloudWatch del backend Fargate (¿cron crasheó?)\n` +
        `  - /health/crons (¿registrado?)\n` +
        `  - Si el container está vivo: reiniciar el service ECS.\n\n` +
        `Mientras tanto: vuelta al script ad-hoc capture-pool-pressure.cjs.`,
      metadata: { lastAt: lastAt ? String(lastAt) : null, ageMin },
      fingerprint: 'pool_sampler_stale',
    };
  },
  cooldownMin: 60,
};

/**
 * Canary del GATE anti-scraping (Turnstile). Se dispara post-deploy vía
 * POST /api/v2/canary/run-questions-gate. Si el gate retara a un usuario normal
 * (regresión en la policy/contador Redis), el canary emite este evento.
 */
export const RULE_CANARY_QUESTIONS_GATE_FAILED: AlertRule<{
  n: number;
  lastStep: string | null;
  lastError: string | null;
  lastStatus: number | null;
}> = {
  name: 'canary_questions_gate_failed',
  severity: 'critical',
  query: sql`
    SELECT COUNT(*)::int AS n,
           (ARRAY_AGG(metadata->>'step' ORDER BY created_at DESC))[1] AS "lastStep",
           (ARRAY_AGG(error_message ORDER BY created_at DESC))[1] AS "lastError",
           (ARRAY_AGG(http_status ORDER BY created_at DESC))[1] AS "lastStatus"
    FROM observable_events
    WHERE event_type = 'canary_questions_gate_failed'
      AND created_at > NOW() - INTERVAL '15 minutes'
  `,
  shouldFire: (rows) => (rows[0]?.n ?? 0) > 0,
  buildNotification: (rows) => {
    const r = rows[0];
    return {
      title: `🚨 Canary gate anti-scraping FALLÓ (${r.n}) — cargar preguntas roto`,
      body:
        `El canary post-deploy detectó que cargar preguntas como usuario NORMAL no ` +
        `funciona correctamente. Esto afecta al estudio de todos los usuarios.\n\n` +
        `Último fallo:\n  - step: ${r.lastStep ?? '(n/a)'}\n  - http_status: ${r.lastStatus ?? '(n/a)'}\n  - error: ${r.lastError ?? '(n/a)'}\n\n` +
        `ACCIONES SEGÚN STEP:\n` +
        `  - gate_disabled: el gate está APAGADO en prod (enabled=false). Causa típica:\n` +
        `    site key NO horneada (build-arg sin ARG/ENV en Dockerfile) o CAPTCHA_ENABLED\n` +
        `    /secret ausente en SSM. El banco NO está protegido. Revisar /api/security/captcha/status.\n` +
        `  - gate_false_positive (403): el gate Turnstile reta a usuarios que NO superan el umbral.\n` +
        `    Regresión en lib/security/challengePolicy/questionsServed o verifyHumanChallenge.\n` +
        `    MITIGACIÓN INMEDIATA: SSM /vence-frontend/CAPTCHA_ENABLED=false + redeploy frontend.\n` +
        `  - request (5xx): el endpoint /api/questions/filtered cae. Logs frontend ECS.\n` +
        `  - validate_body: 200 pero sin preguntas. Fetcher/BD/scope roto.\n` +
        `  - validate_latency: >12s. Pool BD saturado.\n\n` +
        `Contexto: gate anti-scraping (caso Ana Fernández 02/06). Doc reembolsos.md.`,
      metadata: {
        count: r.n,
        lastStep: r.lastStep,
        lastError: r.lastError,
        lastStatus: r.lastStatus,
        windowMin: 15,
      },
      fingerprint: 'canary_questions_gate_failed',
    };
  },
  cooldownMin: 15,
};

/**
 * Scraping / barrido del banco de preguntas.
 *
 * Detecta cuentas (incluido premium, que NO tiene límite diario) que se sirven
 * cientos de preguntas en una ventana corta SIN responderlas — la firma del que
 * usa la plataforma para descargar el banco, no para estudiar.
 *
 * Discriminador empírico (30d, ventana 2h): un alumno intenso real responde lo
 * que se le sirve (ratio respondidas 25-100%); el scraper deja ~0%. El umbral
 * cruza p999 de servidas (454) con un ratio bajo para no marcar estudiones:
 *   - servidas >= 300 en 2h  (p99=227, p999=454)
 *   - Y ratio respondidas < 15%  (legítimos >25%, scraper <5%)
 * Se excluyen admins (user_roles). Caso origen: Ana Fernández 02/06/2026
 * (617 tests/18d, picos de 2.500 servidas/2h al 0% respondidas, "scrape & refund").
 *
 * Detecta sobre `test_questions` directamente (una fila por pregunta servida con
 * user_id+created_at+user_answer) → sin instrumentación nueva. 'BLANK' es el valor
 * literal que escribe el modo examen para una pregunta saltada (no cuenta como respondida).
 */
export const RULE_SCRAPING_SWEEP: AlertRule<{
  userId: string;
  email: string | null;
  planType: string | null;
  served: number;
  answered: number;
}> = {
  name: 'scraping_sweep',
  severity: 'critical',
  query: sql`
    WITH sweep AS (
      SELECT
        tq.user_id,
        COUNT(*)::int AS served,
        COUNT(*) FILTER (
          WHERE tq.user_answer IS NOT NULL
            AND tq.user_answer <> ''
            AND tq.user_answer <> 'BLANK'
        )::int AS answered
      FROM public.test_questions tq
      WHERE tq.created_at > NOW() - INTERVAL '2 hours'
        AND tq.user_id IS NOT NULL
        AND tq.user_id NOT IN (
          SELECT user_id FROM public.user_roles
          WHERE role = 'admin' AND is_active = true
        )
      GROUP BY tq.user_id
      HAVING COUNT(*) >= 300
         AND COUNT(*) FILTER (
               WHERE tq.user_answer IS NOT NULL
                 AND tq.user_answer <> ''
                 AND tq.user_answer <> 'BLANK'
             )::float / NULLIF(COUNT(*), 0) < 0.15
    )
    SELECT
      s.user_id AS "userId",
      s.served,
      s.answered,
      p.email,
      p.plan_type AS "planType"
    FROM sweep s
    LEFT JOIN public.user_profiles p ON p.id = s.user_id
    ORDER BY s.served DESC
  `,
  shouldFire: (rows) => rows.length > 0,
  buildNotification: (rows) => {
    const lines = rows.map((r) => {
      const pct =
        r.served > 0 ? ((r.answered / r.served) * 100).toFixed(1) : '0.0';
      const who = r.email ?? (r.userId ?? '?').slice(0, 8);
      return `  - ${who} [${r.planType ?? '?'}]: ${r.served} servidas / ${r.answered} respondidas (${pct}%)`;
    });
    return {
      title: `Posible scraping del banco: ${rows.length} cuenta(s) con barrido masivo`,
      body:
        `${rows.length} cuenta(s) se han servido >=300 preguntas en 2h respondiendo <15% ` +
        `— firma de descarga del banco, no de estudio:\n\n` +
        `${lines.join('\n')}\n\n` +
        `Premium NO tiene límite diario, así que esto es la única red. Revisar en\n` +
        `/admin/fraudes y decidir (denegar reembolso de garantía, marcar admin_notes,\n` +
        `degradar/limitar). Procedimiento: docs/procedures/reembolsos.md + caso Ana 02/06.`,
      metadata: {
        userIds: rows.map((r) => r.userId),
        topServed: rows[0]?.served ?? 0,
        count: rows.length,
      },
      fingerprint: `scraping_sweep:${rows.map((r) => r.userId).sort().join(',')}`,
    };
  },
  // ≈ cada 2 horas: el engine corre cada 5 min, pero tras disparar se silencia 120 min.
  cooldownMin: 120,
};

/**
 * Gap 17 (2026-06-03, post-incidente email de Eva) — fallo silencioso de
 * notificación de impugnación. Lee el evento `invariant_violation` que emite el
 * cron `dispute-email-reconciliation` cuando una impugnación quedó resuelta pero
 * el email al usuario NO se envió (ni se intentó). Hace accionable lo que antes
 * era invisible: el usuario cree que le ignoramos.
 */
export const RULE_DISPUTE_EMAIL_DROP: AlertRule<{ realDrops: number }> = {
  name: 'dispute_email_drop',
  severity: 'error',
  query: sql`
    SELECT COALESCE(MAX((metadata->>'realDrops')::int), 0) AS "realDrops"
    FROM observable_events
    WHERE event_type = 'invariant_violation'
      AND metadata->>'invariant' = 'dispute_resolved_without_email'
      AND ts > NOW() - INTERVAL '90 minutes'
  `,
  shouldFire: (rows) => (rows[0]?.realDrops ?? 0) > 0,
  buildNotification: (rows) => ({
    title: `${rows[0]?.realDrops ?? 0} impugnación(es) resuelta(s) SIN email al usuario`,
    body:
      'El reconciliador detectó impugnaciones cerradas con respuesta cuyo email ' +
      'nunca salió (el usuario cree que le ignoramos). Revisar observable_events ' +
      "con event_type='invariant_violation' (sample con disputeId) y reenviar.",
    metadata: { realDrops: rows[0]?.realDrops ?? 0 },
  }),
  cooldownMin: 60,
};

/**
 * Lista canónica de reglas activas. Añadir nuevas reglas aquí.
 * El cron las ejecuta TODAS cada 5 min.
 */
/**
 * Conversiones de venta que NO llegaron a Google Ads: filas en DLQ (status
 * 'failed', agotaron 5 reintentos) o atascadas en 'pending' más de 6h. Señal
 * típica: refresh token de Google Ads caducado, API de Ads caída, o config rota.
 * Es dinero de atribución que se pierde EN SILENCIO si nadie lo ve — sin esto,
 * el sistema de conversiones podría dejar de subir ventas durante días sin que
 * nos enteremos. F1 trackeo-conversiones-ventas (03/06/2026).
 */
export const RULE_CONVERSION_DELIVERY_FAILED: AlertRule<{
  failed: number;
  stuck: number;
  lostEur: number;
}> = {
  name: 'conversion_delivery_failed',
  severity: 'error',
  query: sql`
    SELECT
      COUNT(*) FILTER (WHERE status = 'failed' AND created_at > NOW() - INTERVAL '48 hours')::int AS failed,
      COUNT(*) FILTER (WHERE status = 'pending' AND created_at < NOW() - INTERVAL '6 hours')::int AS stuck,
      COALESCE(SUM(value_cents) FILTER (WHERE status = 'failed' AND created_at > NOW() - INTERVAL '48 hours'), 0)::float / 100 AS "lostEur"
    FROM conversion_outbox
  `,
  shouldFire: (rows) => (rows[0]?.failed ?? 0) > 0 || (rows[0]?.stuck ?? 0) > 0,
  buildNotification: (rows) => {
    const failed = rows[0]?.failed ?? 0;
    const stuck = rows[0]?.stuck ?? 0;
    const lost = rows[0]?.lostEur ?? 0;
    return {
      title: `Conversiones sin llegar a Google Ads — ${failed} en DLQ, ${stuck} atascadas`,
      body:
        `${failed} conversiones agotaron reintentos (DLQ, ~${lost}€ de atribución perdida) ` +
        `y ${stuck} llevan >6h pendientes.\n\n` +
        `Causa típica: refresh token de Google Ads caducado, API caída, o credenciales rotas.\n\n` +
        `  SELECT id, status, retry_count, last_error FROM conversion_outbox\n` +
        `  WHERE status IN ('failed','pending') ORDER BY created_at;`,
      metadata: { failed, stuck, lostEur: lost },
      fingerprint: 'conversion_delivery_failed',
    };
  },
  cooldownMin: 120,
};

/**
 * Materialized-stats freshness — detecta que el pipeline outbox→tablas
 * materializadas se ha PARADO EN SILENCIO mientras sigue entrando tráfico.
 *
 * Caso origen 2026-06-03: el cutover de outbox se aplicó a medias (RENAME
 * shadow→canónica hecho ~02:03, pero los flags CUTOVER_DONE/SHADOW_HANDLERS_
 * ENABLED nunca se desplegaron al task def). Resultado: 5 tablas materializadas
 * (uqh_v2, article/difficulty/daily/hourly stats) dejaron de escribirse durante
 * 14h SIN una sola alerta, mientras test_questions seguía llenándose. Lo reportó
 * una usuaria ("el histórico de intentos está fallando"), no la observabilidad.
 * Esta regla cierra ese gap: habría disparado a los ~20 min.
 *
 * Lógica: si hay volumen real de respuestas recientes (pipeline claramente
 * activo) pero la última escritura de una tabla materializada es más vieja que
 * su SLO de lag → CRITICAL. El umbral de volumen (≥30 en 30 min) evita falsos
 * positivos en valle nocturno. ESCALABLE: añadir una tabla materializada nueva
 * = una línea en el VALUES del registro `reg` + una en el UNION de `mat`.
 */
export const RULE_MATERIALIZED_STATS_STALE: AlertRule<{
  table: string;
  lagMin: number;
}> = {
  name: 'materialized_stats_stale',
  severity: 'critical',
  query: sql`
    WITH src AS (
      SELECT COUNT(*)::int AS n, MAX(created_at) AS last_answer
      FROM test_questions
      WHERE created_at > NOW() - INTERVAL '30 minutes'
    ),
    reg(tbl, max_lag_min) AS (
      VALUES
        ('user_question_history_v2', 20),
        ('user_article_stats', 20),
        ('user_difficulty_stats', 20),
        ('user_daily_stats', 20),
        ('user_hourly_stats', 20),
        ('user_stats_summary', 20)
    ),
    mat AS (
      SELECT 'user_question_history_v2' AS tbl, MAX(updated_at) AS last_upd FROM user_question_history_v2
      UNION ALL SELECT 'user_article_stats', MAX(updated_at) FROM user_article_stats
      UNION ALL SELECT 'user_difficulty_stats', MAX(updated_at) FROM user_difficulty_stats
      UNION ALL SELECT 'user_daily_stats', MAX(updated_at) FROM user_daily_stats
      UNION ALL SELECT 'user_hourly_stats', MAX(updated_at) FROM user_hourly_stats
      UNION ALL SELECT 'user_stats_summary', MAX(updated_at) FROM user_stats_summary
    )
    SELECT r.tbl AS table,
           ROUND(EXTRACT(EPOCH FROM (NOW() - m.last_upd)) / 60)::int AS "lagMin"
    FROM reg r
    JOIN mat m ON m.tbl = r.tbl
    CROSS JOIN src
    WHERE src.n >= 30
      AND m.last_upd < NOW() - (r.max_lag_min * INTERVAL '1 minute')
    ORDER BY "lagMin" DESC
  `,
  shouldFire: (rows) => rows.length > 0,
  buildNotification: (rows) => {
    const lines = rows.map((r) => `  - ${r.table}: ${r.lagMin} min sin actualizar`);
    return {
      title: `${rows.length} tabla(s) materializada(s) congelada(s) — pipeline de stats parado`,
      body:
        `Entra volumen real de respuestas en test_questions pero estas tablas\n` +
        `materializadas no se actualizan (lag > 20 min):\n\n${lines.join('\n')}\n\n` +
        `El pipeline outbox→handlers se ha parado. Causas típicas:\n` +
        `  - Flags del cutover sin desplegar tras un task def nuevo\n` +
        `    (SHADOW_HANDLERS_ENABLED / CUTOVER_DONE ausentes en vence-backend).\n` +
        `  - Handlers del outbox-processor erroring (DLQ con error_message).\n` +
        `  - Triggers analíticos desactivados sin escritor de relevo.\n\n` +
        `Diagnóstico:\n` +
        `  SELECT COUNT(*) FILTER (WHERE processed_at IS NULL) AS pending,\n` +
        `         COUNT(*) FILTER (WHERE retry_count>=3 AND processed_at IS NULL) AS dlq\n` +
        `  FROM test_questions_outbox;\n` +
        `  aws ecs describe-task-definition ... | grep -E 'CUTOVER_DONE|SHADOW_HANDLERS'\n\n` +
        `Incidente origen 2026-06-03: cutover outbox a medias, 5 tablas congeladas\n` +
        `14h sin alerta (lo reportó una usuaria, no la observabilidad).`,
      metadata: {
        staleTables: rows.map((r) => r.table),
        maxLagMin: Math.max(...rows.map((r) => r.lagMin)),
      },
      fingerprint: `materialized_stats_stale_${rows.map((r) => r.table).sort().join(',')}`,
    };
  },
  cooldownMin: 30,
};

/**
 * Materialized-stats CORRECTNESS — complementa a la regla de frescura. La
 * frescura caza "la tabla no se escribe"; ésta caza "se escribe MAL" (valores
 * incorrectos / propagación incompleta), que es un fallo distinto y más sutil.
 *
 * Por qué hace falta además del cron de drift existente: durante el incidente
 * del 03/06 el `check_stats_drift` NO registró NADA en 7 días pese a 14h de
 * valores congelados → su detección de correctitud tiene un punto ciego. Esta
 * regla es una paridad EN VIVO y barata (36ms): para las claves (user,pregunta)
 * respondidas hace 5-20 min (margen suficiente para que el handler async
 * propague), `uqh_v2.total_attempts` DEBE igualar el conteo real en
 * test_questions. Si no, la propagación está rota o escribe mal.
 *
 * uqh_v2 es el proxy (sin claves NULL, el más visible al usuario — fue lo que
 * reportó Nila). Si propaga bien, el resto del pipeline también; si diverge,
 * es señal de fallo del handler. Umbral ≥5 para absorber fuzz de lag puntual.
 */
export const RULE_STATS_PARIDAD_DIVERGENCE: AlertRule<{ divergent: number }> = {
  name: 'stats_paridad_divergence',
  severity: 'error',
  query: sql`
    WITH recent_keys AS (
      SELECT DISTINCT user_id, question_id
      FROM test_questions
      WHERE created_at BETWEEN NOW() - INTERVAL '20 minutes' AND NOW() - INTERVAL '5 minutes'
        AND question_id IS NOT NULL AND is_correct IS NOT NULL
    ),
    expected AS (
      SELECT k.user_id, k.question_id, COUNT(*)::int AS real_total
      FROM recent_keys k
      JOIN test_questions tq
        ON tq.user_id = k.user_id AND tq.question_id = k.question_id AND tq.is_correct IS NOT NULL
      WHERE EXISTS (SELECT 1 FROM questions q WHERE q.id = k.question_id)
      GROUP BY k.user_id, k.question_id
    )
    SELECT COUNT(*) FILTER (
             WHERE u.user_id IS NULL OR u.total_attempts IS DISTINCT FROM e.real_total
           )::int AS divergent
    FROM expected e
    LEFT JOIN user_question_history_v2 u USING (user_id, question_id)
  `,
  shouldFire: (rows) => (rows[0]?.divergent ?? 0) >= 5,
  buildNotification: (rows) => {
    const n = rows[0]?.divergent ?? 0;
    return {
      title: `${n} divergencias uqh_v2 vs test_questions — el pipeline de stats escribe MAL`,
      body:
        `Hay ${n} claves (user,pregunta) respondidas hace 5-20 min cuyo\n` +
        `user_question_history_v2.total_attempts NO coincide con el conteo real\n` +
        `en test_questions. Con 5 min de margen la propagación async ya debería\n` +
        `estar hecha → o el handler no propaga o calcula mal.\n\n` +
        `A diferencia de la frescura (tabla parada), esto es "escribe valores\n` +
        `incorrectos". El cron de drift no lo cazó (punto ciego, incidente 03/06).\n\n` +
        `Diagnóstico:\n` +
        `  - test_questions_outbox: ¿DLQ o errores de handler?\n` +
        `  - Comparar un user concreto: COUNT(test_questions) por pregunta vs\n` +
        `    su fila en user_question_history_v2.\n` +
        `  - Revisar deploys recientes del outbox-processor / handlers.`,
      metadata: { divergent: n, windowMin: '5-20', table: 'user_question_history_v2' },
      fingerprint: 'stats_paridad_divergence',
    };
  },
  cooldownMin: 30,
};

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
  // Gap 17 (2026-06-03 post-incidente Eva) — impugnación resuelta sin email al usuario
  RULE_DISPUTE_EMAIL_DROP as AlertRule,
  // Conversiones de venta que no llegan a Google Ads (03/06/2026, F1 trackeo-
  // conversiones-ventas) — red de seguridad ante token Ads caducado / DLQ.
  RULE_CONVERSION_DELIVERY_FAILED as AlertRule,
  // Salud del frontend desde server-side metrics (no depende del cliente)
  RULE_TRAFFIC_DROP as AlertRule,
  // Watchdog de UI congelada (2026-05-31, cierra gap detectado en incidente 30/05)
  RULE_ANSWER_WATCHDOG_BURST as AlertRule,
  // Canary HTTP autenticado (2026-05-27, Nivel 3 sistema canary+simulaciones)
  RULE_CANARY_AUTH_FAILED as AlertRule,
  // Canary Stripe webhook sintético (2026-05-27, cierra gap incidente Rocío/Mercedes)
  RULE_CANARY_WEBHOOK_FAILED as AlertRule,
  // Canary endpoint más caliente (2026-05-27, POST /api/v2/answer-and-save)
  RULE_CANARY_ANSWER_SAVE_FAILED as AlertRule,
  // Canarios de INFRA externa (Sprint 5, 27/05/2026) — únicos no duplicados con CI
  RULE_CANARY_DB_POOL_FAILED as AlertRule,
  RULE_CANARY_REDIS_FAILED as AlertRule,
  // Canary endpoint topic-data (31/05/2026, post Fase D-bis Iter 1.5)
  RULE_CANARY_TOPIC_DATA_FAILED as AlertRule,
  // Watchdog drift detector — confirma que Page Visibility fix (a4051a6b) sigue ok
  RULE_WATCHDOG_WALLCLOCK_RESIDUAL as AlertRule,
  // Pool capacity sampler (01/06/2026, Acción 2 observability-capacity):
  // leading indicators del pool DB ANTES de que se traduzcan en 5xx.
  RULE_POOL_IDLE_IN_TX_DETECTED as AlertRule,
  RULE_POOL_HUNG_CLIENTREAD_DETECTED as AlertRule,
  RULE_POOL_FRONTEND_SATURATION_HIGH as AlertRule,
  // Meta-observabilidad: vigila al vigilante (cron sampler vivo).
  RULE_POOL_SAMPLER_STALE as AlertRule,
  // Pipeline de stats materializadas congelado (2026-06-03 post-cutover outbox a medias)
  RULE_MATERIALIZED_STATS_STALE as AlertRule,
  // Pipeline de stats escribe valores incorrectos (paridad en vivo uqh_v2 vs test_questions)
  RULE_STATS_PARIDAD_DIVERGENCE as AlertRule,
  // Anti-scraping: barrido masivo del banco de preguntas (02/06/2026, caso Ana
  // Fernández "scrape & refund"). Premium no tiene límite diario → única red.
  RULE_SCRAPING_SWEEP as AlertRule,
  // Canary post-deploy del gate anti-scraping: que NO bloquee a usuarios normales.
  RULE_CANARY_QUESTIONS_GATE_FAILED as AlertRule,
];
