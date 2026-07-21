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

  return { semis, hasColon, segments, titSet, titGap, titComplete, closureWord, explicitArts, wholeLawWords, len: ep.length }
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

  let band: ScopeBand = 'NONE'
  if (score >= 50) band = 'HIGH'
  else if (score >= 30) band = 'MEDIUM'

  return { suspect: band !== 'NONE', band, score, coverage, reasons }
}
