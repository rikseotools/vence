/**
 * lib/utils/articleOrder.ts
 *
 * Fuente única de verdad para ordenar artículos de leyes.
 *
 * Por qué existe este módulo: en `articles.article_number` conviven 1.176
 * formas no numéricas distintas (preámbulo, DA1, DA Primera, dacuadragésima_cuarta,
 * 147.1, T1C2, Anexo I, EM, etc.). Un `parseInt` ingenuo deja todo lo no numérico
 * empatado a NaN → orden indeterminado. Esto rompía la visualización del temario.
 *
 * Política de orden (alineada con BOE): los artículos se ordenan en grupos
 * categoría y, dentro de cada grupo, por su número/ordinal:
 *
 *   1. EXPOSICION_DE_MOTIVOS  (EM, EMP, EXP, Exp, exp)
 *   2. PREAMBULO              (preámbulo, Preámbulo, preambulo, ...)
 *   3. TITULO                 (T1, T1C2, ...) y CAPITULO (Cap. 1, ...)
 *   4. ARTICULO               (1, 2, 1 bis, 84 quater, 147.1, Primero, ...)
 *   5. DA  Disposición Adicional
 *   6. DT  Disposición Transitoria
 *   7. DD  Disposición Derogatoria
 *   8. DF  Disposición Final
 *   9. ANEXO                  (Anexo I, A1, ANEXO II, ...)
 *  10. OTHER                  (todo lo desconocido — al final por orden lexicográfico)
 *
 * Cómo extender:
 *  - Si aparece una nueva familia: añade un valor al enum `ArticleCategory`
 *    y un bloque en `parseArticleNumber`.
 *  - Si aparece una nueva variante de una familia existente: añade su regex
 *    al parser de esa categoría. El test correspondiente debe cubrirla.
 */

export enum ArticleCategory {
  EXPOSICION_DE_MOTIVOS = 1,
  PREAMBULO = 2,
  TITULO = 3,
  ARTICULO = 4,
  DA = 5,
  DT = 6,
  DD = 7,
  DF = 8,
  ANEXO = 9,
  OTHER = 99,
}

/**
 * Representación parseada de un article_number. Las claves `primary` / `secondary` / `tertiary`
 * permiten un orden lexicográfico-por-tupla dentro de cada categoría.
 *
 *  - ARTICULO:   primary=número base; secondary=índice del sufijo (bis=1, ter=2, ...); tertiary=subnumérico tras el sufijo.
 *  - TITULO:     primary=número de título; secondary=número de capítulo (0 si solo título); tertiary=0.
 *  - DA/DT/DD/DF: primary=ordinal de la disposición; secondary=índice de "bis/ter" si aplica; tertiary=0.
 *  - ANEXO:      primary=ordinal (romano traducido); secondary=0; tertiary=0.
 *  - OTHER:      todos a 0 — el orden cae a `raw` lexicográfico.
 *  - PREAMBULO / EXPOSICION_DE_MOTIVOS: todos a 0 — son únicos por ley en la práctica.
 */
export interface ParsedArticle {
  category: ArticleCategory
  primary: number
  secondary: number
  tertiary: number
  /** Versión normalizada/lowercase para el desempate final por orden lexicográfico. */
  raw: string
}

// ---------------------------------------------------------------------------
// Tablas de ordinales (compartidas entre disposiciones, anexos y artículos).
// ---------------------------------------------------------------------------

const SUFFIX_ORDER: Record<string, number> = {
  bis: 1,
  ter: 2,
  quater: 3,
  quáter: 3,
  quinquies: 4,
  sexies: 5,
  septies: 6,
  octies: 7,
  nonies: 8,
  novies: 8,
  decies: 9,
  undecies: 10,
  duodecies: 11,
}

