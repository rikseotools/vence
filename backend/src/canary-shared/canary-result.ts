// canary-result.ts — Resultado UNIFORME de todo canary (synthetic probe).
//
// Hoy cada canary redeclara su propio union `{ok:true,...} | {skipped:true,...} |
// {ok:false,...}` (16 copias divergentes) y cada `.cron.ts` reimplementa el mismo
// `switch`→`emitFireAndForget`. Este tipo es la FUENTE ÚNICA de la forma del
// resultado: un discriminante `status` + helpers de construcción. La emisión a
// observabilidad se deriva de `status` de forma homogénea (ver canary-probe.ts),
// no a mano en cada cron.
//
// Diseño del framework: docs/roadmap/canary-framework.md (P1).

/**
 * Estado de una pasada de canary:
 * - `ok`       → todo correcto (info).
 * - `skipped`  → no ejecutado por falta de credenciales/fixture (warn, NO regresión).
 * - `failed`   → el invariante que vigila el canary se rompió (critical → dispara RULE_CANARY_*_FAILED).
 * - `invalid`  → deuda del propio canary (fixture roto), no del sistema vigilado (warn).
 */
export type CanaryStatus = 'ok' | 'skipped' | 'failed' | 'invalid';

export interface CanaryResult {
  readonly status: CanaryStatus;
  /** Duración de la pasada en ms (SIEMPRE presente, medido por el runner). */
  readonly durationMs: number;
  /** `failed`/`invalid`: en qué paso falló (p.ej. 'answer_save', 'db_verify'). */
  readonly step?: string;
  /** `skipped`: motivo (p.ej. 'credentials_not_configured', 'fixture_unavailable'). */
  readonly reason?: string;
  /** `failed`: mensaje de error legible. */
  readonly errorMessage?: string;
  /** HTTP status si el paso fue una llamada de red. */
  readonly httpStatus?: number;
  /** Contexto extra para la observabilidad (no PII). */
  readonly metadata?: Record<string, unknown>;
}

/** Severidad de observabilidad derivada del estado (mapeo único). */
export function severityForStatus(status: CanaryStatus): 'info' | 'warn' | 'critical' {
  switch (status) {
    case 'ok':
      return 'info';
    case 'failed':
      return 'critical';
    case 'skipped':
    case 'invalid':
      return 'warn';
  }
}

// ── Constructores (sin `durationMs`: lo sella el runner al cronometrar) ──
type Partial0<T> = Omit<T, 'durationMs' | 'status'>;

export const CanaryResults = {
  ok(extra: Partial0<CanaryResult> = {}): Omit<CanaryResult, 'durationMs'> {
    return { status: 'ok', ...extra };
  },
  skipped(reason: string, extra: Partial0<CanaryResult> = {}): Omit<CanaryResult, 'durationMs'> {
    return { status: 'skipped', reason, ...extra };
  },
  failed(step: string, errorMessage: string, extra: Partial0<CanaryResult> = {}): Omit<CanaryResult, 'durationMs'> {
    return { status: 'failed', step, errorMessage, ...extra };
  },
  invalid(step: string, errorMessage: string, extra: Partial0<CanaryResult> = {}): Omit<CanaryResult, 'durationMs'> {
    return { status: 'invalid', step, errorMessage, ...extra };
  },
};
