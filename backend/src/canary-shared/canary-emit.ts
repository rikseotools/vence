// canary-emit.ts — Construcción PURA de los eventos de observabilidad de un canary.
//
// Centraliza el `switch`→emitFireAndForget que hoy está copiado en los ~16 `.cron.ts`.
// Puro (sin NestJS, sin I/O) → testeable al 100%: se asertan los strings exactos que
// escuchan las reglas de alerta, de modo que migrar un canary al contrato NO puede
// cambiar su event-type/severity/endpoint en silencio.

import { ObservableEvent } from '../observability/observability.service';
import { CanaryProbe, canaryEventType } from './canary-probe';
import { CanaryResult, severityForStatus } from './canary-result';

/** `canary-<name>` — endpoint + `metadata.cron` (idéntico a lo que emiten los crons hoy). */
export function canaryEndpoint(name: string): string {
  return `canary-${name}`;
}

/**
 * Evento del RESULTADO del canary: `canary_<eventBase>_<status>` con la severidad
 * derivada del estado. metadata lleva `cron` siempre, y `step`/`reason` solo si existen
 * (para que un `ok` emita `{cron}` a secas, como hoy).
 */
export function canaryOutcomeEvent(
  probe: Pick<CanaryProbe, 'name' | 'eventBase'>,
  result: CanaryResult,
): ObservableEvent {
  const endpoint = canaryEndpoint(probe.name);
  const metadata: Record<string, unknown> = { cron: endpoint };
  if (result.step !== undefined) metadata.step = result.step;
  if (result.reason !== undefined) metadata.reason = result.reason;
  if (result.metadata) Object.assign(metadata, result.metadata);
  return {
    source: 'fargate',
    severity: severityForStatus(result.status),
    eventType: canaryEventType(probe.eventBase, result.status),
    endpoint,
    durationMs: result.durationMs,
    ...(result.errorMessage !== undefined ? { errorMessage: result.errorMessage } : {}),
    metadata,
  };
}

/** Evento de liveness `cron_run` (info al completar, error al petar) — idéntico a hoy. */
export function cronRunEvent(
  name: string,
  durationMs: number,
  status: 'completed' | 'failure',
  errorMessage?: string,
): ObservableEvent {
  const endpoint = canaryEndpoint(name);
  return {
    source: 'fargate',
    severity: status === 'completed' ? 'info' : 'error',
    eventType: 'cron_run',
    endpoint,
    durationMs,
    ...(errorMessage !== undefined ? { errorMessage } : {}),
    metadata: { cron: endpoint, status },
  };
}
