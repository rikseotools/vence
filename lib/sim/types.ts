// lib/sim/types.ts
//
// Vence Sim — tipos del harness de simulación de bugs. Un "journey" es un escenario
// reproducible (los pasos que da un usuario/cliente) que se ejecuta contra el app VIVO
// por API y/o navegador (Playwright), con inyección de fallos y aserción de INVARIANTES
// de dominio. El objetivo: cazar clases de bug que la observabilidad pasiva no ve
// (percepción del usuario, fallos de red del cliente, incoherencias UI↔estado).
//
// Este módulo es PURO (sin red, sin Playwright): solo el modelo de datos + helpers, para
// que la lógica de decisión (invariantes, veredicto, payload de observabilidad) sea
// testeable sin montar navegador ni tocar producción.

/** Severidad de un journey (para priorizar y para el mapeo a observabilidad). */
export type SimSeverity = 'critical' | 'high' | 'medium' | 'low'

/** Identidad con la que corre un journey. `null` = anónimo. */
export interface SimIdentity {
  userId: string
  email: string
  /** solo informativo para el reporte (p.ej. la oposición esperada). */
  label?: string
}

/** Un fallo inyectado durante el journey (fault injection / chaos). */
export type SimFault =
  | { kind: 'network_abort'; urlPattern: string; times: number } // abortar las N primeras llamadas
  | { kind: 'network_down'; urlPattern: string }                 // abortar TODAS (offline sostenido)
  | { kind: 'http_500'; urlPattern: string; times: number }      // responder 500
  | { kind: 'latency'; urlPattern: string; ms: number }          // añadir latencia

/** Resultado de evaluar UNA invariante de dominio. */
export interface InvariantResult {
  name: string
  ok: boolean
  /** detalle accionable cuando falla (inputs → qué salió mal). */
  detail?: string
}

/** Un paso ejecutado (para el reporte/trazabilidad). No lo produce el core puro. */
export interface StepOutcome {
  step: string
  ok: boolean
  screenshot?: string // ruta del PNG capturado
  detail?: string
}

/** Resultado completo de un journey (lo consume el reporte + observabilidad). */
export interface SimResult {
  journey: string
  severity: SimSeverity
  identity: SimIdentity | null
  startedAt: string
  finishedAt: string
  durationMs: number
  steps: StepOutcome[]
  invariants: InvariantResult[]
  /** true si TODAS las invariantes pasaron y ningún paso reventó. */
  passed: boolean
  /** primer motivo de fallo (para el resumen/alerta). */
  firstFailure?: string
  error?: string // excepción no controlada durante la ejecución
}

/** Deriva `passed` + `firstFailure` de forma determinista (PURO, testeado). */
export function verdictOf(
  steps: StepOutcome[],
  invariants: InvariantResult[],
  error?: string,
): Pick<SimResult, 'passed' | 'firstFailure'> {
  if (error) return { passed: false, firstFailure: `error: ${error}` }
  const stepFail = steps.find(s => !s.ok)
  if (stepFail) return { passed: false, firstFailure: `step "${stepFail.step}": ${stepFail.detail ?? 'falló'}` }
  const invFail = invariants.find(i => !i.ok)
  if (invFail) return { passed: false, firstFailure: `invariante "${invFail.name}": ${invFail.detail ?? 'violada'}` }
  return { passed: true }
}
