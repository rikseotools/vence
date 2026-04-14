// lib/chat/domains/oposicion-catalog/OposicionCatalogService.ts
// Lógica de intent detection + matching contra catálogo + respuesta formateada

import { logger } from '../../shared/logger'
import {
  loadOposicionesCache,
  matchOposicion,
  registerOposicionRequest,
  type OposicionEntry,
} from './queries'

// ============================================
// INTENT DETECTION
// ============================================

// Verbos/frases que indican intención de preparar o añadir una oposición
const INTENT_VERBS = /(preparar|preparais|preparáis|prepareis|prepareis|tenemos|ten[eé]is|tienes|hay|estudiar|estudio|estudiais|añadir|anadir|agregar|incorporar|solicitar|ofreceis|ofrec[eé]is|conv[oó]cais|convocatoria\s+de|oposici[oó]n\s+de|oposici[oó]n\s+para|oposici[oó]n\s+a|oposiciones\s+de|quiero\s+preparar|me\s+interesa|me\s+gustaría\s+preparar)/i

// Roles/carreras que suelen formar nombres de oposición
const ROLE_KEYWORDS = /(auxiliar|t[eé]cnico|tecnico|celador|celadora|enfermer[oa]|m[eé]dico|polic[ií]a|bombero|guardia|militar|tramitaci[oó]n|gestor|gestora|administrativo|administrativa|subalterno|ordenanza|conserje|maestr[oa]|profesor|bibliotecario|archivero|secretari[oa]|interventor|notario|registrador|abogado|ingeniero|arquitecto|veterinario|trabajador\s+social|educador)/i

// Marcadores de follow-up (respuesta previa del assistant era de este dominio)
const RESPONSE_MARKERS = [
  '[oposicion-catalog]',
  'hemos registrado tu solicitud',
  'Sí, preparamos',
  'no tenemos esa oposición',
  'No tenemos **',
]

/**
 * Detecta si el mensaje tiene intención de preguntar/solicitar una oposición.
 */
export function detectOposicionIntent(message: string): boolean {
  // Debe mencionar un rol laboral típico de oposición
  if (!ROLE_KEYWORDS.test(message)) return false

  // Señales de intención: verbo de preparación, palabra "oposición",
  // o un mensaje corto (probablemente el usuario está tecleando solo el nombre)
  const hasVerb = INTENT_VERBS.test(message)
  const mentionsOposicion = /oposici[oó]n/i.test(message)
  const isShortMessage = message.length <= 80

  return hasVerb || mentionsOposicion || isShortMessage
}

/**
 * Detecta si el mensaje es follow-up de una respuesta previa de este dominio.
 */
export function isCatalogFollowUp(
  messages: Array<{ role: string; content: string }>,
  currentMessage: string
): boolean {
  const lastAssistant = [...messages].reverse().find(m => m.role === 'assistant')
  if (!lastAssistant) return false

  const wasCatalog = RESPONSE_MARKERS.some(m => lastAssistant.content.includes(m))
  if (!wasCatalog) return false

  // Follow-ups típicos: "se puede añadir?", "como la añado?", "cuándo la vais a tener?"
  const followUpPatterns = [
    /a[ñn]adir/i,
    /a[ñn]adirl[ao]/i,
    /agregar/i,
    /c[oó]mo\s+(la|lo)\s+(a[ñn]ado|preparo|consigo)/i,
    /cu[aá]ndo/i,
    /(esta|esa)\s+oposici[oó]n/i,
    /mientras\s+estudi/i,
  ]
  return followUpPatterns.some(p => p.test(currentMessage))
}

// ============================================
// RESPUESTA FORMATEADA
// ============================================

function formatMatchResponse(entry: OposicionEntry): string {
  const nombre = entry.shortName || entry.nombre
  const convocatoria = entry.isConvocatoriaActiva
    ? '\n\n📢 **La convocatoria está activa ahora mismo.**'
    : ''
  return `✅ **Sí, preparamos ${nombre}.**

Puedes activarla como tu oposición desde tu perfil, o consultar el temario en:

🔗 /${entry.slug}${convocatoria}

[oposicion-catalog]`
}