const MASCULINE_ORDINALS: Record<string, number> = {
  primero: 1, segundo: 2, tercero: 3, cuarto: 4, quinto: 5,
  sexto: 6, séptimo: 7, septimo: 7, octavo: 8, noveno: 9,
  décimo: 10, decimo: 10,
  decimoprimero: 11, decimosegundo: 12, decimotercero: 13,
  decimocuarto: 14, decimoquinto: 15, decimosexto: 16,
  decimoséptimo: 17, decimoseptimo: 17, decimoctavo: 18,
  decimooctavo: 18, decimonoveno: 19, decimonono: 19,
}

const FEMININE_ORDINALS: Record<string, number> = {
  primera: 1, segunda: 2, tercera: 3, cuarta: 4, quinta: 5,
  sexta: 6, séptima: 7, septima: 7, octava: 8, novena: 9,
  décima: 10, decima: 10,
  undécima: 11, undecima: 11, duodécima: 12, duodecima: 12,
  decimotercera: 13, decimocuarta: 14, decimoquinta: 15,
  decimosexta: 16, decimoséptima: 17, decimoseptima: 17,
  decimoctava: 18, decimooctava: 18, decimonovena: 19,
}

const FEMININE_TENS: Record<string, number> = {
  vigésima: 20, vigesima: 20, vigésimo: 20, vigesimo: 20,
  trigésima: 30, trigesima: 30,
  cuadragésima: 40, cuadragesima: 40,
  quincuagésima: 50, quincuagesima: 50,
  sexagésima: 60, sexagesima: 60,
  septuagésima: 70, septuagesima: 70,
  octogésima: 80, octogesima: 80,
  nonagésima: 90, nonagesima: 90,
  centésima: 100, centesima: 100,
}

const MASCULINE_TENS: Record<string, number> = {
  vigésimo: 20, vigesimo: 20,
  trigésimo: 30, trigesimo: 30,
  cuadragésimo: 40, cuadragesimo: 40,
  quincuagésimo: 50, quincuagesimo: 50,
  sexagésimo: 60, sexagesimo: 60,
  septuagésimo: 70, septuagesimo: 70,
  octogésimo: 80, octogesimo: 80,
  nonagésimo: 90, nonagesimo: 90,
}

const ROMAN: Record<string, number> = {
  i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6, vii: 7, viii: 8, ix: 9, x: 10,
  xi: 11, xii: 12, xiii: 13, xiv: 14, xv: 15, xvi: 16, xvii: 17, xviii: 18,
  xix: 19, xx: 20, xxi: 21, xxii: 22, xxiii: 23, xxiv: 24, xxv: 25,
}

// ---------------------------------------------------------------------------
// Helpers internos.
// ---------------------------------------------------------------------------

/** Resuelve un ordinal en palabras (fem. o masc., simple o compuesto) a número. 0 si no se reconoce. */
function ordinalWordToNumber(word: string): number {
  const w = word.toLowerCase().trim()
  if (!w) return 0
  // Único
  if (w === 'unica' || w === 'única' || w === 'unico' || w === 'único') return 1

  // Directo en la tabla
  if (FEMININE_ORDINALS[w]) return FEMININE_ORDINALS[w]
  if (MASCULINE_ORDINALS[w]) return MASCULINE_ORDINALS[w]
  if (FEMININE_TENS[w]) return FEMININE_TENS[w]
  if (MASCULINE_TENS[w]) return MASCULINE_TENS[w]

  // Compuesto con separador (espacio o guion bajo): "vigésima primera", "vigésimo_segundo"
  const parts = w.split(/[\s_]+/).filter(Boolean)
  if (parts.length === 2) {
    const tens = FEMININE_TENS[parts[0]] ?? MASCULINE_TENS[parts[0]] ?? 0
    const ones = FEMININE_ORDINALS[parts[1]] ?? MASCULINE_ORDINALS[parts[1]] ?? 0
    if (tens && ones) return tens + ones
  }

  // Compuestos sin separador: "vigesimocuarta", "vigesimoprimera"
  // (concatenación de "vigesimo/a" + ordinal simple)
  const compactMatch = w.match(
    /^(vigesimo|vigesima|trigesimo|trigesima|cuadragesimo|cuadragesima|quincuagesimo|quincuagesima|sexagesimo|sexagesima|septuagesimo|septuagesima|octogesimo|octogesima|nonagesimo|nonagesima|vigésimo|vigésima|trigésimo|trigésima|cuadragésimo|cuadragésima|quincuagésimo|quincuagésima|sexagésimo|sexagésima|septuagésimo|septuagésima|octogésimo|octogésima|nonagésimo|nonagésima)([a-záéíóúñ]+)$/
  )
  if (compactMatch) {
    const tens = FEMININE_TENS[compactMatch[1]] ?? MASCULINE_TENS[compactMatch[1]] ?? 0
    const ones = FEMININE_ORDINALS[compactMatch[2]] ?? MASCULINE_ORDINALS[compactMatch[2]] ?? 0
    if (tens && ones) return tens + ones
  }
  return 0
}

