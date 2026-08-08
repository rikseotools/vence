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

/**
 * ANCLA de un artículo dentro de la página de un tema del temario ([T-611]).
 *
 * El bucle temario → «Hacer test Art. N» → volver estaba ABIERTO: el enlace de vuelta guardaba
 * `window.location.href` SIN ancla y ninguna tarjeta tenía `id`, así que devolvía arriba del
 * tema y con las leyes plegadas otra vez. Lo reportó una usuaria premium: «después no puedo
 * volver exactamente al mismo lugar (y mismo formato), tengo que volver al temario y volver a
 * seleccionar la ley y buscar el artículo por donde me quedé».
 *
 * Lleva la LEY además del número porque un mismo tema sirve varias leyes y el artículo 1 de
 * cada una colisionaría. El identificador no es siempre numérico ('55 ter', 'DA 1', 'D. F. 2ª'),
 * así que se normaliza a algo que valga como `id` de HTML y como fragmento de URL.
 */
export function anclaArticulo(
  lawShortName: string | null | undefined,
  articleNumber: string | number | null | undefined,
): string | null {
  const ley = normalizarParaAncla(lawShortName)
  const art = normalizarParaAncla(articleNumber)
  if (!ley || !art) return null
  return `art-${ley}-${art}`
}

function normalizarParaAncla(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return ''
  return String(v)
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '') // tildes: el fragmento viaja en la URL
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/**
 * Enlace "Elegir qué artículos entran en el test" del TEMARIO ([T-367]). A diferencia de
 * `buildLawTestLink` (que arranca el test YA acotado al scope del tema, sin pantalla
 * intermedia), este lleva a la página de la ley SIN `selected_articles` → NO dispara el
 * auto-redirect de `LawTestConfigurator` y el usuario aterriza en el configurador visible,
 * con el panel "📄 Filtrar por Artículos" abierto (`abrir_filtro=1`) para poder elegir un
 * subconjunto propio ("llevo estudiados 50 de los 100 artículos").
 *
 * Antes de esto no había NINGÚN camino de vuelta desde el temario a esa pantalla: el único
 * CTA de ley (`LawTestCTA`) siempre lleva `selected_articles` (el scope del tema) y por
 * tanto siempre auto-arranca el test, saltándose el filtro. Ver ficha T-367.
 *
 * @param lawSlug slug de la ley (mismo en /teoria y /leyes)
 * @param source origen del enlace, para observabilidad (default 'temario_filtro')
 */
export function buildLawFilterLink(
  lawSlug: string,
  source: string = 'temario_filtro'
): string {
  return `/leyes/${lawSlug}?abrir_filtro=1&source=${source}`
}

/**
 * Texto del botón "volver a la ley" que se ve ARRIBA del test mientras se responde
 * (`!isTestCompleted` en TestLayout — la ÚNICA puerta visible desde el primer segundo
 * para volver al filtro de artículos, no solo al terminar el test). [T-313]
 *
 * Bug real que esto arregla: `customNavigationLinks.backToLaw` solo tiene `.label`
 * (`LawTestPageWrapper` construye `{ href, label, isPrimary }` — el tipo ni siquiera
 * declara `.text`), pero el botón de arriba leía `config.customNavigationLinks
 * ?.backToLaw?.text`, que SIEMPRE es `undefined`, así que SIEMPRE caía al genérico
 * "Volver a Tests" en vez de "📚 Volver a {ley}". La pantalla de resultados (fin del
 * test) sí leía `.label` bien — la divergencia entre los dos puntos de lectura del
 * MISMO objeto es la causa. Consecuencia práctica: alguien que llega desde el
 * temario a un test de UN artículo (auto-arrancado, sin pasar por el configurador
 * visible) nunca veía, en ningún momento del test, que "Volver a Tests" te lleva de
 * vuelta a la pantalla donde se elige qué artículos entran — el título no lo decía.
 */
export function backToLawButtonLabel(
  backToLaw: { label?: string } | null | undefined,
  fallback: string = 'Volver a Tests',
): string {
  return backToLaw?.label || fallback
}
