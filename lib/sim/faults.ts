// lib/sim/faults.ts
//
// Vence Sim — catálogo de FALLOS inyectables (fault injection / chaos). Puros descriptores
// + un aplicador sobre una "route" abstracta (Playwright-compatible pero sin depender de
// Playwright, para testear la lógica de decisión). El runner traduce estos descriptores a
// `context.route(...)`.

import type { SimFault } from './types'

export const faults = {
  networkAbort: (urlPattern: string, times = 1): SimFault => ({ kind: 'network_abort', urlPattern, times }),
  networkDown: (urlPattern: string): SimFault => ({ kind: 'network_down', urlPattern }),
  http500: (urlPattern: string, times = 1): SimFault => ({ kind: 'http_500', urlPattern, times }),
  latency: (urlPattern: string, ms: number): SimFault => ({ kind: 'latency', urlPattern, ms }),
  /** Un status/cuerpo concretos. Para reproducir rechazos con semántica (403 de identidad). */
  httpStatus: (urlPattern: string, status: number, body?: unknown, times = 99): SimFault => ({
    kind: 'http_status',
    urlPattern,
    status,
    body: body === undefined ? undefined : JSON.stringify(body),
    times,
  }),
}

/** Interfaz mínima de una route (subconjunto de Playwright Route) para poder testear. */
export interface AbstractRoute {
  abort(errorCode?: string): Promise<void> | void
  fulfill(opts: { status: number; body?: string; contentType?: string }): Promise<void> | void
  continue(): Promise<void> | void
}

/**
 * Devuelve un handler de route que aplica el fallo la(s) primera(s) vez(es) y deja pasar
 * el resto. Mantiene su propio contador (por eso devuelve una CLOSURE). PURO respecto a
 * la red: opera sobre AbstractRoute. `sleep` inyectable para no depender de timers reales.
 */
export function faultHandler(
  fault: SimFault,
  sleep: (ms: number) => Promise<void> = ms => new Promise(r => setTimeout(r, ms)),
) {
  let hits = 0
  return async (route: AbstractRoute): Promise<'aborted' | 'fulfilled' | 'delayed' | 'passed'> => {
    hits++
    switch (fault.kind) {
      case 'network_abort':
        if (hits <= fault.times) { await route.abort('failed'); return 'aborted' }
        await route.continue(); return 'passed'
      case 'network_down':
        await route.abort('failed'); return 'aborted'
      case 'http_500':
        if (hits <= fault.times) { await route.fulfill({ status: 500, body: 'injected 500' }); return 'fulfilled' }
        await route.continue(); return 'passed'
      case 'latency':
        await sleep(fault.ms); await route.continue(); return 'delayed'
      case 'http_status':
        if (hits <= fault.times) {
          // `contentType` importa: el cliente lee el cuerpo con `.json()` para sacar el
          // `reason`, y sin la cabecera lo descarta — el journey mediría entonces el caso
          // «403 sin reason», que es otro camino del código.
          await route.fulfill({ status: fault.status, body: fault.body, contentType: fault.body ? 'application/json' : undefined })
          return 'fulfilled'
        }
        await route.continue(); return 'passed'
    }
  }
}
