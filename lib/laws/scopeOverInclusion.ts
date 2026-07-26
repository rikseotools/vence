// lib/laws/scopeOverInclusion.ts
//
// Detecta SOBRE-INCLUSIÓN de topic_scope: el epígrafe enumera sub-materias
// CONCRETAS de una ley pero el scope mete (casi) la LEY ENTERA. Punto ciego real
// (21/07, caso Luisa / Aux. Admvo. SMS T11): el epígrafe de la Ley 3/2009 nombra
// "atención y asistencia; intimidad y confidencialidad; información y
// participación; deberes" (Títulos II-IV + VII) pero el scope tenía los 73
// artículos. Los detectores del sweep sólo cazan HUECOS (empty_topic,
// low_coverage, scope_titulo_huerfano, scope_phantom_article) → un scope con la
// ley completa sirve muchas preguntas y parece sano; y el pipeline LLM
// verify:scope dio FALSO VERDE ("el epígrafe abarca toda la ley").
//
// Es un filtro Stage-1 DETERMINISTA de alta RECALL: baja 5.836 scopes → decenas
// de sospechosos. NO decide corrección (eso exige mapear la estructura de la ley:
// lo hace el adjudicador Stage-2 / verify:scope). Sólo SURFACEA candidatos.
//   - HIGH (título con hueco / artículos citados) = precisión alta, accionable.
//   - MEDIUM (sólo cobertura + enumeración, donde cae T11) = recall alto,
//     precisión ~35% → NO pinga el badge, alimenta la adjudicación bajo demanda.
//
// FUENTE ÚNICA del criterio. El sweep (scripts/health-sweep.cjs) lleva un mirror
// inline (imagen standalone sin lib/*.ts); mantener EN SYNC — el test fija las
// fixtures.

const ROMAN: Record<string, number> = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 }

export function romanToInt(s: string): number | null {
  s = s.toUpperCase().replace(/\.BIS$/, '')
  let n = 0
  for (let i = 0; i < s.length; i++) {
    const cur = ROMAN[s[i]]
    const nxt = ROMAN[s[i + 1]]
    if (cur == null) return null
    n += nxt && cur < nxt ? -cur : cur
  }
  return n
}

export interface EpigrafeFeatures {
  /** nº de ";" en el epígrafe */
  semis: number
  hasColon: boolean
  /** segmentos tras el primer colon separados por ";" O "," (enumeración) */
  segments: number
  /** títulos nombrados (0=Preliminar), ordenados y únicos */
  titSet: number[]
  /** los títulos nombrados tienen huecos en su secuencia (nombra II y IV, salta III) */
  titGap: boolean
  /** los títulos nombrados forman secuencia completa (o null si <2) */
  titComplete: boolean | null
  /** menciona "reforma" o "disposición adicional/…" (cierre de norma monográfica) */
  closureWord: boolean
  /** artículos citados EXPLÍCITAMENTE en el epígrafe ("arts. 45 a 49", "art. 51") */
  explicitArts: Set<number>
  /** el epígrafe declara la ley íntegra ("en su totalidad", "íntegra"…) */
  wholeLawWords: boolean
  /**
   * Literal del epígrafe que ACOTA la materia en prosa ("conceptos", "principios",
   * "ámbito de aplicación"…), o `null` si no acota. Se guarda el texto encontrado y no un
   * booleano a propósito: el motivo del hallazgo tiene que poder decir QUÉ lo disparó.
   * (Faltaba en la interfaz aunque `parseEpigrafe` ya lo devolvía y `classifyScope` lo
   * leía → typecheck roto en main; T-132, 26/07.)
   */
  acotaMateria: string | null
  len: number
}

