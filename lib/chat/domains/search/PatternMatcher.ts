// lib/chat/domains/search/PatternMatcher.ts
// Detector de patrones en consultas de chat

import type { DetectedPattern, PatternType } from '../../core/types'
import { logger } from '../../shared/logger'
import { mapSlugToShortName as mapLawSlugToShortName, findShortNameByAbbreviation } from '@/lib/lawSlugSync'

// ============================================
// DEFINICIÓN DE PATRONES
// ============================================

interface QueryPattern {
  name: PatternType
  detect: (msg: string) => boolean
  keywords: string[]
  description: string
  suggestedLaws?: string[]
}

const QUERY_PATTERNS: Record<string, QueryPattern> = {
  plazos: {
    name: 'plazo',
    detect: (msg) => /plazos?|t[eé]rminos?|d[ií]as?\s*(h[aá]biles?|naturales?)|\bcu[aá]nto\s*tiempo\b|\bcu[aá]ntos?\s*d[ií]as?\b/i.test(msg),
    keywords: ['plazo', 'plazos', 'término', 'términos', 'días', 'hábiles', 'naturales', 'tiempo', 'máximo'],
    description: 'Consulta sobre plazos y términos legales',
    suggestedLaws: ['Ley 39/2015', 'Ley 40/2015'],
  },

  definiciones: {
    name: 'general',
    detect: (msg) => /\bqu[eé]\s+(es|son|significa)\b|\bdefin[ei]|concepto\s+de|\bexplica\s+(qu[eé]\s+es|el|la)\b/i.test(msg),
    keywords: ['definición', 'concepto', 'significa', 'entiende'],
    description: 'Consulta sobre definiciones y conceptos',
  },

  organos: {
    name: 'organo',
    detect: (msg) => /[oó]rganos?\s*(colegiados?|administrativos?|competentes?)|\bconsejo\s+de\s+ministros\b|\bgobierno\b|\bministros?\b|\bsecretar[ií]os?\b|\bsubsecretar[ií]os?\b|\bdirectores?\s+generales?\b/i.test(msg),
    keywords: ['órgano', 'órganos', 'colegiado', 'colegiados', 'consejo', 'ministro', 'gobierno', 'secretario', 'director'],
    description: 'Consulta sobre órganos administrativos',
    suggestedLaws: ['Ley 40/2015', 'Ley 50/1997'],
  },

  recursos: {
    name: 'recurso',
    detect: (msg) => /recursos?\s*(de)?\s*(alzada|reposici[oó]n|extraordinario|contencioso|administrativo)|\bc[oó]mo\s+recurr|\bimpugnar\b/i.test(msg),
    keywords: ['recurso', 'recursos', 'alzada', 'reposición', 'impugnar', 'impugnación', 'recurrente'],
    description: 'Consulta sobre recursos administrativos',
    suggestedLaws: ['Ley 39/2015'],
  },

  silencio: {
    name: 'procedimiento',
    detect: (msg) => /silencio\s*(administrativo|positivo|negativo)|\bfalta\s+de\s+resoluci[oó]n\b/i.test(msg),
    keywords: ['silencio', 'administrativo', 'positivo', 'negativo', 'desestimatorio', 'estimatorio'],
    description: 'Consulta sobre silencio administrativo',
    suggestedLaws: ['Ley 39/2015'],
  },

  notificaciones: {
    name: 'procedimiento',
    detect: (msg) => /notificaci[oó]n|notificar|notificaciones|\bc[oó]mo\s+se\s+notifica\b|\bd[oó]nde\s+se\s+notifica\b/i.test(msg),
    keywords: ['notificación', 'notificaciones', 'notificar', 'publicación', 'edicto', 'electrónica'],
    description: 'Consulta sobre notificaciones administrativas',
    suggestedLaws: ['Ley 39/2015'],
  },

  delegacion: {
    name: 'competencia',
    detect: (msg) => /delegaci[oó]n|delegar|\bavocaci[oó]n\b|\bencomienda\s+de\s+gesti[oó]n\b|\bsuplencia\b|\bsustituc/i.test(msg),
    keywords: ['delegación', 'delegar', 'avocación', 'encomienda', 'suplencia', 'sustitución', 'competencia'],
    description: 'Consulta sobre delegación de competencias',
    suggestedLaws: ['Ley 40/2015'],
  },

  responsabilidad: {
    name: 'sancion',
    detect: (msg) => /responsabilidad\s*(patrimonial|del\s+estado|administraci[oó]n)|\bindemnizaci[oó]n|\bda[ñn]os?\s*(y\s*perjuicios)?/i.test(msg),
    keywords: ['responsabilidad', 'patrimonial', 'indemnización', 'daños', 'perjuicios', 'lesión'],
    description: 'Consulta sobre responsabilidad patrimonial',
    suggestedLaws: ['Ley 40/2015'],
  },

  nulidad: {
    name: 'procedimiento',
    detect: (msg) => /nulidad|anulabilidad|nulos?\s+de\s+pleno|anulable|vicios?|revisi[oó]n\s+de\s+oficio/i.test(msg),
    keywords: ['nulidad', 'anulabilidad', 'nulo', 'anulable', 'vicio', 'revisión', 'oficio'],
    description: 'Consulta sobre nulidad y anulabilidad de actos',
    suggestedLaws: ['Ley 39/2015'],
  },

  sancionador: {
    name: 'sancion',
    detect: (msg) => /procedimiento\s+sancionador|potestad\s+sancionadora|sanci[oó]n|sanciones|infracci[oó]n|multa/i.test(msg),
    keywords: ['sanción', 'sanciones', 'sancionador', 'infracción', 'multa', 'potestad', 'expediente'],
    description: 'Consulta sobre procedimiento sancionador',
    suggestedLaws: ['Ley 39/2015', 'Ley 40/2015'],
  },

  interesados: {
    name: 'requisito',
    detect: (msg) => /\binteresados?\b.*procedimiento|\bqui[eé]n\s+(puede|es)\s+interesado|\bcapacidad\s+de\s+obrar\b|\blegitimaci[oó]n\b/i.test(msg),
    keywords: ['interesado', 'interesados', 'capacidad', 'legitimación', 'representación'],
    description: 'Consulta sobre interesados en el procedimiento',
    suggestedLaws: ['Ley 39/2015'],
  },

  convenios: {
    name: 'procedimiento',
    detect: (msg) => /convenios?\s*(administrativos?|colaboraci[oó]n)?|\bacuerdos?\s+de\s+colaboraci[oó]n\b/i.test(msg),
    keywords: ['convenio', 'convenios', 'acuerdo', 'colaboración', 'coordinación'],
    description: 'Consulta sobre convenios administrativos',
    suggestedLaws: ['Ley 40/2015'],
  },
}

