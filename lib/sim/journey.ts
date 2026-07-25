// lib/sim/journey.ts
//
// Vence Sim — contrato de un JOURNEY. Un journey describe un escenario reproducible y sus
// invariantes; el runner (scripts/sim/run.ts) le inyecta un contexto con navegador + API +
// captura + faults. Las interfaces son PURAS (sin depender de Playwright) para que un
// journey se pueda razonar/testear con un contexto simulado.

import type { InvariantResult, SimFault, SimSeverity, SimIdentity } from './types'

/** Contexto que el runner entrega a un journey. Abstrae Playwright y la red. */
export interface JourneyCtx {
  readonly base: string
  /** oposición esperada cuando el journey corre autenticado (para invariantes de scope). */
  readonly positionType?: string
  /** navega a una ruta y espera carga. */
  goto(path: string): Promise<void>
  /** POST/GET a la API DESDE la sesión del navegador (la app resuelve el reto anti-scraping). */
  api(path: string, init?: { method?: string; body?: unknown }): Promise<{ status: number; json: any }>
  /** registra la última URL que casa un patrón (para invariantes de scope). */
  lastRequest(pattern: string): string | null
  /** inyecta un fallo (route interception) — debe llamarse ANTES del goto/acción afectada. */
  injectFault(fault: SimFault): Promise<void>
  /** captura de pantalla; devuelve la ruta del PNG. */
  screenshot(name: string): Promise<string>
  /** ¿está visible en el DOM un texto/heading? (heurística de UI) */
  seesText(re: RegExp): Promise<number>
  /** cuenta elementos por rol/nombre. */
  countRole(role: string, name: RegExp): Promise<number>
  /** acción libre sobre la página (escape hatch tipado laxo para no filtrar Playwright aquí). */
  page: any
  /** envuelve una acción como PASO con outcome (ok/screenshot/detail). */
  step<T>(name: string, fn: () => Promise<T>, opts?: { shot?: boolean }): Promise<T>
}

export interface Journey {
  name: string
  severity: SimSeverity
  /** identidad opcional (auth propia). Sin ella, corre anónimo. */
  as?: SimIdentity & { positionType?: string }
  /** ejecuta el escenario y devuelve las invariantes evaluadas. */
  run(ctx: JourneyCtx): Promise<InvariantResult[]>
}
