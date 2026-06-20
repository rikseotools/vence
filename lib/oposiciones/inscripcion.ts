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