// ============================================
// FUNCIONES PÚBLICAS
// ============================================

/**
 * Detecta el patrón que coincide con el mensaje
 */
export function detectQueryPattern(message: string): DetectedPattern | null {
  const msgLower = message.toLowerCase()

  for (const [patternId, pattern] of Object.entries(QUERY_PATTERNS)) {
    if (pattern.detect(msgLower)) {
      logger.debug(`Pattern detected: ${patternId}`, { domain: 'search' })

      return {
        type: pattern.name,
        confidence: calculateConfidence(msgLower, pattern.keywords),
        keywords: pattern.keywords,
        suggestedLaws: pattern.suggestedLaws,
      }
    }
  }

  return null
}

/**
 * Obtiene los keywords de un patrón por su tipo
 */
export function getPatternKeywords(patternType: PatternType): string[] {
  for (const pattern of Object.values(QUERY_PATTERNS)) {
    if (pattern.name === patternType) {
      return pattern.keywords
    }
  }
  return []
}

/**
 * Obtiene todos los patrones disponibles
 */
export function getAllPatterns(): QueryPattern[] {
  return Object.values(QUERY_PATTERNS)
}

// ============================================
// DETECCIÓN DE LEYES MENCIONADAS
// ============================================

// Aliases adicionales para detección en mensajes de chat (no URLs)
// Estos complementan el mapeo centralizado de lawMappingUtils.ts
const CHAT_LAW_ALIASES: Record<string, string[]> = {
  'Ley 39/2015': ['procedimiento administrativo', 'ley 39', 'la 39'],
  'Ley 40/2015': ['régimen jurídico', 'ley 40', 'la 40'],
  'Ley 50/1997': ['ley del gobierno', 'ley 50', 'la 50'],
  'CE': ['constitución española', 'carta magna', 'constitución'],
  'Ley 19/2013': ['transparencia', 'ley 19', 'la 19'],
  'RDL 5/2015': ['estatuto básico', 'empleado público'],
  'LOTC': ['ley orgánica del tribunal constitucional', 'tribunal constitucional'],
  'LO 6/1985': ['ley orgánica del poder judicial', 'poder judicial'],
  'LO 3/2007': ['ley de igualdad', 'igualdad efectiva'],
  'LO 5/1985': ['régimen electoral'],
  'LO 3/1981': ['defensor del pueblo'],
  'Reglamento UE 2016/679': ['rgpd', 'protección de datos personales', 'reglamento general de protección de datos', 'gdpr'],
}

