/**
 * Helper de filtrado por término de búsqueda para oposiciones.
 *
 * Single source of truth usado por:
 * - components/OnboardingModal.tsx (selección inicial)
 * - components/OposicionChangeModal.tsx (cambio de oposición)
 * - components/OposicionGuard.tsx (gate de tests sin oposición)
 *
 * Antes (07-may-2026) cada componente tenía su propio filtro con bugs
 * sutiles distintos: el de Cambio/Guard ignoraba SEARCH_ALIASES, el de
 * Onboarding hacía `term.includes(alias)` ambiguo que producía falsos
 * positivos con aliases muy cortos. Esta función unifica el comportamiento
 * y corrige ambos bugs.
 */

interface SearchableOposicion {
  nombre?: string | null
  name?: string | null      // OposicionConfig usa `name`
  categoria?: string | null
  badge?: string | null     // OposicionConfig usa `badge` para grupo
  administracion?: string | null
  aliases?: string[] | null
}

const MIN_ALIAS_LENGTH_FOR_PARTIAL_MATCH = 3

function normalize(s: string): string {
  // Lowercase + decompose tildes (NFD) + remove diacritics + strip whitespace.
  // Hacemos "Autonómica" === "autonomica" y "Generalitat" === "generalitat".
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()
}

export function matchesOposicion(o: SearchableOposicion, rawTerm: string): boolean {
  const term = normalize(rawTerm || '')
  if (!term) return true

  const fields: string[] = []
  if (o.nombre) fields.push(o.nombre)
  if (o.name) fields.push(o.name)
  if (o.categoria) fields.push(o.categoria)
  if (o.badge) fields.push(o.badge)
  if (o.administracion) fields.push(o.administracion)

  for (const field of fields) {
    if (normalize(field).includes(term)) return true
  }

  for (const alias of o.aliases || []) {
    const a = normalize(alias)
    if (!a) continue
    // Match si término contiene al alias (ej. usuario escribe "c1-01 gva" → alias "gva" ✓)
    // O si alias contiene al término (ej. usuario escribe "administrativo val" → alias "administrativo valencia" ✓).
    // Para evitar falsos positivos con aliases muy cortos (ej. "ge"), exigimos
    // mín. 3 chars en el lado del alias cuando el término lo CONTIENE al alias.
    if (term === a) return true
    if (a.length >= MIN_ALIAS_LENGTH_FOR_PARTIAL_MATCH && a.includes(term)) return true
    if (a.length >= MIN_ALIAS_LENGTH_FOR_PARTIAL_MATCH && term.includes(a)) return true
  }

  return false
}

/**
 * Madurez de una oposición del catálogo, de menos a más contenido real.
 * Mismo orden que `app/admin/oposiciones-coverage/page.tsx` (no se importa de
 * ahí porque esa constante es local a la página; si diverge, hay guardarraíl).
 */
export const COVERAGE_LEVEL_ORDER = [
  'catalogada', 'monitorizada', 'con_temario', 'con_tests', 'con_landing', 'full',
] as const

/**
 * Rango de un `coverage_level` para ordenar — más alto es más maduro.
 * Desconocido/vacío (p.ej. el fallback estático OFFICIAL_OPOSICIONES, que no
 * trae este campo) va al rango 0: ni adelante ni detrás porque no hay dato,
 * y `sortByCoverageLevel` es estable, así que no reordena entre sí a los que
 * no lo tienen.
 */
export function coverageLevelRank(level: string | null | undefined): number {
  const i = COVERAGE_LEVEL_ORDER.indexOf((level || '') as (typeof COVERAGE_LEVEL_ORDER)[number])
  return i === -1 ? 0 : i
}

/**
 * Reordena por madurez, MÁS CONSTRUIDA primero, conservando el orden relativo
 * de las que empatan (sort estable de JS/V8, garantizado desde ES2019).
 *
 * Por qué hace falta (T-562): con el catálogo entero (construidas +
 * catalogadas-vacías) mezclado, una entrada de 0 preguntas puede salir ANTES
 * que su equivalente con miles solo por orden alfabético o por demanda — el
 * caso medido: "Auxiliar de Biblioteca (Estado)" (vacía) antes que "Auxiliar
 * de Archivos, Bibliotecas y Museos…" (13.891 preguntas), en una búsqueda
 * de "biblioteca" con las dos como resultado.
 */
export function sortByCoverageLevel<T extends { coverage_level?: string | null }>(items: T[]): T[] {
  return [...items].sort((a, b) => coverageLevelRank(b.coverage_level) - coverageLevelRank(a.coverage_level))
}

interface BuiltOposicion {
  name?: string | null
  // `shortName` es el nombre pensado para UI (badge/botón); `name` es el
  // oficial de BOE, que puede ser mucho más largo — mismo problema que T-562
  // arregló en las listas del selector, aquí en el botón de "ya la tenemos".
  shortName?: string | null
  badge?: string | null
  administracion?: string | null
  aliases?: string[] | null
}

/**
 * ¿Hay ya una oposición CONSTRUIDA (con temario/tests reales) que sea la
 * misma que el usuario acaba de elegir de la lista aspiracional? Reusa el
 * mismo `matchesOposicion` de la búsqueda, pero al revés: en vez de "¿este
 * término encuentra a esta oposición?", pregunta "¿el NOMBRE elegido
 * encuentra a alguna construida?" — por construcción de `matchesOposicion`
 * (compara contra `name`/`badge`/`administracion`/`aliases`) es la misma
 * operación con los papeles cambiados.
 *
 * T-562: es el punto exacto donde el selector mandaba a un callejón sin
 * salida — "Auxiliar de Biblioteca" (catalogada, 0 preguntas) no ofrecía
 * "Auxiliar de Biblioteca (Estado)" (construida, 13.891 preguntas) aunque
 * el nombre ya está en sus aliases.
 */
export function findBuiltEquivalent<T extends BuiltOposicion>(
  built: T[],
  nombreElegido: string,
): T | undefined {
  if (!nombreElegido?.trim()) return undefined
  return built.find((o) => matchesOposicion(o, nombreElegido))
}

/**
 * Nombre para UI de una construida — `shortName` cuando existe, si no el
 * oficial de BOE. Mismo criterio que ya aplican las listas del selector
 * (T-562): usarlo también donde se OFRECE la equivalente (el botón "Ir a…")
 * evita reintroducir el mismo problema (nombre de BOE larguísimo) un paso
 * más allá de donde se arregló la primera vez.
 */
export function builtDisplayName(o: BuiltOposicion): string {
  return o.shortName || o.name || ''
}