/** Detecta "<ordinal>_bis" / "<ordinal>_ter" / "<ordinal> bis" en disposiciones y devuelve el sufijo. */
function extractDispositionSuffix(rest: string): { ordinal: string; suffix: number } {
  const m = rest.match(/^(.+?)[_\s]+(bis|ter|qu[aá]ter|quinquies|sexies|septies|octies|nonies|novies|decies)(?:[_\s].*)?$/i)
  if (!m) return { ordinal: rest, suffix: 0 }
  const sfx = m[2].toLowerCase().replace('quáter', 'quater')
  return { ordinal: m[1], suffix: SUFFIX_ORDER[sfx] || 0 }
}

// ---------------------------------------------------------------------------
// Parser principal.
// ---------------------------------------------------------------------------

/**
 * Parsea un `article_number` arbitrario y devuelve su categoría + claves de orden.
 * Pensada para alimentar `compareArticleNumbers`. Acepta entradas vacías sin reventar.
 */
export function parseArticleNumber(num: string | null | undefined): ParsedArticle {
  const raw = (num ?? '').trim()
  const lower = raw.toLowerCase()

  if (!raw) {
    return { category: ArticleCategory.OTHER, primary: 0, secondary: 0, tertiary: 0, raw: '' }
  }

  // 1. EXPOSICIÓN DE MOTIVOS — "EM", "EMP", "EXP", "Exp", "exp"
  if (/^(em|emp|exp|exposici[óo]n)$/i.test(lower)) {
    return { category: ArticleCategory.EXPOSICION_DE_MOTIVOS, primary: 0, secondary: 0, tertiary: 0, raw: lower }
  }

  // 2. PREÁMBULO — toda variante con/sin acento, con sufijos raros
  if (/^pre[áa]mbulo/i.test(lower) || lower === 'pre') {
    // Conservar un orden estable si hay varios ("preámbulo", "preámbulo_II", "preámbulo1a")
    // - Sin sufijo → primary 0
    // - Con sufijo romano "II" → primary = romano
    // - Con sufijo numérico "1a" → primary = 1
    const romanSfx = lower.match(/^pre[áa]mbulo[_\s]+([ivxlcdm]+)$/i)
    if (romanSfx) return { category: ArticleCategory.PREAMBULO, primary: ROMAN[romanSfx[1].toLowerCase()] || 0, secondary: 0, tertiary: 0, raw: lower }
    const numSfx = lower.match(/^pre[áa]mbulo[_\s]*(\d+)/i)
    if (numSfx) return { category: ArticleCategory.PREAMBULO, primary: parseInt(numSfx[1], 10), secondary: 0, tertiary: 0, raw: lower }
    return { category: ArticleCategory.PREAMBULO, primary: 0, secondary: 0, tertiary: 0, raw: lower }
  }

  // 3. TÍTULO / CAPÍTULO — "TP" (Título Preliminar), "T1", "T1C2", "Cap. 1"
  if (lower === 'tp') {
    return { category: ArticleCategory.TITULO, primary: 0, secondary: 0, tertiary: 0, raw: lower }
  }
  const titMatch = lower.match(/^t(\d+)(?:c(\d+))?$/i)
  if (titMatch) {
    return {
      category: ArticleCategory.TITULO,
      primary: parseInt(titMatch[1], 10),
      secondary: titMatch[2] ? parseInt(titMatch[2], 10) : 0,
      tertiary: 0,
      raw: lower,
    }
  }
  const capMatch = lower.match(/^cap\.?\s*(\d+)$/i)
  if (capMatch) {
    return {
      category: ArticleCategory.TITULO,
      primary: 999, // Capítulos sueltos van tras los Títulos con número
      secondary: parseInt(capMatch[1], 10),
      tertiary: 0,
      raw: lower,
    }
  }

  // 4. ANEXOS — "Anexo I", "Anexo_I", "ANEXO II", "anexo", "A1", "A3"
  const anexoRomanMatch = lower.match(/^anexo[\s_]*([ivxlcdm]+\d*)$/i)
  if (anexoRomanMatch) {
    const token = anexoRomanMatch[1].toLowerCase()
    // "V1" → fallback a "V" + dígito (tipográfico)
    const pure = token.replace(/\d+$/, '')
    const tail = token.match(/\d+$/)?.[0]
    const romanVal = ROMAN[pure] || 0
    return {
      category: ArticleCategory.ANEXO,
      primary: romanVal,
      secondary: tail ? parseInt(tail, 10) : 0,
      tertiary: 0,
      raw: lower,
    }
  }
  if (lower === 'anexo') {
    return { category: ArticleCategory.ANEXO, primary: 0, secondary: 0, tertiary: 0, raw: lower }
  }
  const anexoCompactMatch = lower.match(/^a(\d+)$/i)
  if (anexoCompactMatch) {
    return {
      category: ArticleCategory.ANEXO,
      primary: parseInt(anexoCompactMatch[1], 10),
      secondary: 0,
      tertiary: 0,
      raw: lower,
    }
  }

  // 5. DISPOSICIONES — DA, DT, DD, DF con todas sus variantes.
  //    Formato canónico: "DA1", "DT12", "DF4", "DD"
  //    Variantes: "DA 1", "DA Primera", "DA_adicional_primera", "DAprimera", "DAcuadragésima",
  //               "DAcuadragésima_cuarta", "DAunica", "Disposición Adicional Segunda",
  //               "Dfcuarta", "DAvigésima_primera", "DAvigesimoctava", "DF 1ª", "DA Nª"...
  const dispCategory = matchDispositionCategory(raw)
  if (dispCategory) return dispCategory

  // 6. ARTÍCULO NUMÉRICO (con o sin sufijo bis/ter/quater, con subnumérico opcional).
  //    Variantes admitidas: "1", "10", "84 quater", "84quater", "147.1", "8.20", "84 bis 2",
  //                         "66_bis" (typo), "90_bis"
  const articleResult = parseNumericArticle(raw)
  if (articleResult) return articleResult

  // 7. Ordinales en palabras como artículos sueltos: "Primero", "Segundo", ..., "Decimo"
  if (MASCULINE_ORDINALS[lower] || FEMININE_ORDINALS[lower]) {
    return {
      category: ArticleCategory.ARTICULO,
      primary: MASCULINE_ORDINALS[lower] ?? FEMININE_ORDINALS[lower] ?? 0,
      secondary: 0,
      tertiary: 0,
      raw: lower,
    }
  }

  // 8. Romanos sueltos "I", "II", "III", "IV" — tratamos como Títulos sin "T".
  if (ROMAN[lower]) {
    return { category: ArticleCategory.TITULO, primary: ROMAN[lower], secondary: 0, tertiary: 0, raw: lower }
  }

  // Fallback: desconocido → al final, orden lexicográfico estable.
  return { category: ArticleCategory.OTHER, primary: 0, secondary: 0, tertiary: 0, raw: lower }
}

