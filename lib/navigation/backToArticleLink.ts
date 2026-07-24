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
 * Enlace "Hacer test de este artículo" que se muestra al leer UN artículo
 * (lector individual /teoria/[law]/articulo-N). Lanza el test de ley acotado a
 * ese único artículo vía `?selected_articles=N`, de forma que al terminar el
 * test `buildBackToArticleLink` reconstruye "Volver al artículo N" y cierra el
 * bucle en el mismo lector. Ambos helpers comparten el contrato del parámetro
 * `selected_articles` → se testean juntos (round-trip).
 *
 * @param lawSlug slug de la ley (mismo en /teoria y /leyes)
 * @param articleNumber número de artículo (numérico)
 */
export function buildArticleTestLink(
  lawSlug: string,
  articleNumber: number
): string {
  return `/leyes/${lawSlug}?selected_articles=${articleNumber}&source=teoria`
}

/**
 * Enlace "Hacer test de {ley}" del TEMARIO (dentro de LawSection). Lanza el test de
 * esa ley ACOTADO a los artículos que están EN EL TEMA (su scope) vía
 * `?selected_articles=<n1,n2,…>&source=temario`, para NO servir preguntas fuera de
 * temario. Corrige el bug T-073: el CTA enlazaba a la ley ENTERA (`/leyes/{ley}` sin
 * scope) → el 67% de esos clics sobre-servían (art. 96 CE a un usuario cuyo tema no
 * lo incluye). Comparte el contrato de `selected_articles` con `buildArticleTestLink`
 * (round-trip). PURA y testeada; la consume el componente compartido <LawTestCTA> —
 * NUNCA hand-rollear esta URL dentro de cada TopicContentView (guardarraíl lo prohíbe).
 *
 * @param lawSlug slug de la ley (mismo en /teoria y /leyes)
 * @param articleNumbers artículos del tema para esa ley (número o disposición: '1','2','DA1'…)
 * @param source origen del enlace (default 'temario')
 */
export function buildLawTestLink(
  lawSlug: string,
  articleNumbers: Array<string | number>,
  source: string = 'temario'
): string {
  const nums = Array.from(
    new Set(
      (articleNumbers ?? [])
        .map((a) => String(a).trim())
        .filter((s) => s.length > 0)
    )
  )
  if (nums.length === 0) {
    // Defensivo: una ley del temario SIEMPRE trae artículos escopados. Si por un
    // fallo de datos no hay ninguno, no acotamos (mejor la ley entera que un enlace
    // roto) pero SÍ marcamos el origen — el evento law_test_cta_click con
    // scopedArticleCount=0 hace visible la regresión.
    return `/leyes/${lawSlug}?source=${source}`
  }
  // encodeURIComponent por token: los identificadores no-numéricos llevan espacio
  // ('55 ter', '64 bis', 'DA 1') → hay que codificarlos o el query string sale roto.
  // Se unen con coma literal (los article_number no contienen comas). El parser de
  // producción (parseSelectedArticlesScope) recibe el valor ya decodificado por
  // URLSearchParams y NO hace parseInt → los identificadores llegan intactos al serving.
  const encoded = nums.map((n) => encodeURIComponent(n)).join(',')
  return `/leyes/${lawSlug}?selected_articles=${encoded}&source=${source}`
}

/**
 * Parser PURO de `?selected_articles=` para el SCOPE de un test de ley (temario).
 * Preserva los identificadores COMO STRING (número o disposición: '1','DA1','55 ter'…)
 * — a diferencia de `buildBackToArticleLink`, que hace parseInt a propósito porque solo
 * quiere el ÚNICO artículo numérico del round-trip "Volver al artículo N".
 *
 * CRÍTICO (regresión cazada en review T-073): el serving (getFilteredQuestions) compara
 * `article_number` por String() y acepta no-numéricos; parsear con parseInt aquí DESCARTA
 * disposiciones ('DA1'→NaN) y TRUNCA sufijos ('55 ter'→55) → sub-sirve en silencio los
 * ~331 temas con artículos no-numéricos en el scope. Este helper NO parseInt.
 *
 * @param param valor de `searchParams.get('selected_articles')` (YA decodificado por URLSearchParams)
 * @returns lista de identificadores string, sin vacíos, deduplicada en orden
 */
export function parseSelectedArticlesScope(param: string | null | undefined): string[] {
  if (!param) return []
  return Array.from(
    new Set(
      param
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0)
    )
  )
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
