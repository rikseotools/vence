// lib/oposicion/objetivoPersonalizado.ts — una oposición PERSONALIZADA como objetivo. (T-327)
//
// Helpers PUROS, al estilo de `decideLoad` y `resolveUserOposicion`, y por el mismo motivo:
// `OposicionContext` es 'use client' y no se puede montar en un test puro, pero lo que decide
// aquí afecta a **la navegación de todos los usuarios**.
//
// ── EL PROBLEMA QUE RESUELVE ────────────────────────────────────────────────────────────────
//
// La oposición objetivo (`user_profiles.target_oposicion`) se valida contra `ALL_OPOSICION_IDS`,
// que es un catálogo ESTÁTICO del código. Una oposición personalizada vive en la base de datos,
// así que no está ahí — y el contexto la trata como **dato sucio**: borra la oposición del
// usuario, le pone el menú por defecto y le enseña «selecciona tu oposición»
// (`OposicionContext.tsx`, rama `invalid`).
//
// O sea que, sin esto, dejar elegir una personalizada no es que «no funcione»: **le rompe la
// navegación** a quien la elija.
//
// ── LA REGLA QUE NO ES OBVIA: SIN NOMBRE NO ES VÁLIDA ───────────────────────────────────────
//
// Una personalizada solo se acepta como objetivo si además **se sabe cómo se llama**. El nombre
// no está en ningún catálogo: viene del blob `target_oposicion_data`. Si ese blob falta (pasa —
// hubo 428 perfiles con `target_oposicion` puesto y el blob a NULL por un write path parcial),
// aceptarla dejaría al usuario con una oposición **sin nombre** en la cabecera y en todos los
// selectores. Eso es PEOR que mandarle a arreglarla: un estado roto y mudo frente a uno roto que
// al menos pide ayuda. Así que sin nombre → sigue siendo `invalid`, como hasta hoy.

/** Prefijo del `position_type` que genera `lib/api/oposicionPersonalizada/plan.ts`. */
const PREFIJO = 'personalizada_'

/**
 * ¿Este identificador es una oposición personalizada CON temario?
 *
 * Se exige el prefijo a propósito. El onboarding antiguo guardaba el **UUID pelado** de
 * `custom_oposiciones` como objetivo, y esas filas son solo una etiqueta: no tienen `topics` ni
 * `topic_scope` detrás (medido el 30/07: 303 usuarios así, 127 sin un solo test). Aceptarlas
 * aquí las daría por buenas y el usuario acabaría en un temario vacío — que es exactamente el
 * problema que T-327 viene a resolver, no a extender.
 */
export function esObjetivoPersonalizado(id: string | null | undefined): boolean {
  return typeof id === 'string' && id.startsWith(PREFIJO) && id.length > PREFIJO.length
}

/** El id de `custom_oposiciones` que hay dentro del identificador (sin guiones). */
export function idCustomDe(objetivo: string): string | null {
  if (!esObjetivoPersonalizado(objetivo)) return null
  return objetivo.slice(PREFIJO.length)
}

/**
 * ¿Es válido este objetivo? Es la pregunta que hoy contesta `ALL_OPOSICION_IDS.includes(id)`.
 *
 * @param id            `target_oposicion`
 * @param estaEnCatalogo si el id está en el catálogo estático
 * @param nombreDelBlob  `target_oposicion_data.name` (o `nombre`), si vino
 */
export function esObjetivoValido(
  id: string | null | undefined,
  estaEnCatalogo: boolean,
  nombreDelBlob: string | null | undefined,
): boolean {
  if (!id) return false
  if (estaEnCatalogo) return true
  // Personalizada: válida SOLO si sabemos nombrarla (ver cabecera).
  return esObjetivoPersonalizado(id) && typeof nombreDelBlob === 'string' && nombreDelBlob.trim() !== ''
}

/**
 * Ruta de los tests de un objetivo personalizado.
 *
 * Las del catálogo van a `/{slug}/test`, pero una personalizada no tiene slug ni página propia:
 * se sirve desde su `topic_scope` en una ruta por id. Devolver `null` para lo que no sea
 * personalizado deja que el llamante siga usando su camino de siempre.
 */
export function rutaTestPersonalizada(id: string | null | undefined): string | null {
  if (!esObjetivoPersonalizado(id)) return null
  return `/oposicion-personalizada/${idCustomDe(id as string)}/test`
}