/**
 * Reconoce todas las variantes de disposición (DA, DT, DD, DF) y devuelve la entrada parseada.
 * Devuelve null si la cadena no parece una disposición.
 */
function matchDispositionCategory(raw: string): ParsedArticle | null {
  const lower = raw.toLowerCase().trim()

  const DISP_TYPE: Record<string, ArticleCategory> = {
    da: ArticleCategory.DA,
    dt: ArticleCategory.DT,
    dd: ArticleCategory.DD,
    df: ArticleCategory.DF,
  }
  const DISP_FROM_NAME: Record<string, ArticleCategory> = {
    adicional: ArticleCategory.DA,
    transitoria: ArticleCategory.DT,
    derogatoria: ArticleCategory.DD,
    final: ArticleCategory.DF,
  }

  // Variante verbosa: "Disposición Adicional Segunda", "disposición final cuarta"
  const verboseMatch = lower.match(/^disposici[óo]n\s+(adicional|transitoria|derogatoria|final)\s+(.+)$/i)
  if (verboseMatch) {
    const cat = DISP_FROM_NAME[verboseMatch[1].toLowerCase()]
    const ord = ordinalWordToNumber(verboseMatch[2])
    return { category: cat, primary: ord || 0, secondary: 0, tertiary: 0, raw: lower }
  }

  // Variante legacy: "DA_adicional_primera", "DA_transitoria_novena", "DA_derogatoria_unica"
  const legacyMatch = lower.match(/^da_(adicional|transitoria|derogatoria|final)_(.+)$/i)
  if (legacyMatch) {
    const cat = DISP_FROM_NAME[legacyMatch[1].toLowerCase()]
    const { ordinal, suffix } = extractDispositionSuffix(legacyMatch[2])
    const ord = ordinalWordToNumber(ordinal)
    return { category: cat, primary: ord || 0, secondary: suffix, tertiary: 0, raw: lower }
  }

  // Prefijo simple DA/DT/DD/DF (mayúsculas/minúsculas)
  // Acepta también: "Dfcuarta" (typo en mayúscula), "Df cuarta", "DA 1", "DA Primera", "DA Nª",
  //                 "DAcuadragésima_cuarta", "DAvigésima_primera", "DAU"/"DDU" (= única).
  const prefixMatch = lower.match(/^(da|dt|dd|df)([\s_]*)(.*)$/i)
  if (prefixMatch) {
    const cat = DISP_TYPE[prefixMatch[1].toLowerCase()]
    let rest = prefixMatch[3].trim()
    if (rest === '') {
      // "DA", "DT", "DD", "DF" sueltos → orden 0 (= "única" implícita / placeholder).
      return { category: cat, primary: 0, secondary: 0, tertiary: 0, raw: lower }
    }

    // Casos "U" / "u" como abreviatura de "única".
    if (rest === 'u') {
      return { category: cat, primary: 1, secondary: 0, tertiary: 0, raw: lower }
    }

    // "DAs", "DFs", "DTs" plural raro → al final de su grupo.
    if (rest === 's') {
      return { category: cat, primary: 9998, secondary: 0, tertiary: 0, raw: lower }
    }

    // Reconocer sufijo bis/ter/quater dentro del resto.
    const { ordinal, suffix } = extractDispositionSuffix(rest)
    rest = ordinal.trim()

    // Eliminar "ª" (femenino abreviado) y comas.
    rest = rest.replace(/ª/g, '').replace(/,/g, '').trim()

    // Si el resto es numérico puro: "1", "12", "23"
    if (/^\d+$/.test(rest)) {
      return { category: cat, primary: parseInt(rest, 10), secondary: suffix, tertiary: 0, raw: lower }
    }
    // "unica" / "única" → 1
    if (rest === 'unica' || rest === 'única') {
      return { category: cat, primary: 1, secondary: suffix, tertiary: 0, raw: lower }
    }
    // Abreviaturas truncadas conocidas: "DTd" (décima?), "DTund" (undécima?), "DTduod" (duodécima?)
    const abbrev: Record<string, number> = { d: 10, und: 11, duod: 12 }
    if (abbrev[rest]) {
      return { category: cat, primary: abbrev[rest], secondary: suffix, tertiary: 0, raw: lower }
    }

    // Ordinal en palabras (potencialmente compuesto)
    const ord = ordinalWordToNumber(rest)
    if (ord) {
      return { category: cat, primary: ord, secondary: suffix, tertiary: 0, raw: lower }
    }

    // Resto desconocido para la disposición → cae al final del grupo.
    return { category: cat, primary: 9999, secondary: suffix, tertiary: 0, raw: lower }
  }

  return null
}

