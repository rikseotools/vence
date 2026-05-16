// lib/chat/domains/oposicion-catalog/OposicionCatalogService.ts
// Lógica de intent detection + matching contra catálogo + respuesta formateada

import { logger } from '../../shared/logger'
import {
  loadOposicionesCache,
  matchOposicion,
  registerOposicionRequest,
  type OposicionEntry,
} from './queries'

// re-export para que isCatalogListingRequest sea accesible desde el dominio
// (declarado más abajo)

// ============================================
// INTENT DETECTION
// ============================================

// Verbos/frases que indican intención de preparar o añadir una oposición
const INTENT_VERBS = /(preparar|preparais|preparáis|prepareis|prepareis|tenemos|ten[eé]is|tienes|hay|estudiar|estudio|estudiais|añadir|anadir|agregar|incorporar|solicitar|ofreceis|ofrec[eé]is|conv[oó]cais|convocatoria\s+de|oposici[oó]n\s+de|oposici[oó]n\s+para|oposici[oó]n\s+a|oposiciones\s+de|quiero\s+preparar|me\s+interesa|me\s+gustar[ií]a\s+preparar|temario\s+(de|para)|cuando\s+(esta|tendr[eé]is)|previsto\s+que\s+(suban|añadan))/i

// Roles/carreras que suelen formar nombres de oposición
// IMPORTANTE: \b al inicio para evitar falsos positivos con compuestos como "económico-administrativas"
const ROLE_KEYWORDS = /\b(auxiliar|t[eé]cnico|tecnico|celador|celadora|enfermer[oa]|m[eé]dico|polic[ií]a|bombero|guardia|militar|tramitaci[oó]n|gestor|gestora|administrativo|administrativa|subalterno|ordenanza|conserje|maestr[oa]|profesor|bibliotecario|archivero|secretari[oa]|interventor|notario|registrador|abogado|ingeniero|arquitecto|veterinario|trabajador\s+social|educador|tcae|tecae|aux\s+(advo|admvo|admin)|aux\.\s*adm)/i

// Topónimos / abreviaturas geográficas que indican una oposición concreta
// (cuando aparecen junto a una palabra de intención sin role explícito)
const REGION_KEYWORDS = /(madrid|barcelona|valencia|gva|generalitat\s+valenciana|andaluc[ií]a|canarias|galicia|asturias|cantabria|navarra|arag[oó]n|extremadura|baleares|murcia|carm|castilla\s+y\s+le[oó]n|cyl|castilla[\s-]*la\s+mancha|clm|la\s+rioja|sermas|sescam|sas|scs)/i

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
  const hasRole = ROLE_KEYWORDS.test(message)
  const hasRegion = REGION_KEYWORDS.test(message)
  const hasVerb = INTENT_VERBS.test(message)
  const mentionsOposicion = /oposici[oó]n/i.test(message)
  const mentionsTemario = /temario/i.test(message)
  const isShortMessage = message.length <= 80

  // Descartar falsos positivos: "administrativo/a" como adjetivo legal, no como rol
  // "procedimiento administrativo", "silencio administrativo", "recurso contencioso-administrativo"
  const roleInLegalContext = hasRole && /\b(procedimiento|silencio|acto|recurso|r[eé]gimen|derecho|contencioso|reclamaci[oó]n|potestad|jurisdicci[oó]n|v[ií]a|econ[oó]mico|regulaci[oó]n|regula)[\s-]+(administrativ)/i.test(message)
  // Descartar si es claramente una pregunta sobre contenido (no solicitud de oposición)
  const isContentQuestion = hasRole && /\b(art[ií]culo|qu[eé]\s+(quiere|significa|dice|establece|regula)|este\s+art|esta\s+ley)\b/i.test(message)
  const effectiveHasRole = hasRole && !roleInLegalContext && !isContentQuestion

  // Caso 1: rol + verbo de intención o mención explícita de "oposición" — patrón clásico
  if (effectiveHasRole && (hasVerb || mentionsOposicion)) return true

  // Caso 1b: rol + mensaje corto → probable solicitud de oposición
  // Ej: "auxiliar administrativo madrid", "tcae murcia", "guardia civil"
  if (effectiveHasRole && isShortMessage) return true

  // Caso 1c: rol + pregunta por info concreta (fecha examen, plazas, etc.)
  // Ej: "cuándo es el examen de auxiliar administrativo SMS" — sin verbo de
  // intención pero claramente busca datos de la oposición.
  if (effectiveHasRole && detectInfoIntent(message) !== null) return true

  // Caso 2: temario + región (sin role explícito) — "temario de Andalucía"
  if (mentionsTemario && hasRegion) return true

  // Caso 3: pregunta directa por catálogo — "qué oposiciones preparáis?"
  if (isCatalogListingRequest(message)) return true

  // Caso 4: pregunta por grupo funcionarial EBEP — "oposiciones grupo C1", "con C2 a qué optar"
  if (detectGrupoFuncionarial(message)) return true

  return false
}

