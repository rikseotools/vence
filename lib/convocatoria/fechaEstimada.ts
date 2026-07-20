/**
 * Fechas ESTIMADAS de hitos: la línea entre informar e inventar.
 *
 * ## El fallo que motiva esto (20/07/2026)
 *
 * Había **11 hitos marcados `upcoming` con la fecha ya pasada**. Siete de ellos tenían
 * `origen='estimacion'`: nadie los había publicado, la fecha nos la habíamos inventado
 * nosotros como marcador de posición. Sus propios títulos lo admitían — *"Examen (primer
 * ejercicio) - pendiente de fecha"*, *"Previsión 1er semestre 2026"*.
 *
 * El problema no era el dato en BD, que estaba correctamente etiquetado: **era el render, que
 * ignoraba `origen`**. La landing pintaba `formatDateCorta(hito.fecha)` sin mirar de dónde
 * salía esa fecha, así que el opositor veía "1 de junio de 2026" como fecha de su examen. Y
 * peor: ese mismo hito alimentaba el `startDate` de un `Event` de schema.org, o sea que la
 * fecha inventada se publicaba a Google como dato estructurado de un evento real.
 *
 * La columna `fecha_aproximada` existía para esto y **no la leía nadie** (solo un test). El
 * modelo de datos estaba bien; lo que faltaba era usarlo.
 *
 * ## La regla
 *
 * Un hito con fecha estimada puede (y debe) seguir en el timeline —informa de qué toca
 * después— pero **sin exhibir la fecha como si fuera oficial** y **sin salir en JSON-LD**.
 */

export interface HitoConFecha {
  fecha: string
  titulo: string
  status: string
  origen?: string | null
  fechaAproximada?: boolean | null
}

/** Etiqueta que sustituye a la fecha cuando no hay fuente oficial que la respalde. */
export const ETIQUETA_SIN_FECHA = 'Fecha por confirmar'

/**
 * ¿La fecha de este hito es una estimación nuestra en vez de un dato oficial?
 *
 * Acepta las dos señales porque conviven en BD: `origen='estimacion'` (la que usa el
 * scaffolder y los sensores) y `fecha_aproximada=true` (columna más antigua). Basta una.
 */
export function esFechaEstimada(hito: HitoConFecha): boolean {
  return hito.origen === 'estimacion' || hito.fechaAproximada === true
}

/**
 * Lo que se pinta en el timeline. Con fecha estimada NO se devuelve la fecha: se devuelve
 * `ETIQUETA_SIN_FECHA`. Da igual que la estimación sea futura o ya pasada — en ningún caso
 * es un dato que podamos presentar como cierto.
 */
export function etiquetaFechaHito(
  hito: HitoConFecha,
  formatear: (fecha: string) => string,
): string {
  return esFechaEstimada(hito) ? ETIQUETA_SIN_FECHA : formatear(hito.fecha)
}

/**
 * Elige el hito de examen que puede alimentar el `Event` de schema.org.
 *
 * Es MÁS estricto que el render: aquí no vale "avisar de que es estimada", porque un
 * `Event` con `startDate` es una afirmación categórica hacia buscadores y agregadores. Si la
 * fecha no viene de fuente oficial, sencillamente no se emite el Event.
 */
export function hitoParaSchemaEvent<T extends HitoConFecha>(
  hitos: readonly T[],
): T | null {
  return (
    hitos.find(
      (h) =>
        h.titulo.toLowerCase().includes('examen') &&
        h.status !== 'completed' &&
        !esFechaEstimada(h),
    ) ?? null
  )
}