/** Reconoce artículos numéricos: "1", "84 quater", "84quater", "147.1", "84 bis 2", "66_bis". Devuelve null si no encaja. */
function parseNumericArticle(raw: string): ParsedArticle | null {
  // Normalizar "<n>_bis" → "<n> bis", "84BIS" → "84 bis", "quáter" → "quater"
  const normalized = raw
    .toLowerCase()
    .replace(/quáter/gi, 'quater')
    .replace(/_/g, ' ')
    .replace(/(\d+)\s*(bis|ter|quater|quinquies|sexies|septies|octies|nonies|novies|decies)(?:\s*(\d+))?/gi, '$1 $2 $3')
    .replace(/\s+/g, ' ')
    .trim()

  // Subnumérico tipo "147.1" / "8.20"
  const subMatch = normalized.match(/^(\d+)\.(\d+)$/)
  if (subMatch) {
    return {
      category: ArticleCategory.ARTICULO,
      primary: parseInt(subMatch[1], 10),
      secondary: 0, // sin sufijo bis/ter
      tertiary: parseInt(subMatch[2], 10), // subnúm: 1, 2, ...
      raw: normalized,
    }
  }

  // "<n>" simple, o "<n> <sufijo>", o "<n> <sufijo> <subnum>"
  const m = normalized.match(/^(\d+)(?:\s+(bis|ter|quater|quinquies|sexies|septies|octies|nonies|novies|decies))?(?:\s+(\d+))?$/i)
  if (m) {
    return {
      category: ArticleCategory.ARTICULO,
      primary: parseInt(m[1], 10),
      secondary: m[2] ? SUFFIX_ORDER[m[2].toLowerCase()] || 0 : 0,
      tertiary: m[3] ? parseInt(m[3], 10) : 0,
      raw: normalized,
    }
  }
  return null
}