function formatNoMatchResponse(
  detectedName: string,
  feedbackId: string | null,
  deduplicated: boolean
): string {
  if (deduplicated) {
    return `ℹ️ **No tenemos esa oposición (${detectedName}) en el catálogo todavía.**

Ya teníamos una solicitud tuya reciente sobre esta oposición, así que el equipo de Vence está al tanto. Te avisaremos cuando esté disponible.

[oposicion-catalog]`
  }
  if (feedbackId) {
    return `ℹ️ **No tenemos esa oposición (${detectedName}) en el catálogo todavía.**

He registrado una solicitud al equipo de Vence para que la añadan lo antes posible. Gracias por indicárnoslo; te avisaremos cuando esté disponible.

[oposicion-catalog]`
  }
  // Falló el registro
  return `ℹ️ **No tenemos esa oposición (${detectedName}) en el catálogo todavía.**

Puedes escribirnos a soporte para pedir que la añadamos.

[oposicion-catalog]`
}

function formatFollowUpResponse(): string {
  return `Sí, puedes preparar varias oposiciones a la vez desde tu perfil. Sobre tu solicitud: ya está registrada y el equipo la revisará.

Si quieres añadir otra oposición que sí tengamos en el catálogo, dímela y te paso el enlace directo.

[oposicion-catalog]`
}

/**
 * Extrae una descripción corta de la oposición mencionada para guardar en el registro.
 * Intenta dejar sólo los tokens significativos del mensaje del usuario.
 */
export function extractDetectedName(message: string): string {
  const cleaned = message
    .replace(/[¿?¡!]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  // Recortar a primeras 120 chars y capitalizar
  const short = cleaned.length > 120 ? cleaned.slice(0, 120) + '…' : cleaned
  return short
}

// ============================================
// ORQUESTACIÓN
// ============================================

export interface CatalogResult {
  responseText: string
  matched: boolean
  matchedSlug: string | null
  feedbackId: string | null
  detectedName: string | null
  isFollowUp: boolean
}

export async function processOposicionCatalog(input: {
  message: string
  userId: string | null
  userOposicion: string | null
  logId: string | null
  isFollowUp: boolean
}): Promise<CatalogResult> {
  if (input.isFollowUp) {
    return {
      responseText: formatFollowUpResponse(),
      matched: false,
      matchedSlug: null,
      feedbackId: null,
      detectedName: null,
      isFollowUp: true,
    }
  }

  const cached = await loadOposicionesCache()
  const match = matchOposicion(input.message, cached)

  if (match.entry) {
    logger.info(`Oposición match: ${match.entry.slug} (score ${match.score.toFixed(2)})`, {
      domain: 'oposicion-catalog',
    })
    return {
      responseText: formatMatchResponse(match.entry),
      matched: true,
      matchedSlug: match.entry.slug,
      feedbackId: null,
      detectedName: null,
      isFollowUp: false,
    }
  }

  // Sin match → registrar solicitud
  const detectedName = extractDetectedName(input.message)
  const feedbackId = await registerOposicionRequest({
    userId: input.userId,
    detectedName,
    userMessage: input.message,
    userOposicion: input.userOposicion,
    logId: input.logId,
  })

  const deduplicated = feedbackId === null && !!input.userId
  const responseText = formatNoMatchResponse(detectedName, feedbackId, deduplicated)

  logger.info(`Oposición not in catalog → request ${feedbackId ? 'created' : 'deduped/failed'}`, {
    domain: 'oposicion-catalog',
    detectedName,
    feedbackId,
  })

  return {
    responseText,
    matched: false,
    matchedSlug: null,
    feedbackId,
    detectedName,
    isFollowUp: false,
  }
}