/**
 * Detecta la ley específicamente asociada a un número de artículo
 * Ej: "art. 62 del TREBEP" -> TREBEP, "artículo 47 de la CE" -> CE
 * Esto tiene PRIORIDAD porque indica exactamente qué ley se necesita
 */
function detectLawFromArticlePattern(message: string): string | null {
  const msgLower = message.toLowerCase()

  // Patrón: art(ículo) X del/de la/de [LEY]
  // Captura la ley que viene JUSTO DESPUÉS del número de artículo
  const patterns = [
    /art[ií]culo\.?\s*\d+[.\s]*(?:\d+)?\s*(?:del?|de\s+la)\s+(\w+)/i,
    /art\.?\s*\d+[.\s]*(?:\d+)?\s*(?:del?|de\s+la)\s+(\w+)/i,
  ]

  for (const pattern of patterns) {
    const match = message.match(pattern)
    if (match && match[1]) {
      const lawAbbr = match[1].toLowerCase()
      // Mapear a nombre corto reconocido
      const shortName = mapLawSlugToShortName(lawAbbr)
      if (shortName) {
        return shortName
      }
    }
  }

  return null
}

/**
 * Detecta qué leyes se mencionan en el mensaje
 * Usa el mapeo centralizado de lawMappingUtils.ts + aliases específicos para chat
 */
/** Quita tildes y diacríticos para matching tolerante a acentos */
function stripAccents(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '')
}

