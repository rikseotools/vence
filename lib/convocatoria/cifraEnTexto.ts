// Wrapper tipado sobre `cifraEnTexto.cjs`. La lógica vive en el .cjs porque la requieren
// `scripts/audit-convocatoria-completitud.cjs` y `scripts/health-sweep.cjs` con `node` pelado; aquí
// solo se le pone tipo para la app y los tests. Una sola fuente de verdad (misma convención que
// `estadoCoherencia` y `seguimientoUrlSalud`).

// eslint-disable-next-line @typescript-eslint/no-var-requires
const impl = require('./cifraEnTexto.cjs') as {
  enLetra: (n: number) => string | null
  cifraEnTexto: (n: number | null | undefined, texto: string | null | undefined) => boolean
  esPlazaHuerfana: (fila: FilaPlazas) => boolean
}

/** Fila de `convocatorias` + su corpus documental, con lo mínimo para juzgar si la cifra está probada. */
export interface FilaPlazas {
  plazas_libres?: number | null
  /** Concatenación del `extracted_text` de todos los documentos de la convocatoria. */
  corpus?: string | null
  docs?: number
  /** `convocatoria_verification` en `verified_correct` con la clave `cifra_derivada` en `findings`. */
  derivada_declarada?: boolean | null
}

/** Escribe un entero en letra, como lo escriben los boletines («mil treinta»). */
export const enLetra = impl.enLetra

/**
 * ¿Aparece la cifra en el texto en alguna de sus formas (1030 · 1.030 · «mil treinta»)?
 * Condición NECESARIA de que el documento la pruebe, no suficiente.
 */
export const cifraEnTexto = impl.cifraEnTexto

/** ¿Cifra de plazas afirmada como hecho sin ningún documento que la contenga? */
export const esPlazaHuerfana = impl.esPlazaHuerfana
