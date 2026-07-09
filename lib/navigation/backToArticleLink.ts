// lib/navigation/backToArticleLink.ts
// Lógica PURA del enlace "Volver al artículo" que aparece tras un test de ley
// lanzado desde la lectura de UN artículo concreto (fix del bug de navegación:
// el usuario volvía a la oposición, no al artículo).
//
// Se construye con datos que YA vienen en la URL del test (`selected_articles`
// + slug de la ley), sin sessionStorage ni state extra → escala a todas las
// oposiciones sin código por-oposición.

export interface BackToArticleLink {
  href: string
  label: string
  isPrimary: boolean
}

/**
 * Devuelve el enlace "Volver al artículo N" SOLO cuando el test se lanzó desde
 * un ÚNICO artículo numérico (caso "Hacer test Art. N"). En cualquier otro caso
 * (varios artículos, disposición no numérica, vacío, sin slug) devuelve null y
 * la UI cae a los enlaces de siempre (a la ley / al temario).
 *
 * @param selectedArticlesParam valor crudo de `?selected_articles=` (ej. "3", "3,4")
 * @param lawSlug slug de la ley (para la ruta /teoria/[slug]/articulo-N)
 */
export function buildBackToArticleLink(
  selectedArticlesParam: string | null | undefined,
  lawSlug: string | null | undefined
): BackToArticleLink | null {
  if (!selectedArticlesParam || !lawSlug) return null

  const nums = selectedArticlesParam
    .split(',')
    .map((a) => parseInt(a.trim(), 10))
    .filter((n) => !isNaN(n) && n > 0)

  if (nums.length !== 1) return null

  const n = nums[0]
  return {
    href: `/teoria/${lawSlug}/articulo-${n}`,
    label: `Volver al artículo ${n}`,
    isPrimary: true,
  }
}
