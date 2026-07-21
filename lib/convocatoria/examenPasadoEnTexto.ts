// Wrapper tipado sobre `examenPasadoEnTexto.cjs`. La lógica vive en el .cjs porque
// `scripts/health-sweep.cjs` la requiere con `node` pelado; aquí solo se le pone tipo para el
// resto de la app. Una sola fuente de verdad (misma convención que seguimientoUrlSalud).
//
// eslint-disable-next-line @typescript-eslint/no-var-requires
const impl = require('./examenPasadoEnTexto.cjs') as {
  examenPasadoPresentadoVigente: (texto: string, hoyIso: string) => DeteccionExamen[]
  detectarEnOposicion: (
    o: { landingDescription?: string | null; landingFaqs?: unknown },
    hoyIso: string,
  ) => DeteccionExamen[]
  extraerFechas: (txt: string) => Array<{ iso: string; idx: number }>
}

export interface DeteccionExamen {
  /** Fecha de examen detectada (ISO), anterior a hoy y presentada como vigente. */
  iso: string
  /** Fragmento de contexto donde aparece, para el hallazgo. */
  contexto: string
}

export const examenPasadoPresentadoVigente = impl.examenPasadoPresentadoVigente
export const detectarEnOposicion = impl.detectarEnOposicion
export const extraerFechas = impl.extraerFechas
