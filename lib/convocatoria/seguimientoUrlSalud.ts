// Wrapper tipado sobre `seguimientoUrlSalud.cjs`. La lógica vive en el .cjs porque
// `scripts/health-sweep.cjs` la requiere con `node` pelado; aquí solo se le pone tipo para el
// resto de la app. Una sola fuente de verdad (misma convención que lib/backlog/pushGuard).
//
// eslint-disable-next-line @typescript-eslint/no-var-requires
const impl = require('./seguimientoUrlSalud.cjs') as {
  diagnosticarSeguimientoUrl: (
    url: string | null | undefined,
    anioVigente: number | null | undefined,
    opts?: { procesoEnJuego?: boolean },
  ) => DiagnosticoUrl
}

export type NivelSaludUrl = 'ok' | 'stale_boletin' | 'posible_ciclo_viejo' | 'url_generica'

export interface DiagnosticoUrl {
  nivel: NivelSaludUrl
  /** Confianza en que la URL está DESFASADA. `error` para el caso limpio (boletín viejo) y para
   *  índice genérico cuando el proceso está VIVO (`procesoEnJuego`); el resto, warn. */
  severidad: 'error' | 'warn' | 'ok'
  motivo: string
}

export const diagnosticarSeguimientoUrl = impl.diagnosticarSeguimientoUrl