/** Extrae rasgos deterministas del epígrafe. */
export function parseEpigrafe(ep: string | null | undefined): EpigrafeFeatures {
  ep = ep || ''
  const semis = (ep.match(/;/g) || []).length
  const hasColon = /:/.test(ep)

  // Títulos nombrados explícitamente ("Título Preliminar", "Título IV", "Título II.bis")
  const titulos: number[] = []
  const reTit = /[Tt][íi]tulo\s+(Preliminar|[IVXLC]+(?:\.bis)?)/g
  let m: RegExpExecArray | null
  while ((m = reTit.exec(ep)) !== null) {
    const tok = m[1]
    const val = /preliminar/i.test(tok) ? 0 : romanToInt(tok)
    if (val != null) titulos.push(val)
  }
  const titSet = [...new Set(titulos)].sort((a, b) => a - b)

  let titComplete: boolean | null = null
  let titGap = false
  if (titSet.length >= 2) {
    const max = titSet[titSet.length - 1]
    const missing: number[] = []
    for (let i = titSet[0]; i <= max; i++) if (!titSet.includes(i)) missing.push(i)
    titGap = missing.length > 0
    titComplete = !titGap
  }
  const closureWord = /\breforma\b|disposici[oó]n(?:es)?\s+(?:adicional|transitoria|derogatoria|final)/i.test(ep)

  // Fuerza de enumeración: nº de segmentos tras el PRIMER colon, separados por
  // ";" O "," (captura enumeraciones con coma, no sólo punto y coma). Ej. SERMAS
  // enumera "principios rectores, medidas..., prevención...; derechos..." (1 ";").
  let segments = 0
  if (hasColon) {
    const postColon = ep.slice(ep.indexOf(':') + 1)
    segments = postColon
      .split(/[;,]/)
      .map((s) => s.trim())
      .filter((s) => s.length >= 4 && /[a-záéíóúñ]/i.test(s)).length
  }

  // Artículos citados EXPLÍCITAMENTE ("arts. 45 a 49", "art. 51")
  const explicitArts = new Set<number>()
  const reRange = /art[íi]?c?u?l?o?s?\.?\s*(\d+)\s*(?:a|al|-|–)\s*(\d+)/gi
  while ((m = reRange.exec(ep)) !== null) {
    const a = +m[1]
    const b = +m[2]
    if (b - a >= 0 && b - a < 500) for (let i = a; i <= b; i++) explicitArts.add(i)
  }
  const reSingle = /art[íi]?c?u?l?o?\.?\s*(\d+)(?!\s*(?:a|al|-|–)\s*\d)/gi
  while ((m = reSingle.exec(ep)) !== null) explicitArts.add(+m[1])

  const wholeLawWords = /[íi]ntegr|en su totalidad|toda la ley|texto [íi]ntegro|el conjunto de la ley|la ley completa/i.test(ep)

  // Marcadores de ACOTACIÓN: el epígrafe nombra PARTES de la norma (conceptos,
  // principios, disposiciones generales…) en lugar de la norma entera. Por sí
  // solos no prueban nada —una norma pequeña puede consistir justo en eso—, por
  // lo que `classifyScope` solo los usa con leyes muy grandes. Se devuelve el
  // literal encontrado para poder explicarlo en el motivo, no un booleano: un
  // aviso que no dice QUÉ lo disparó no se puede adjudicar.
  const acotaMateria =
    (ep.match(
      /(concepto[s]?|principio[s]?|disposicion(?:es)? general(?:es)?|[áa]mbito de aplicaci[óo]n|definici[óo]n(?:es)?|especialmente protegid\w*|objeto y [áa]mbito)/i,
    ) || [null])[0]

  return { semis, hasColon, segments, titSet, titGap, titComplete, closureWord, explicitArts, wholeLawWords, acotaMateria, len: ep.length }
}

export type ScopeBand = 'HIGH' | 'MEDIUM' | 'CLEARED' | 'NONE'

export interface ScopeVerdict {
  suspect: boolean
  band: ScopeBand
  score: number
  coverage: number
  reasons: string[]
}

export interface ScopeInput {
  /** nº de artículos numéricos de la ley (en articles) */
  lawTotal: number
  /** nº de artículos numéricos escopados en este (tema, ley) */
  scopedCount: number
  epigrafe: string | null | undefined
}