export function detectMentionedLaws(message: string): string[] {
  const msgLower = message.toLowerCase()
  const msgNormalized = stripAccents(msgLower)
  const mentioned: string[] = []

  // 0. PRIORIDAD: Detectar ley asociada al número de artículo (art. X del TREBEP)
  const articleLaw = detectLawFromArticlePattern(message)
  if (articleLaw) {
    mentioned.push(articleLaw)
  }

  // 1. Detectar abreviaturas comunes (siglas culturales del derecho español).
  // Lookup en tres pasos:
  //   a) ABBR_TO_SHORTNAME explícito (siglas cuyo short_name canónico NO es
  //      la sigla, ej. LOPJ → "LO 6/1985", LBRL → "Ley 7/1985"). Lista finita
  //      y estable: ~50 siglas culturales que el cuerpo jurídico español ha
  //      consolidado en décadas. Añadir nuevas cuando aparezcan (raro).
  //   b) slug == abreviatura (cubre 'lotc' → LOTC porque su slug ES 'lotc')
  //   c) short_name == abreviatura case-insensitive (cubre CE, LECrim, CP, LSP,
  //      LOFCS que tienen short_name canónico = sigla en BD)
  const ABBR_TO_SHORTNAME: Record<string, string> = {
    lopj: 'LO 6/1985',
    lpac: 'Ley 39/2015',
    lrjsp: 'Ley 40/2015',
    trebep: 'RDL 5/2015', ebep: 'RDL 5/2015',
    loreg: 'LO 5/1985',
    rgpd: 'Reglamento UE 2016/679',
    lopdgdd: 'LO 3/2018', lopd: 'LO 3/2018',
    lec: 'Ley 1/2000',
    cc: 'Código Civil',
    lbrl: 'Ley 7/1985',
    lrjca: 'Ley 29/1998',
    lgt: 'Ley 58/2003',
    lgss: 'RDL 8/2015',
    let: 'RDL 2/2015', // Estatuto de los Trabajadores
    lgs: 'Ley 38/2003', // Subvenciones
    lpag: 'Ley 50/1997',
    ltbg: 'Ley 19/2013', // Transparencia
  }
  const commonAbbreviations = [
    'ce', 'lotc', 'lopj', 'lpac', 'lrjsp', 'trebep', 'ebep', 'loreg', 'rgpd',
    'lofcs', 'lopd', 'lopdgdd', 'lec', 'lecrim', 'cp', 'cc', 'lsp', 'lbrl',
    'lrjca', 'lgt', 'lgss', 'let', 'lgs', 'lpag', 'ltbg',
  ]
  for (const abbr of commonAbbreviations) {
    const regex = new RegExp(`\\b${abbr}\\b`, 'i')
    if (regex.test(msgLower)) {
      const shortName =
        ABBR_TO_SHORTNAME[abbr] ??
        mapLawSlugToShortName(abbr) ??
        findShortNameByAbbreviation(abbr)
      if (shortName && !mentioned.includes(shortName)) {
        mentioned.push(shortName)
      }
    }
  }

  // 2. Buscar en aliases específicos de chat (tolerante a tildes)
  // El usuario suele escribir sin tildes: "constitucion española" debe matchear
  // el alias "constitución española".
  for (const [lawName, aliases] of Object.entries(CHAT_LAW_ALIASES)) {
    for (const alias of aliases) {
      const aliasNorm = stripAccents(alias.toLowerCase())
      if (msgNormalized.includes(aliasNorm)) {
        if (!mentioned.includes(lawName)) {
          mentioned.push(lawName)
        }
        break
      }
    }
  }

  // Detectar patrones genéricos de ley (ej: "ley 40", "la 39/2015")
  const genericLawPattern = /(?:ley|l[ea])\s*(\d+)(?:\/(\d{4}))?/gi
  let match
  while ((match = genericLawPattern.exec(msgLower)) !== null) {
    const lawNum = match[1]
    const year = match[2]

    // Mapear número a ley conocida
    const knownLaw = mapLawNumber(lawNum, year)
    if (knownLaw && !mentioned.includes(knownLaw)) {
      mentioned.push(knownLaw)
    }
  }

  return [...new Set(mentioned)]
}

/**
 * Extrae leyes específicas mencionadas en el texto (Real Decreto, Ley Orgánica, etc.)
 * Devuelve el short_name tal como aparece en el texto para buscar en BD
 */
const SPANISH_MONTHS: Record<string, string> = {
  enero: '01', febrero: '02', marzo: '03', abril: '04',
  mayo: '05', junio: '06', julio: '07', agosto: '08',
  septiembre: '09', setiembre: '09', octubre: '10', noviembre: '11', diciembre: '12',
}

