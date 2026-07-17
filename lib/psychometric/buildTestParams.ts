// lib/psychometric/buildTestParams.ts
//
// Helper PURO (sin efectos, testeable) que traduce la selección del
// configurador de psicotécnicos a los parámetros de la petición.
//
// REGLA DE ORO (evita el bug de "selecciono sinónimos y me salen definiciones"):
// la selección es AUTORITATIVA y COMPONIBLE, nunca se adivina por heurística.
//   - Categoría CON secciones  → se representa SIEMPRE por sus secciones
//                                seleccionadas (nunca por la clave de categoría).
//   - Categoría SIN secciones  → se representa por su clave de categoría.
//
// Así el backend filtra por la unión `sección ∈ seleccionadas OR
// categoría ∈ categoríasSinSecciones`, y una categoría con secciones NUNCA
// puede "colarse entera": solo entran sus secciones elegidas.

export interface PsychoSectionLike {
  key: string
}

export interface PsychoCategoryLike {
  key: string
  sections: PsychoSectionLike[]
}

export interface PsychometricTestParams {
  /** Categorías SIN secciones seleccionadas (se filtran por categoría entera). */
  categoryKeys: string[]
  /** Secciones seleccionadas de categorías CON secciones (filtro fino). */
  sectionKeys: string[]
}

/**
 * Construye los parámetros de la petición a partir de la selección del usuario.
 *
 * @param categories        Catálogo completo (con sus secciones) tal cual lo
 *                          devuelve la API de categorías.
 * @param selectedCategories mapa key→bool de categorías seleccionadas.
 * @param selectedSections   mapa key→bool de secciones seleccionadas.
 */
export function buildPsychometricTestParams(
  categories: PsychoCategoryLike[],
  selectedCategories: Record<string, boolean>,
  selectedSections: Record<string, boolean>
): PsychometricTestParams {
  const categoryKeys: string[] = []
  const sectionKeys: string[] = []

  for (const cat of categories) {
    if (!selectedCategories[cat.key]) continue

    if (cat.sections.length === 0) {
      // Categoría sin secciones → filtro por categoría entera.
      categoryKeys.push(cat.key)
      continue
    }

    // Categoría con secciones → SOLO sus secciones seleccionadas.
    const chosen = cat.sections.filter(s => selectedSections[s.key])
    for (const s of chosen) sectionKeys.push(s.key)
    // Nota: si por un estado inconsistente no hubiera ninguna sección
    // seleccionada pero la categoría sí, no se añade nada (no se filtra por
    // la categoría entera) — el invariante del configurador garantiza que
    // categoría seleccionada ⟹ ≥1 sección seleccionada.
  }

  return { categoryKeys, sectionKeys }
}