/** Clasifica un (tema, ley) scope. Puro y determinista. */
export function classifyScope({ lawTotal, scopedCount, epigrafe }: ScopeInput): ScopeVerdict {
  const reasons: string[] = []
  const coverage = lawTotal > 0 ? scopedCount / lawTotal : 0
  const f = parseEpigrafe(epigrafe)

  const bigLaw = lawTotal >= 12
  const nearFull = coverage >= 0.9
  // Enumerador: colon + >=3 segmentos (por ";" o ","). Cubre enumeraciones con
  // coma (SERMAS) además de las de punto y coma (T11).
  const enumerator = f.hasColon && f.segments >= 3

  // Guardas negativas (limpian el candidato)
  if (f.wholeLawWords) {
    return { suspect: false, band: 'CLEARED', score: 0, coverage, reasons: ['epígrafe declara la ley íntegra → scope completo es correcto'] }
  }
  // Monográfico: epígrafe nombra títulos en secuencia COMPLETA + palabra de cierre
  if (f.titComplete && f.closureWord && nearFull) {
    return { suspect: false, band: 'CLEARED', score: 0, coverage, reasons: ['epígrafe enumera TODOS los títulos en secuencia + cierre (reforma/disposiciones) → ley completa legítima'] }
  }

  let score = 0

  // ALTA confianza A: el epígrafe CITA artículos concretos y el scope tiene >>
  if (f.explicitArts.size > 0 && bigLaw && scopedCount >= f.explicitArts.size * 2 && nearFull) {
    score += 60
    reasons.push(`epígrafe cita ${f.explicitArts.size} arts concretos pero scope tiene ${scopedCount}/${lawTotal}`)
  }
  // ALTA confianza B: epígrafe nombra títulos con HUECOS pero scope = ley entera
  if (f.titGap && nearFull && bigLaw) {
    score += 50
    reasons.push(`epígrafe nombra títulos con huecos (${f.titSet.join(',')}) pero scope cubre toda la ley`)
  }
  // MEDIA: ley grande + casi completa + epígrafe enumerador (patrón T11)
  if (bigLaw && nearFull && enumerator) {
    score += 30
    reasons.push(`ley grande (${lawTotal}) casi completa (${(coverage * 100).toFixed(0)}%) con epígrafe que enumera ${f.segments} bloques`)
  }
  // MEDIA (26/07/2026) — MATERIA ACOTADA EN PROSA, sin enumerar.
  //
  // Punto ciego encontrado al investigar por qué el RGPD tenía 54 artículos sin
  // preguntas: tres oposiciones escopaban sus 99 artículos para epígrafes que
  // piden una porción ("Conceptos y Principios en el tratamiento de los datos
  // personales", "disposiciones generales. Datos especialmente protegidos"). Las
  // dos reglas de arriba no los ven: no citan artículos, no nombran títulos y no
  // llegan a 3 segmentos tras el colon — acotan la materia en PROSA. El detector
  // devolvía NONE y el hueco parecía trabajo de generación cuando en realidad era
  // scope de más: generar esos 54 artículos habría servido preguntas fuera de
  // programa.
  //
  // CALIBRADO sobre las 4.000 parejas (tema, ley) del banco, no inventado: con el
  // marcador de acotación a secas salen 33 candidatos y la muestra mezcla —un
  // reglamento de archivos de 22 artículos escopado entero para "El archivo.
  // Concepto. Tipos de archivos…" es LEGÍTIMO, porque ahí la materia ES la norma
  // completa. El discriminante es el TAMAÑO: a partir de ~60 artículos, que un
  // epígrafe acote la materia y el scope traiga la ley entera deja de cuadrar.
  // Con ese corte quedan 18, del mismo patrón que el RGPD (Ley 2/2006 CyL 301/301
  // para "Concepto y estructura. Fases del ciclo presupuestario"; Ley 5/2025
  // Hacienda Madrid 197/197; Ley 29/1998 142/142 para un tema de recursos).
  //
  // Va a MEDIA a propósito: precisión estimada ~2/3, así que es cola de
  // adjudicación bajo demanda, NO señal de badge (mismo criterio que el patrón
  // T11). Exige `!enumerator` para no sumarse a la regla de arriba y promover a
  // HIGH por acumulación.
  const veryBigLaw = lawTotal >= 60
  if (veryBigLaw && nearFull && !enumerator && f.acotaMateria) {
    score += 30
    reasons.push(
      `ley muy grande (${lawTotal}) escopada al ${(coverage * 100).toFixed(0)}% pero el epígrafe ACOTA la materia en prosa ("${f.acotaMateria}") sin enumerar bloques`,
    )
  }

  let band: ScopeBand = 'NONE'
  if (score >= 50) band = 'HIGH'
  else if (score >= 30) band = 'MEDIUM'

  return { suspect: band !== 'NONE', band, score, coverage, reasons }
}