export function extractSpecificLawMentions(message: string): string[] {
  const mentions: string[] = []

  // Patrones para diferentes tipos de normas
  const patterns = [
    // Real Decreto: "Real Decreto 366/2007", "RD 366/2007"
    /(?:real\s+decreto|r\.?d\.?)\s*(\d+)\/(\d{4})/gi,
    // Ley Orgánica: "Ley Orgánica 3/2007", "LO 3/2007"
    /(?:ley\s+org[aá]nica|l\.?o\.?)\s*(\d+)\/(\d{4})/gi,
    // Real Decreto Legislativo: "RDL 5/2015", "Real Decreto Legislativo 5/2015"
    /(?:real\s+decreto\s+legislativo|r\.?d\.?l\.?)\s*(\d+)\/(\d{4})/gi,
    // Real Decreto-ley: "RDL 5/2015" (otro formato)
    /(?:real\s+decreto[- ]ley)\s*(\d+)\/(\d{4})/gi,
    // Reglamento UE: "Reglamento (UE) 2016/679", "Reglamento UE 2016/679"
    /(?:reglamento\s*\(?ue\)?)\s*(\d{4})\/(\d+)/gi,
  ]

  // Resolución por fecha en lenguaje natural: "Resolución de 7 de mayo de 2014"
  // → "Resolución 7/05/2014" (formato del short_name en BD).
  // findLawByName hará fuzzy match contra short_name/name.
  const resolutionPattern = /resoluci[oó]n\s+(?:de(?:l)?\s+)?(\d{1,2})\s+de\s+(\w+)\s+de\s+(\d{4})/gi
  let resMatch: RegExpExecArray | null
  while ((resMatch = resolutionPattern.exec(message)) !== null) {
    const day = resMatch[1].padStart(2, '0')
    const monthName = resMatch[2].toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    const year = resMatch[3]
    const monthNum = SPANISH_MONTHS[monthName]
    if (monthNum) {
      const lawRef = `Resolución ${parseInt(day, 10)}/${monthNum}/${year}`
      if (!mentions.includes(lawRef)) {
        mentions.push(lawRef)
      }
    }
  }

  for (const pattern of patterns) {
    let match
    while ((match = pattern.exec(message)) !== null) {
      const num = match[1]
      const year = match[2]

      // Determinar el tipo de norma basándose en el patrón
      const fullMatch = match[0].toLowerCase()
      let prefix = ''

      if (fullMatch.includes('orgánica') || fullMatch.includes('organica') || /l\.?o\.?/i.test(fullMatch)) {
        prefix = 'LO'
      } else if (fullMatch.includes('legislativo') || /r\.?d\.?l\.?/i.test(fullMatch)) {
        prefix = 'RDL'
      } else if (fullMatch.includes('decreto-ley') || fullMatch.includes('decreto ley')) {
        prefix = 'RDL'
      } else if (fullMatch.includes('real decreto') || /r\.?d\.?\s/i.test(fullMatch)) {
        prefix = 'RD'
      } else if (fullMatch.includes('reglamento') && fullMatch.includes('ue')) {
        // Reglamento UE: el formato es año/número, no número/año
        // Ejemplo: "Reglamento (UE) 2016/679" → num=2016, year=679
        // Pero realmente queremos "Reglamento UE 2016/679"
        const lawRef = `Reglamento UE ${num}/${year}`
        if (!mentions.includes(lawRef)) {
          mentions.push(lawRef)
        }
        continue
      }

      if (prefix) {
        const lawRef = `${prefix} ${num}/${year}`
        if (!mentions.includes(lawRef)) {
          mentions.push(lawRef)
        }
      }
    }
  }

  // Catch-all: bare "951/2005" without prefix — pass as-is to findLawByName
  // which does fuzzy matching against laws.short_name and laws.name
  const bareRef = /\b(\d{1,4}\/\d{4})\b/g
  let bareMatch
  while ((bareMatch = bareRef.exec(message)) !== null) {
    const ref = bareMatch[1]
    if (!mentions.some(m => m.includes(ref))) {
      mentions.push(ref)
    }
  }

  return mentions
}

function mapLawNumber(num: string, year?: string): string | null {
  // Si tenemos número y año, construir el short_name directamente
  // Esto cubre TODAS las leyes de la BD sin hardcodear (ej: "Ley 7/1985")
  if (year) {
    return `Ley ${num}/${year}`
  }

  // Sin año, solo podemos mapear las más comunes por número solo
  const lawMap: Record<string, string> = {
    '39': 'Ley 39/2015',
    '40': 'Ley 40/2015',
    '50': 'Ley 50/1997',
    '19': 'Ley 19/2013',
  }

  return lawMap[num] || null
}

/**
 * Detecta si es una consulta genérica sobre una ley
 */