/**
 * Detecta si el mensaje pide la lista de oposiciones del catálogo
 * (en lugar de una oposición concreta). En tal caso debemos responder con
 * listado, no con solicitud de alta.
 */
export function isCatalogListingRequest(message: string): boolean {
  return /(qu[eé]|cu[aá]les?)\s+oposici[oó]n(es)?\s+(prepar|ten|hay|ofrec|tene[ií]s|preparais|preparáis)/i.test(message)
}

/**
 * Detecta si el mensaje pregunta por oposiciones de un grupo funcionarial EBEP
 * (A1, A2, B, C1, C2). Ej: "oposiciones grupo C1", "con C2 a qué puedo optar".
 *
 * Devuelve el subgrupo detectado normalizado (A1/A2/B/C1/C2) o null.
 */
export function detectGrupoFuncionarial(message: string): string | null {
  // 1) "grupo X" / "subgrupo X" / "del grupo X" — forma explícita
  const mExplicit = message.match(/\b(?:sub)?grupo\s+([ABC][12]?)\b/i)
  if (mExplicit) return mExplicit[1].toUpperCase()

  // 2) "con X" / "tengo X" / "soy X" + contexto de oposiciones
  //    Ej: "con C1 a qué oposiciones puedo optar"
  //    Requiere mención explícita de oposición/acceso/optar para evitar falsos positivos
  //    (el LLM confundía C1 con nivel de inglés).
  const hasOposicionContext = /\b(oposici[oó]n|optar|acced[eí]|acceso|preparar|presentarme|examen(es)?|puesto|plaza)/i.test(message)
  if (hasOposicionContext) {
    const mImplicit = message.match(/\b(?:con|tengo|soy|para|siendo)\s+([ABC][12]?)\b/i)
    if (mImplicit) return mImplicit[1].toUpperCase()
  }

  return null
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
// DETECCIÓN DE INTENT DE INFO (fecha examen, plazas, convocatoria, estado)
// ============================================

export type InfoIntent = 'fecha_examen' | 'plazas' | 'convocatoria' | 'estado' | null

/**
 * Detecta si el usuario pregunta por info concreta de la oposición.
 * Devuelve el tipo de info pedida o null si solo pregunta "preparáis X".
 */
export function detectInfoIntent(message: string): InfoIntent {
  const m = message.toLowerCase()
  if (/(cu[aá]ndo|fecha)\s+(es\s+el?\s+|del?\s+|tendr[eé]?|ser[aá]?\s+el?\s+|del?\s+)?(examen|prueba)/i.test(m)) return 'fecha_examen'
  if (/fecha\s+de\s+(examen|prueba|convocatoria)/i.test(m)) return 'fecha_examen'
  if (/(cu[aá]ntas?|n[uú]mero\s+de)\s+plazas?/i.test(m)) return 'plazas'
  if (/plazas?\s+(hay|disponibles?|ofertad|libres|convocadas?|en\s+total)/i.test(m)) return 'plazas'
  if (/cu[aá]ndo\s+(sali[oó]|sali[oó]\s|salieron|salir|sale|sali[eé]ndose|public[oó]\s|publicar|publicaron|publica)\s+(la\s+)?convocatoria/i.test(m)) return 'convocatoria'
  if (/(en\s+qu[eé]\s+)?(estado|fase|momento)\s+(est[aá]|se\s+encuentra|va)/i.test(m)) return 'estado'
  return null
}

function formatDate(d: string | null, approximate: boolean | null): string {
  if (!d) return 'pendiente de publicar'
  // YYYY-MM-DD → DD/MM/YYYY
  const m = d.match(/^(\d{4})-(\d{2})-(\d{2})/)
  const formatted = m ? `${m[3]}/${m[2]}/${m[1]}` : d
  return approximate ? `${formatted} (aproximada)` : formatted
}

function formatInfoResponse(entry: OposicionEntry, intent: InfoIntent): string {
  const nombre = entry.shortName || entry.nombre
  switch (intent) {
    case 'fecha_examen':
      if (entry.examDate) {
        return `📅 **${nombre} — Fecha de examen**\n\nEl examen está previsto para el **${formatDate(entry.examDate, entry.examDateApproximate)}**.\n\nMás info: 🔗 /${entry.slug}\n\n[oposicion-catalog]`
      }
      return `📅 **${nombre}**\n\nLa fecha de examen aún no se ha publicado oficialmente. Lo actualizamos en cuanto salga.\n\nMás info: 🔗 /${entry.slug}\n\n[oposicion-catalog]`
    case 'plazas': {
      const libres = entry.plazasLibres ?? 0
      const disc = entry.plazasDiscapacidad ?? 0
      const interna = entry.plazasPromocionInterna ?? 0
      const total = libres + disc + interna
      if (total === 0) {
        return `🪪 **${nombre} — Plazas**\n\nNo tenemos el número de plazas registrado todavía.\n\nMás info: 🔗 /${entry.slug}\n\n[oposicion-catalog]`
      }
      const parts: string[] = []
      if (libres) parts.push(`**${libres}** turno libre`)
      if (disc) parts.push(`**${disc}** discapacidad`)
      if (interna) parts.push(`**${interna}** promoción interna`)
      return `🪪 **${nombre} — Plazas convocadas**\n\nTotal: **${total} plazas** (${parts.join(', ')}).\n\nMás info: 🔗 /${entry.slug}\n\n[oposicion-catalog]`
    }
    case 'convocatoria': {
      const ref = entry.boeReference ? ` (${entry.boeReference})` : ''
      if (entry.convocatoriaFecha) {
        return `📜 **${nombre} — Convocatoria**\n\nPublicada el **${formatDate(entry.convocatoriaFecha, false)}**${ref}.\n\nMás info: 🔗 /${entry.slug}\n\n[oposicion-catalog]`
      }
      return `📜 **${nombre}**\n\nLa convocatoria aún no se ha publicado o no la tenemos registrada.\n\nMás info: 🔗 /${entry.slug}\n\n[oposicion-catalog]`
    }
    case 'estado':
      if (entry.estadoProceso) {
        return `🚦 **${nombre} — Estado del proceso**\n\nEstado actual: **${entry.estadoProceso}**.\n\nMás info: 🔗 /${entry.slug}\n\n[oposicion-catalog]`
      }
      return `🚦 **${nombre}**\n\nNo tenemos el estado del proceso registrado.\n\nMás info: 🔗 /${entry.slug}\n\n[oposicion-catalog]`
    default:
      return formatMatchResponse(entry)
  }
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
  registerStatus: 'created' | 'deduplicated' | 'failed'
): string {
  const header = `ℹ️ **No tenemos esa oposición (${detectedName}) en el catálogo todavía.**`
  if (registerStatus === 'deduplicated') {
    return `${header}

Ya teníamos una solicitud tuya reciente sobre esta oposición, así que el equipo de Vence está al tanto. Te avisaremos cuando esté disponible.

[oposicion-catalog]`
  }
  if (registerStatus === 'created') {
    return `${header}

He registrado una solicitud al equipo de Vence para que la añadan lo antes posible. Gracias por indicárnoslo; te avisaremos cuando esté disponible.

[oposicion-catalog]`
  }
  // failed
  return `${header}

No he podido registrar la solicitud automáticamente. Puedes escribirnos a soporte para que la añadamos.

[oposicion-catalog]`
}

function formatFollowUpResponse(): string {
  return `Sí, puedes preparar varias oposiciones a la vez desde tu perfil. Sobre tu solicitud: ya está registrada y el equipo la revisará.

Si quieres añadir otra oposición que sí tengamos en el catálogo, dímela y te paso el enlace directo.

[oposicion-catalog]`
}

function formatGrupoFuncionarialResponse(
  subgrupo: string,
  entries: import('./queries').OposicionEntry[]
): string {
  // Normalizar: si piden "A" (sin 1/2), aceptar A1 y A2. Si piden "C", aceptar C1 y C2.
  const filter = (e: import('./queries').OposicionEntry): boolean => {
    if (!e.subgrupo) return false
    if (subgrupo.length === 2) return e.subgrupo.toUpperCase() === subgrupo
    return e.subgrupo.toUpperCase().startsWith(subgrupo)
  }
  const filtered = entries.filter(filter)

  if (filtered.length === 0) {
    return `ℹ️ **No tenemos oposiciones del grupo ${subgrupo} en el catálogo por ahora.**

Puedes ver todas las oposiciones disponibles preguntándome "¿qué oposiciones preparáis?".

[oposicion-catalog]`
  }

  const bySubgrupo: Record<string, string[]> = {}
  for (const e of filtered) {
    const sg = (e.subgrupo || '').toUpperCase()
    if (!bySubgrupo[sg]) bySubgrupo[sg] = []
    const conv = e.isConvocatoriaActiva ? ' 📢' : ''
    const titulo = e.tituloRequerido ? ` — _${e.tituloRequerido}_` : ''
    bySubgrupo[sg].push(`- [${e.shortName || e.nombre}](/${e.slug})${conv}${titulo}`)
  }

  const sections = Object.entries(bySubgrupo)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([sg, lines]) => `**Subgrupo ${sg}**\n${lines.sort().join('\n')}`)
    .join('\n\n')

  return `📚 **Oposiciones del grupo ${subgrupo}** que preparamos (${filtered.length}):

${sections}

📢 = convocatoria activa ahora mismo. Recuerda: el grupo funcionarial (EBEP) determina la titulación mínima exigida.

[oposicion-catalog]`
}

