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

/**
 * Lista canónica de reglas activas. Añadir nuevas reglas aquí.
 * El cron las ejecuta TODAS cada 5 min.
 */
export const ALERT_RULES: AlertRule[] = [
  RULE_HTTP_5XX_SPIKE as AlertRule,
  RULE_CRON_OVERDUE as AlertRule,
  RULE_DEPLOY_FAILED as AlertRule,
  RULE_CRON_FAILURE_BURST as AlertRule,
];
