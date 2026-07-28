// Wrapper tipado sobre `enlaceOficial.cjs`. La lógica vive en el .cjs porque la requieren con
// `node` pelado el detector `linkCoherence.cjs` y los barridos; aquí solo se le pone tipo para la
// app y el backend. Una sola fuente de verdad (misma convención que `estadoCoherencia` y
// `seguimientoUrlSalud`).

// eslint-disable-next-line @typescript-eslint/no-var-requires
const impl = require('./enlaceOficial.cjs') as {
  ESTADOS_SIN_CONVOCATORIA: readonly string[]
  esOepSinConvocatoria: (estadoProceso: string | null | undefined) => boolean
  enlaceOficialEfectivo: (i: EnlaceOficialInput) => string | null
  rotuloEnlaceOficial: (i: { estadoProceso: string | null | undefined; diarioOficial?: string | null }) => string
}

export interface EnlaceOficialInput {
  /** `convocatorias.estado_proceso` del ciclo vigente (vía `oposiciones_ssot`). */
  estadoProceso: string | null | undefined
  /** URL del documento de la OEP vigente ya clonado en el hub, si lo hay. */
  enlaceOep: string | null | undefined
  /** `programa_url` legacy: enlace del botón cuando no aplica la vía OEP. */
  programaUrl: string | null | undefined
}

export const ESTADOS_SIN_CONVOCATORIA = impl.ESTADOS_SIN_CONVOCATORIA
export const esOepSinConvocatoria = impl.esOepSinConvocatoria
/** El enlace que la landing enseña REALMENTE en el botón oficial. */
export const enlaceOficialEfectivo = impl.enlaceOficialEfectivo
/** Lo que el botón dice literalmente ("Ver OEP en X" no promete la convocatoria). */
export const rotuloEnlaceOficial = impl.rotuloEnlaceOficial
