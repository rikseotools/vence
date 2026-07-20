// lib/oposiciones/inscripcion.ts
//
// FUENTE DE VERDAD ÚNICA de "inscripción abierta hoy".
//
// Principio (incidente 20/06): la apertura de inscripción NO es un estado que se
// guarda — se DERIVA de las fechas en el momento de leer. Cualquier campo guardado
// (estado_proceso) puede quedar desfasado porque el tiempo avanza solo y nada
// reescribe el estado en el instante exacto en que vence el plazo. Derivarlo de las
// fechas con la fecha de HOY es correcto siempre, automáticamente, sin cron y sin
// posibilidad de drift. Antes la caja del home y la página SEO filtraban por
// estado_proceso (mostraban convocatorias vencidas / se contradecían con el banner).
//
// La usan las 3 superficies: home (app/page.tsx), SEO (/oposiciones/inscripcion-abierta)
// y banner (/api/v2/banner/open-inscriptions). Así es IMPOSIBLE que difieran.

/** Hoy en Europa/Madrid como 'YYYY-MM-DD'. NO usar toISOString (da UTC: en
 *  madrugada UTC devolvería "ayer" en Madrid y cerraría/abriría un día antes). */
export function todayMadrid(): string {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Madrid' })
}

export interface InscripcionFechas {
  inscription_start: string | null
  inscription_deadline: string | null
}

/**
 * Inscripción abierta hoy = tiene fecha de inicio Y de cierre, y `today` cae dentro
 * del intervalo [inicio, cierre] (ambos inclusive). Comparación lexicográfica de
 * 'YYYY-MM-DD' = comparación cronológica. Sin ambas fechas → NO abierta (dato
 * incompleto; lo flaguea el audit, no se muestra).
 */
export function isInscripcionAbierta(
  o: InscripcionFechas,
  today: string = todayMadrid(),
): boolean {
  const start = o.inscription_start?.slice(0, 10)
  const deadline = o.inscription_deadline?.slice(0, 10)
  if (!start || !deadline) return false
  return start <= today && deadline >= today
}

export interface ConvocatoriaDisplay extends InscripcionFechas {
  /** publicada (true) = tenemos landing/tests; catalogada (false) = aún sin tests */
  is_active: boolean
  /** URL de la convocatoria oficial (a la que enlaza una catalogada) */
  seguimiento_url: string | null
}

/**
 * ¿Se muestra esta convocatoria en las superficies de "inscripción abierta" (home + SEO)?
 * - PUBLICADA abierta-por-fechas → sí (enlaza interno, tiene tests).
 * - CATALOGADA abierta-por-fechas CON url oficial → sí ("sin test todavía", enlaza oficial).
 * - Catalogada sin url → no (no hay a dónde enlazar y el dato suele ser menos fiable).
 * Decisión producto 20/06. Mantener esta función como ÚNICA puerta de inclusión.
 */
export function isOpenForDisplay(o: ConvocatoriaDisplay, today: string = todayMadrid()): boolean {
  if (!isInscripcionAbierta(o, today)) return false
  return o.is_active || !!o.seguimiento_url
}

/**
 * MÍNIMO DE PLAZAS para aparecer en un BANNER (decisión de producto, Manuel 20/07).
 *
 * Por qué: los banners son escaparate, no catálogo. De 51 convocatorias con inscripción
 * viva, 24 tenían ≤4 plazas y 14 UNA sola ("Enólogo", "Albañil - Ayto. Segovia"), y el
 * teaser general de la home llegaba a mostrar 9 de 10 con ≤4 plazas — la primera imagen
 * que se lleva un usuario nuevo. Una convocatoria de 1 plaza no es una oportunidad real
 * para casi nadie.
 *
 * Regla: NUNCA se muestra en un banner una convocatoria de menos de 10 plazas.
 * `plazas_libres` NULL NO pasa: no podemos acreditar que llegue al mínimo (son 5 casos,
 * dato que nos falta; al rellenarlo entrarán solas si califican).
 *
 * Ojo al alcance: esto rige los BANNERS. La página SEO /oposiciones/inscripcion-abierta
 * ("ver todas") sigue listando el catálogo completo a propósito — ahí "todas" significa
 * todas, y es donde vive el valor de cola larga.
 */
export const BANNER_MIN_PLAZAS = 10

export interface ConPlazas {
  plazas_libres: number | null
}

/** ¿Tiene un número de plazas suficiente para el escaparate? NULL = no acreditado = no. */
export function hasSignificantPlazas(
  o: ConPlazas,
  min: number = BANNER_MIN_PLAZAS,
): boolean {
  if (o.plazas_libres == null) return false
  const n = Number(o.plazas_libres)
  return Number.isFinite(n) && n >= min
}

/**
 * ÚNICA puerta de inclusión de los BANNERS = mostrable por fechas Y con plazas suficientes.
 * Los dos banners (home `OpenInscriptionsBanner` y autenticado `/api/v2/banner/
 * open-inscriptions`) deben pasar por aquí para que no puedan divergir.
 */
export function isBannerWorthy(
  o: ConvocatoriaDisplay & ConPlazas,
  today: string = todayMadrid(),
): boolean {
  return isOpenForDisplay(o, today) && hasSignificantPlazas(o)
}

/**
 * ¿Es una CATALOGADA mostrable (sección "sin test todavía" de la SEO)?
 * Catalogada (is_active=false) + abierta-por-fechas + con convocatoria oficial.
 */
export function isShowableCatalogada(o: ConvocatoriaDisplay, today: string = todayMadrid()): boolean {
  return !o.is_active && isOpenForDisplay(o, today)
}
