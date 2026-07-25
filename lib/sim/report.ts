// lib/sim/report.ts
//
// Vence Sim — REPORTE + puente a OBSERVABILIDAD. Convierte un SimResult en (a) un resumen
// humano legible y (b) el payload de un evento `observable_events` para que cada corrida
// del harness sea visible y alertable (mismo principio que el resto del sistema: si algo
// falla, la observabilidad lo sabe). PURO.

import type { SimResult, SimSeverity } from './types'

/** Severidad del evento de observabilidad según el veredicto + criticidad del journey. */
export function eventSeverityFor(result: SimResult): 'info' | 'warn' | 'error' {
  if (result.passed) return 'info'
  const bump: Record<SimSeverity, 'warn' | 'error'> = {
    critical: 'error', high: 'error', medium: 'warn', low: 'warn',
  }
  return bump[result.severity]
}

/** Payload listo para emitFireAndForget / la tabla observable_events. */
export function toObservabilityEvent(result: SimResult) {
  return {
    source: 'vercel' as const, // el runner corre fuera del request; 'vercel' = writer genérico
    severity: eventSeverityFor(result),
    eventType: 'sim_journey_result' as const,
    endpoint: `/sim/${result.journey}`,
    metadata: {
      journey: result.journey,
      severity: result.severity,
      passed: result.passed,
      firstFailure: result.firstFailure ?? null,
      identity: result.identity?.label ?? (result.identity ? 'user' : 'anon'),
      durationMs: result.durationMs,
      invariants: result.invariants.map(i => ({ name: i.name, ok: i.ok })),
      failedInvariants: result.invariants.filter(i => !i.ok).map(i => i.name),
      steps: result.steps.length,
    },
  }
}

/** Resumen de una línea (para logs/CLI/GitHub Actions summary). */
export function oneLineSummary(result: SimResult): string {
  const icon = result.passed ? '✅' : '❌'
  const who = result.identity?.label ?? (result.identity ? result.identity.email : 'anon')
  const tail = result.passed ? `${result.invariants.length} invariantes ok` : result.firstFailure
  return `${icon} [${result.severity}] ${result.journey} (${who}) — ${tail} · ${result.durationMs}ms`
}

/** Resumen multi-journey (para el veredicto del canary). */
export function suiteSummary(results: SimResult[]) {
  const failed = results.filter(r => !r.passed)
  return {
    total: results.length,
    passed: results.length - failed.length,
    failed: failed.length,
    ok: failed.length === 0,
    lines: results.map(oneLineSummary),
    failures: failed.map(r => ({ journey: r.journey, severity: r.severity, reason: r.firstFailure })),
  }
}
