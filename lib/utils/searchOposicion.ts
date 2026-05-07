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