// ---------------------------------------------------------------------------
// Comparator público.
// ---------------------------------------------------------------------------

/**
 * Comparador estilo `Array.prototype.sort`: devuelve <0 si a va antes que b, >0 si después, 0 si empatan.
 *
 * Cuando dos entradas mapean a las MISMAS claves (categoría, primary, secondary, tertiary) se considera
 * que tienen la misma posición lógica y devuelve 0 — el sort de V8 (estable desde ES2019) preservará
 * el orden de inserción. Excepción: dentro de la categoría OTHER (desconocidos) sí desempata por orden
 * lexicográfico de `raw`, porque ahí no tenemos ningún criterio lógico mejor.
 */
export function compareArticleNumbers(a: string | null | undefined, b: string | null | undefined): number {
  const pa = parseArticleNumber(a)
  const pb = parseArticleNumber(b)
  if (pa.category !== pb.category) return pa.category - pb.category
  if (pa.primary !== pb.primary) return pa.primary - pb.primary
  if (pa.secondary !== pb.secondary) return pa.secondary - pb.secondary
  if (pa.tertiary !== pb.tertiary) return pa.tertiary - pb.tertiary
  if (pa.category === ArticleCategory.OTHER) return pa.raw.localeCompare(pb.raw, 'es')
  return 0
}

/**
 * Helper de conveniencia: ordena un array no-destructivamente por el `article_number`
 * (cualquiera que sea su nombre — pasa la accessor function).
 */
export function sortByArticleNumber<T>(arr: readonly T[], getNumber: (item: T) => string | null | undefined): T[] {
  return [...arr].sort((a, b) => compareArticleNumbers(getNumber(a), getNumber(b)))
}