export function isGenericLawQuery(
  message: string,
  mentionedLaws: string[],
  lawFromHistory = false
): boolean {
  if (mentionedLaws.length === 0) return false

  // Si la ley viene del historial, no es genérica
  if (lawFromHistory) return false

  const msgLower = message.toLowerCase().trim()

  // Si contiene un número de artículo, NO es genérica (quiere un artículo específico)
  // Patrones: "art 131", "artículo 21", "131 ley", "131 de la ley"
  const hasArticleNumber = /\b(?:art[ií]culo|art\.?)\s*\d+/i.test(message) ||
                           /\b\d{1,3}\s+(?:de\s+)?(?:la\s+)?ley\b/i.test(message)
  if (hasArticleNumber) return false

  // Si el mensaje es corto, probablemente es genérico
  if (message.length < 18) return true

  // Si es largo pero tiene más palabras además de la ley, no es genérico
  if (message.length > 30) {
    const wordsWithoutLaw = msgLower
      .replace(/ley\s*\d+\/?\d*/g, '')
      .replace(/\bla\s+\d+\b/g, '')
      .trim()
      .split(/\s+/)
      .filter(w => w.length > 2)

    if (wordsWithoutLaw.length >= 2) {
      return false
    }
  }

  // Patrones de consultas genéricas
  const genericPatterns = [
    /^(que|qué|cual|cuál)\s+(es|son)\s+(la|el)?\s*(ley|l)\s*\d/i,
    /^(explica|explícame|explicame)\s+(la|el)?\s*(ley|l)\s*\d/i,
    /^resumen\s+(de)?\s*(la|el)?\s*(ley|l)\s*\d/i,
    /^info(rmación)?\s*(de|sobre)?\s*(la|el)?\s*(ley|l)\s*\d/i,
  ]

  return genericPatterns.some(p => p.test(message))
}

// ============================================
// EXTRACCIÓN DE DATOS
// ============================================

export interface ExtractedPatternData {
  patternName: string
  patternDescription: string
  articlesFound: number
  details: Array<{
    article: string
    law: string
    title: string | null
    plazos?: string[]
    snippet?: string
  }>
}

/**
 * Extrae datos específicos de artículos según el patrón
 */
export function extractPatternData(
  patternType: PatternType,
  articles: Array<{ articleNumber: string; lawShortName: string; title: string | null; content: string | null }>
): ExtractedPatternData | null {
  if (!articles || articles.length === 0) return null

  const pattern = Object.values(QUERY_PATTERNS).find(p => p.name === patternType)
  if (!pattern) return null

  const extractedData: ExtractedPatternData = {
    patternName: pattern.name,
    patternDescription: pattern.description,
    articlesFound: articles.length,
    details: [],
  }

  // Extraer información según el patrón
  if (patternType === 'plazo') {
    articles.forEach(art => {
      const content = art.content || ''
      const plazoRegex = /(\d+)\s*(d[ií]as?|meses?|a[ñn]os?)\s*(h[aá]biles?|naturales?)?/gi
      const plazos = content.match(plazoRegex) || []

      if (plazos.length > 0 || content.toLowerCase().includes('plazo')) {
        extractedData.details.push({
          article: art.articleNumber,
          law: art.lawShortName,
          title: art.title,
          plazos: [...new Set(plazos)].slice(0, 5),
          snippet: content.substring(0, 300),
        })
      }
    })
  } else {
    // Para otros patrones, extraer snippet básico
    articles.forEach(art => {
      extractedData.details.push({
        article: art.articleNumber,
        law: art.lawShortName,
        title: art.title,
        snippet: (art.content || '').substring(0, 300),
      })
    })
  }

  return extractedData
}

// ============================================
// HELPERS
// ============================================

function calculateConfidence(message: string, keywords: string[]): number {
  let matchCount = 0
  const msgLower = message.toLowerCase()

  for (const keyword of keywords) {
    if (msgLower.includes(keyword.toLowerCase())) {
      matchCount++
    }
  }

  return Math.min(1, matchCount / Math.max(1, keywords.length / 2))
}