function formatListingResponse(entries: import('./queries').OposicionEntry[]): string {
  // Agrupar por categoría para legibilidad
  const grouped: Record<string, string[]> = {}
  for (const e of entries) {
    const cat = e.categoria || '—'
    if (!grouped[cat]) grouped[cat] = []
    const conv = e.isConvocatoriaActiva ? ' 📢' : ''
    grouped[cat].push(`- [${e.shortName || e.nombre}](/${e.slug})${conv}`)
  }
  const sections = Object.entries(grouped)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([cat, lines]) => `**${cat}**\n${lines.sort().join('\n')}`)
    .join('\n\n')
  return `📚 **Oposiciones disponibles en Vence** (${entries.length} en total):

${sections}

📢 = convocatoria activa ahora mismo. Si la oposición que buscas no está aquí, dímela y registro una solicitud al equipo.

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

  // Si pregunta por un grupo funcionarial (C1/C2/A1/A2/B) → filtrar BD y responder.
  // IMPORTANTE: evaluar ANTES que isCatalogListingRequest para no perder el filtro
  // cuando el usuario dice "qué oposiciones hay del grupo C1".
  const subgrupo = detectGrupoFuncionarial(input.message)
  if (subgrupo) {
    return {
      responseText: formatGrupoFuncionarialResponse(subgrupo, cached),
      matched: false,
      matchedSlug: null,
      feedbackId: null,
      detectedName: null,
      isFollowUp: false,
    }
  }

  // Si pide la lista del catálogo → devolverla (no registrar solicitud)
  if (isCatalogListingRequest(input.message)) {
    return {
      responseText: formatListingResponse(cached),
      matched: false,
      matchedSlug: null,
      feedbackId: null,
      detectedName: null,
      isFollowUp: false,
    }
  }

  const match = matchOposicion(input.message, cached)

  if (match.entry) {
    logger.info(`Oposición match: ${match.entry.slug} (score ${match.score.toFixed(2)})`, {
      domain: 'oposicion-catalog',
    })
    // Si el usuario pregunta por info concreta (fecha examen, plazas,
    // convocatoria, estado), responder con datos de BD en lugar del
    // "sí preparamos X" genérico.
    const infoIntent = detectInfoIntent(input.message)
    const responseText = infoIntent
      ? formatInfoResponse(match.entry, infoIntent)
      : formatMatchResponse(match.entry)
    return {
      responseText,
      matched: true,
      matchedSlug: match.entry.slug,
      feedbackId: null,
      detectedName: null,
      isFollowUp: false,
    }
  }

  // Sin match → registrar solicitud
  const detectedName = extractDetectedName(input.message)
  const register = await registerOposicionRequest({
    userId: input.userId,
    detectedName,
    userMessage: input.message,
    userOposicion: input.userOposicion,
    logId: input.logId,
  })

  const feedbackId = register.status === 'created' ? register.id
    : register.status === 'deduplicated' ? register.existingId
    : null
  const responseText = formatNoMatchResponse(detectedName, register.status)

  logger.info(`Oposición not in catalog → ${register.status}`, {
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
