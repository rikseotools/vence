// lib/chat/shared/unknownAbbreviationDetector.ts
// Detecta abreviaturas tipo sigla en mayúsculas (LOPJ, LPAC, TREBEP...) que NO
// están reconocidas ni como slug ni como short_name en la cache de leyes.
//
// Caso real: usuario escribe "Art 36 LOPJ" → el sistema no detecta LOPJ
// (su short_name canónico es 'LO 6/1985'), termina buscando en otra ley
// o sin contexto, y la IA inventa una respuesta o devuelve algo irrelevante.
//
// Mejor: detectar abreviaturas desconocidas y pedir aclaración al usuario
// ("¿Te refieres a la Ley Orgánica del Poder Judicial?") en vez de inventar.

import { findShortNameByAbbreviation, mapSlugToShortName } from '@/lib/lawSlugSync'

/**
 * Captura siglas en mayúsculas de 3-8 caracteres, opcionalmente seguidas de
 * sufijo minúsculo (LECrim). El filtrado anti-fragmento se hace después
 * comprobando que no esté rodeado de letras Unicode (descarta "ATRAV" como
 * trozo de "ATRAVÉS").
 *
 * Mínimo 3 chars descarta "LA", "DE", "EL", "TU" que aparecen en enunciados.
 * Se acepta perder siglas de 2 letras como "CP" o "CC" porque dan demasiado
 * ruido — esas leyes se detectan vía CHAT_LAW_ALIASES con su nombre completo.
 */
const ABBREVIATION_REGEX = /([A-ZÑ]{3,8}(?:[a-zñ]{2,4})?)/g

/**
 * Palabras en mayúsculas que NO son abreviaturas de leyes (filtro de ruido).
 * Pueden venir del usuario gritando o copiando enunciados oficiales.
 */
const NOT_ABBREVIATIONS = new Set([
  'CUALQUIER', 'CUAL', 'CUANDO', 'COMO', 'DONDE', 'PORQUE', 'PARA', 'CON',
  'POR', 'SIN', 'DEL', 'LOS', 'LAS', 'UNA', 'UNO', 'OTRO', 'OTRA',
  'ESTE', 'ESTA', 'ESTOS', 'ESTAS', 'ESO', 'ESA', 'AQUEL', 'AQUELLA',
  'ANTE', 'ANTES', 'TRAS', 'DESPUES', 'AHORA', 'HOY', 'AYER',
  'NUEVO', 'NUEVA', 'BIEN', 'MAL', 'MUY', 'MAS', 'MENOS',
  'PUEDE', 'TIENE', 'HACE', 'CASO', 'DICE', 'DEBE', 'AÑO', 'DIA',
  'YO', 'ELLA', 'NOSOTROS', 'VOSOTROS', 'ELLOS',
  'CIUDADANO', 'PERSONA', 'TRIBUNAL', 'TRIBUNALES',
  'RECURSO', 'AMPARO', 'LIBERTADES', 'DERECHOS', 'TUTELA',
  'CONSTITUCIONAL', 'ADMINISTRATIVO', 'JURIDICO',
  'RECABAR', 'EJERCER', 'OBSERVAR',
])

export interface UnknownAbbreviationResult {
  /** Lista de candidatos detectados (sin filtrar) */
  candidates: string[]
  /** Abreviaturas que el sistema NO reconoce (ni slug ni short_name en cache) */
  unknown: string[]
}

/**
 * Detecta si el mensaje está mayoritariamente en MAYÚSCULAS (usuario "gritando"
 * o copiando enunciados oficiales del BOE). En ese caso no podemos distinguir
 * con fiabilidad qué palabra es sigla y cuál es palabra normal capitalizada,
 * así que evitamos marcar "unknown" para no pedir aclaración sin razón.
 */
function isShoutyMessage(message: string): boolean {
  const words = message.split(/\s+/).filter(w => /[a-zñA-ZÑ]/.test(w) && w.length >= 2)
  if (words.length < 4) return false
  const allCaps = words.filter(w => w === w.toUpperCase() && /[A-ZÑ]/.test(w)).length
  return allCaps / words.length > 0.7
}

/**
 * Extrae abreviaturas candidatas del mensaje y separa cuáles son desconocidas.
 * "Desconocida" = no se encuentra en cache de slug NI de short_name.
 *
 * Si el mensaje está mayoritariamente en mayúsculas (modo "grito"), devolvemos
 * candidates pero NO marcamos ninguna como unknown — distinguir sigla de
 * palabra capitalizada accidentalmente no es fiable en ese contexto, mejor
 * dejar al pipeline normal de búsqueda intentar.
 */
export function detectUnknownAbbreviations(message: string): UnknownAbbreviationResult {
  const candidates: string[] = []
  const unknown: string[] = []
  const shouty = isShoutyMessage(message)

  // Regex es 'g' (stateful) — necesita reset entre llamadas
  ABBREVIATION_REGEX.lastIndex = 0
  const isLetter = /\p{L}/u

  let match: RegExpExecArray | null
  while ((match = ABBREVIATION_REGEX.exec(message)) !== null) {
    const candidate = match[1]
    const start = match.index
    const end = start + candidate.length

    // Anti-fragmento: si está rodeado de letras Unicode, es un trozo de
    // palabra acentuada (ej. "ATRAV" dentro de "ATRAVÉS").
    const charBefore = start > 0 ? message[start - 1] : ''
    const charAfter = end < message.length ? message[end] : ''
    if (isLetter.test(charBefore) || isLetter.test(charAfter)) continue

    if (NOT_ABBREVIATIONS.has(candidate.toUpperCase())) continue
    if (candidates.includes(candidate)) continue

    candidates.push(candidate)

    // ¿La reconocemos por slug exacto o por short_name canónico?
    const bySlug = mapSlugToShortName(candidate.toLowerCase())
    const byShortName = findShortNameByAbbreviation(candidate)
    if (!bySlug && !byShortName && !shouty) {
      unknown.push(candidate)
    }
  }

  return { candidates, unknown }
}

/**
 * Construye el mensaje que se le devuelve al usuario cuando hay abreviaturas
 * desconocidas y no podemos identificar la ley con confianza.
 */
export function buildClarificationRequest(unknownAbbrs: string[]): string {
  if (unknownAbbrs.length === 0) return ''
  const list = unknownAbbrs.map(a => `**${a}**`).join(', ')
  const plural = unknownAbbrs.length > 1
  return `Veo que mencionas ${list} pero ${plural ? 'no las tengo identificadas' : 'no la tengo identificada'} en mi base de leyes. ¿Puedes decirme el nombre completo o el número (ej. "LO 6/1985" o "Ley del Poder Judicial")? Así te busco el artículo exacto sin inventar.`
}
