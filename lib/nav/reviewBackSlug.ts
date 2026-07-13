// lib/nav/reviewBackSlug.ts
//
// Resuelve a qué `/<oposicion>/test` vuelve el botón "Volver a Tests" de la página
// de revisión de un test (/revisar/[testId], ExamReviewLayout). PURO → testeable.
//
// Bug (flor/MariSol, 13/07): ExamReviewLayout tenía el prop `oposicionSlug` con
// DEFAULT hardcodeado a la flagship (Estado) y la página no se lo pasaba → un
// usuario de OTRA oposición (GVA) que revisaba su test y pulsaba "Volver a Tests"
// acababa en /auxiliar-administrativo-estado/test. Era GLOBAL (todo no-Estado lo
// sufría). Fix: la flagship es SOLO el último recurso.

export const FLAGSHIP_OPOSICION_SLUG = 'auxiliar-administrativo-estado'

/**
 * Prioridad: oposición del TEST revisado (si se conoce) → oposición DEL USUARIO
 * (su target) → flagship como ÚLTIMO recurso. `usedFlagshipFallback` marca el
 * caso anómalo (ni test ni usuario tienen oposición) para observabilidad.
 */
export function resolveReviewBackSlug(
  testOposicionSlug?: string | null,
  userOposicionSlug?: string | null,
): { slug: string; usedFlagshipFallback: boolean } {
  const resolved = (testOposicionSlug || '').trim() || (userOposicionSlug || '').trim()
  return {
    slug: resolved || FLAGSHIP_OPOSICION_SLUG,
    usedFlagshipFallback: !resolved,
  }
}
