// lib/chat/domains/knowledge-base/queries.ts
// Queries para la base de conocimiento

import { getDb, getReadDb } from '@/db/client'
import { aiKnowledgeBase } from '@/db/schema'
import { eq, and, or, ilike, desc, sql } from 'drizzle-orm'
import { logger } from '../../shared/logger'

// Formatea un embedding (number[]) como literal pgvector para ::vector
const toVector = (embedding: number[]) => `[${embedding.join(',')}]`

// ============================================
// TIPOS
// ============================================

export interface KnowledgeBaseEntry {
  id: string
  category: string
  subcategory: string | null
  title: string
  content: string
  shortAnswer: string | null
  keywords: string[]
  priority: number
  similarity?: number
  metadata?: Record<string, unknown>
}

export type KBCategory = 'planes' | 'funcionalidades' | 'faq' | 'plataforma' | 'oposiciones'

// ============================================
// BÚSQUEDA SEMÁNTICA
// ============================================

/**
 * Busca en la knowledge base usando embeddings
 */
export async function searchKnowledgeBase(
  embedding: number[],
  options: {
    threshold?: number
    limit?: number
    category?: KBCategory | null
  } = {}
): Promise<KnowledgeBaseEntry[]> {
  const { threshold = 0.40, limit = 3, category = null } = options

  try {
    const db = getReadDb()
    const data = (await db.execute(sql`
      SELECT * FROM match_knowledge_base(
        ${toVector(embedding)}::vector,
        ${threshold},
        ${limit},
        ${category}
      )
    `)) as any[]

    if (data && data.length > 0) {
      logger.debug(`Knowledge base: ${data.length} results (best: ${(data[0].similarity * 100).toFixed(1)}%)`, {
        domain: 'knowledge-base',
      })
    }

    return (data || []).map(mapKBEntry)
  } catch (err) {
    logger.error('Error in searchKnowledgeBase', err, { domain: 'knowledge-base' })
    return []
  }
}

// ============================================
// BÚSQUEDA POR KEYWORDS
// ============================================

/**
 * Busca en la knowledge base por keywords (fallback sin embeddings)
 */
export async function searchKnowledgeBaseByKeywords(
  keywords: string[],
  options: {
    limit?: number
    category?: KBCategory | null
  } = {}
): Promise<KnowledgeBaseEntry[]> {
  const { limit = 3, category = null } = options

  if (keywords.length === 0) {
    return []
  }

  try {
    // Condiciones OR: cada keyword buscado en title, content y short_answer (ILIKE)
    const orConditions = keywords.flatMap(kw => [
      ilike(aiKnowledgeBase.title, `%${kw}%`),
      ilike(aiKnowledgeBase.content, `%${kw}%`),
      ilike(aiKnowledgeBase.shortAnswer, `%${kw}%`),
    ])

    const conditions = [eq(aiKnowledgeBase.isActive, true), or(...orConditions)]
    if (category) {
      conditions.push(eq(aiKnowledgeBase.category, category))
    }

    const db = getReadDb()
    const rows = await db
      .select()
      .from(aiKnowledgeBase)
      .where(and(...conditions))
      .orderBy(desc(aiKnowledgeBase.priority))
      .limit(limit)

    return rows.map(r => ({
      id: r.id,
      category: r.category,
      subcategory: r.subcategory,
      title: r.title,
      content: r.content,
      shortAnswer: r.shortAnswer,
      keywords: r.keywords || [],
      priority: r.priority || 0,
      metadata: (r.metadata as Record<string, unknown>) || {},
    }))
  } catch (err) {
    logger.error('Error in searchKnowledgeBaseByKeywords', err, { domain: 'knowledge-base' })
    return []
  }
}

// ============================================
// BÚSQUEDA POR CATEGORÍA
// ============================================

/**
 * Obtiene todas las entradas de una categoría
 */
export async function getByCategory(
  category: KBCategory,
  options: { limit?: number; activeOnly?: boolean } = {}
): Promise<KnowledgeBaseEntry[]> {
  const { limit = 20, activeOnly = true } = options

  try {
    const db = getDb()

    let query = db
      .select()
      .from(aiKnowledgeBase)
      .where(eq(aiKnowledgeBase.category, category))
      .orderBy(aiKnowledgeBase.priority)
      .limit(limit)

    if (activeOnly) {
      query = db
        .select()
        .from(aiKnowledgeBase)
        .where(and(
          eq(aiKnowledgeBase.category, category),
          eq(aiKnowledgeBase.isActive, true)
        ))
        .orderBy(aiKnowledgeBase.priority)
        .limit(limit)
    }

    const results = await query

    return results.map(r => ({
      id: r.id,
      category: r.category,
      subcategory: r.subcategory,
      title: r.title,
      content: r.content,
      shortAnswer: r.shortAnswer,
      keywords: r.keywords || [],
      priority: r.priority || 0,
      metadata: r.metadata as Record<string, unknown> || {},
    }))
  } catch (err) {
    logger.error('Error in getByCategory', err, { domain: 'knowledge-base' })
    return []
  }
}

/**
 * Obtiene una entrada específica por ID
 */
export async function getById(id: string): Promise<KnowledgeBaseEntry | null> {
  try {
    const db = getReadDb()
    const rows = await db
      .select()
      .from(aiKnowledgeBase)
      .where(eq(aiKnowledgeBase.id, id))
      .limit(1)

    const r = rows[0]
    if (!r) {
      return null
    }

    return {
      id: r.id,
      category: r.category,
      subcategory: r.subcategory,
      title: r.title,
      content: r.content,
      shortAnswer: r.shortAnswer,
      keywords: r.keywords || [],
      priority: r.priority || 0,
      metadata: (r.metadata as Record<string, unknown>) || {},
    }
  } catch (err) {
    logger.error('Error in getById', err, { domain: 'knowledge-base' })
    return null
  }
}

// ============================================
// DETECCIÓN DE CATEGORÍA
// ============================================

const CATEGORY_PATTERNS: Record<KBCategory, RegExp[]> = {
  planes: [
    /plan(es)?\s*(free|premium|pro|gratis|pago)/i,
    /precio|coste|cu[aá]nto\s+cuesta/i,
    /suscripci[oó]n|pagar|pago/i,
    /qu[eé]\s+incluye/i,
    /diferencia.*plan/i,
  ],
  funcionalidades: [
    /c[oó]mo\s+(funciona|uso|hago|puedo)/i,
    /d[oó]nde\s+(est[aá]|encuentro|veo)/i,
    /qu[eé]\s+(puedo|hay|tiene)/i,
    /funcionalidad|caracter[ií]stica/i,
    // Temarios
    /temario(s)?\s+(gratis|gratuito|free)/i,
    /hay\s+temario/i,
    /d[oó]nde.*temario/i,
    /tienen\s+temario/i,
  ],
  faq: [
    /problema|error|no\s+(funciona|puedo|me\s+deja)/i,
    /ayuda|soporte|contacto/i,
    /c[oó]mo\s+contacto/i,
    // Cancelación y devoluciones
    /cancel(ar|aci[oó]n|o)/i,
    /devol(ver|uci[oó]n)/i,
    /reembolso/i,
    /garant[ií]a/i,
    /baja.*suscripci[oó]n/i,
  ],
  plataforma: [
    /vence|aplicaci[oó]n|app|plataforma/i,
    /qui[eé]n(es)?\s+(sois|son|cre[oó])/i,
    /sobre\s+(nosotros|vosotros|la\s+app)/i,
  ],
  oposiciones: [
    /oposici[oó]n|oposiciones/i,
    /auxiliar\s+administrativo/i,
    /temario|contenido/i,
    /cu[aá]ntas?\s+preguntas/i,
  ],
}

/**
 * Detecta la categoría más probable para un mensaje
 */
export function detectCategory(message: string): KBCategory | null {
  const msgLower = message.toLowerCase()

  for (const [category, patterns] of Object.entries(CATEGORY_PATTERNS)) {
    if (patterns.some(p => p.test(msgLower))) {
      return category as KBCategory
    }
  }

  return null
}

/**
 * Detecta si un mensaje es una consulta sobre la plataforma
 */
export function isPlatformQuery(message: string): boolean {
  // Saludos puros y preguntas abiertas de "qué puedes hacer". Antes caían a
  // fallback genérico (cluster A de la auditoría 27/05/2026, ~10 logs/15d).
  // KB las maneja con predefined response en getPredefinedResponse.
  const greetingOrHelp =
    /^[¡¿]*\s*(hola+|holi+|buenos\s+d[ií]as|buenas(\s+(tardes|noches))?|hey+|saludos|qu[eé]\s+tal|hi+|hello)[\s!\.,¡?¿\]]*$/i.test(message.trim()) ||
    (
      message.trim().split(/\s+/).length <= 10 &&
      /^[¡¿]*\s*(c[oó]mo\s+(me\s+)?(puedes\s+)?(ayud|asist)|qu[eé]\s+(me\s+)?(puedes|sabes\s+hacer|podr[ií]as?)\s+(ayud|hacer|asist|decir|ofrec)|en\s+qu[eé]\s+(me\s+)?puedes\s+ayud|para\s+qu[eé]\s+sirves|qu[eé]\s+haces|qui[eé]n\s+eres)/i.test(message.trim())
    )
  if (greetingOrHelp) return true

  // Mensaje emocional/queja sobre la oposición (cluster F auditoría 27/05/2026).
  // KB responde con empatía + redirige a herramientas concretas. Antes caía
  // a fallback genérico sin contención humana.
  const emotional =
    /\b(agobiad|estresad|nervios|frustrad|cansad|hart[oa]|desesperad|ansie?dad|abrumad|saturad)/i.test(message) ||
    /no\s+puedo\s+m[aá]s|me\s+rindo|voy\s+a\s+(abandonar|dejarlo|rendirme)|esto\s+es\s+imposible/i.test(message)
  if (emotional) return true

  // Excluir consultas de progreso personal que deben ir a StatsDomain
  const personalProgressPatterns = [
    /c[oó]mo\s+voy/i,
    /(mis|mi)\s+(fallo|error|punto.*d[eé]bil|[aá]rea.*d[eé]bil)/i,
    /d[oó]nde\s+fallo/i,
    /qu[eé]\s+(he\s+fallado|debo\s+repasar)/i,
  ]

  // Si es consulta de progreso personal, NO es query de plataforma
  if (personalProgressPatterns.some(p => p.test(message))) {
    return false
  }

  // Excluir consultas sobre temarios/temas que deben ir a TemarioDomain
  const temarioPatterns = [
    /\b(en\s+)?qu[eé]\s+tema\b/i,
    /\bcu[aá]ntos\s+temas\b/i,
    /\bd[oó]nde\s+(se\s+)?(estudia|entra|ve\b|trata|aparece)/i,
    /^tema\s+/i,
    /qu[eé]\s+temas\s+(hay|tiene|incluye|cubre)/i,
    /qu[eé]\s+oposiciones\s+(ten[eé]is|hay|prepar[aá]is)/i,
    /\bep[ií]grafe/i,
    /\bprograma\s+(de\s+)?(la\s+)?oposici[oó]n/i,
    /entra.*\b(temario|programa)\b/i,
    /\b(temario|programa)\b.*entra/i,
    /\bbloque\s+(I{1,3}|IV|V|\d+)\b/i,
    /\bver\s+(todos\s+)?(los\s+)?temas\b/i,
  ]
  if (temarioPatterns.some(p => p.test(message))) {
    return false
  }

  const platformIndicators = [
    /plan(es)?|precio|suscripci[oó]n|suscribi|premium|free|comprar.*apart|pagar.*apart|incluye.*premium|incluido.*premium/i,
    /c[oó]mo\s+(funciona|uso|hago)/i,
    /la\s+(app|aplicaci[oó]n|plataforma|p[aá]gina)/i,
    /vence/i,
    /soporte|contacto|contactar/i,
    /hablar\s+(con\s+)?(un\w?\s+)?(agente|persona|humano|alguien)/i,
    /atenci[oó]n\s+al?\s+cliente/i,
    // "ayuda" solo cuando es sobre la plataforma, no cuando es "ayúdame con el artículo 14"
    /ayuda.*(plataforma|app|suscripci|plan\b|cuenta|contrase|perfil|configurar)/i,
    /(plataforma|app|suscripci|plan\b|cuenta|contrase|perfil|configurar).*ayuda/i,
    /necesito\s+(soporte|ayuda\s+t[eé]cnica)/i,
    /funcionalidad|caracter[ií]stica/i,
    // Problemas técnicos / bugs reportados por usuarios
    // Acepta órdenes "no se me cargan", "no me se cargan" (cluster F auditoría 27/05/2026)
    /(no\s+se\s+(me\s+)?(carga|cargan|abre|abren)|no\s+me\s+(se\s+)?(deja|carga|cargan|aparece|sale|funciona)|no\s+funciona|no\s+puedo\s+(acceder|entrar))/i,
    /(error|bug|fallo)\s+(en|al|del|de\s+la)/i,
    /(porqu[eé]|por\s+qu[eé])\s+no\s+(se|me|puedo|funciona)/i,
    /(pantalla\s+en\s+blanco|se\s+queda\s+colgad|se\s+ha\s+colgad)/i,
    /test(s)?\s+(personalizad|r[aá]pid|oficial)/i,
    // "estadísticas" de la PLATAFORMA (no estadísticas personales)
    /estad[ií]sticas\s+(de\s+la\s+)?(app|plataforma|vence)/i,
    /racha/i,
    // Cancelacion y devoluciones
    /cancel(ar|aci[oó]n|o)/i,
    /devol(ver|uci[oó]n)/i,
    /reembolso/i,
    /garant[ií]a.*devoluci[oó]n/i,
    /dar(me)?\s+de\s+baja/i,
    /(me\s+)?doy\s+de\s+baja/i,
    // Descargar/imprimir/escuchar temario (funcionalidad, no contenido)
    /(descarg|imprim|guard|baj|escuch|le[eé]r|o[ií]r)\w*\s+(el\s+|en\s+)?(temario|temas|pdf|voz\s+alta)/i,
    /temario\s+(en\s+)?(pdf|descargar|imprimir|voz|audio)/i,
    /(voz\s+alta|audio)\s+(del?\s+)?(temario|temas)/i,
    // Temarios (solo consultas genericas sobre la plataforma, no sobre contenido)
    /temario(s)?\s+(gratis|gratuito|free)/i,
    /contenido\s+(gratis|gratuito)/i,
    /qu[eé]\s+ofrece/i,
    // Test Multi-Ley
    /multi[- ]?ley/i,
    /(varias|diferentes|m[uú]ltiples|distintas)\s+leyes/i,
    /combinar\s+(leyes|normativa)/i,
    /mezclar\s+(leyes|preguntas)/i,
    /test\s+de\s+.*leyes/i,
    // Simulacros y modo examen
    /sim[iu]lacro/i,
    /modo\s+examen/i,
    /examen\s+(completo|simulado|de\s+prueba|real)/i,
    /practicar\s+(un\s+)?examen/i,
    // Funcionalidades de test
    /repas(o|ar)\s+(de\s+)?fallo/i,
    /test\s+(de\s+)?(mis\s+)?fallo/i,
    /test\s+(de\s+)?art[ií]culo/i,
    /test\s+(de\s+)?ley/i,
    /test\s+(de\s+)?examen/i,
    /modo\s+adaptativo/i,
    // Preguntas sobre la plataforma
    /\b(hay|ten[eé]is|existe|se\s+puede)\b.*(test|examen|simulacro|practicar|repas|psicot[eé]c)/i,
    /practicar.*psicot[eé]c/i,
    /\bqu[eé]\s+(tipo|clase)s?\s+de\s+(test|examen|ejercicio)/i,
    /\bqu[eé]\s+(puedo|se\s+puede)\s+hacer\s+(aqu[ií]|en\s+(la\s+)?(app|plataforma))/i,
    // Test de articulo
    /test\s+(de|por|solo|de\s+un)\s+(un\s+)?art[ií]culo/i,
    /practicar\s+(un\s+)?art[ií]culo/i,
    /\b(hacer|puedo)\b.*test.*art[ií]culo/i,
    // Preguntas oficiales
    /pregunta.*oficial/i,
    /ex[aá]me?n(es)?\s+oficial/i,
    // Donde veo X (funcionalidad de la plataforma)
    /d[oó]nde\s+(veo|est[aá]n?|encuentro|puedo\s+ver)\s+(mis\s+|los\s+|las\s+|mi\s+)?(estad[ií]stica|impugnaci|notificaci|perfil|suscripci|test|tests|resultado|historial)/i,
    /ver\s+(mis|los)\s+(test|tests|resultado|historial)/i,
    // Impugnaciones y disputas
    /impugna(r|ci[oó]n(es)?|da|das)\s+(una\s+|la\s+|de\s+)?(pregunta|respuesta|cuesti[oó]n|test)/i,
    /\b(mis|ver|las)\s+impugnaci/i,
    /disputar?\b/i,
    /reportar\s+(una\s+)?pregunta/i,
    // Convocatorias
    /convocatoria/i,
    /plazas?\s+(disponible|ofertada|publicada)/i,
    // Problemas de suscripcion / billing
    /(ya\s+)?pagu[eé]|he\s+pagado/i,
    // Cambiar oposición / seleccionar otra oposición
    /cambiar\s+(de\s+)?oposici[oó]n/i,
    /elegir\s+(otra\s+)?oposici[oó]n/i,
    /seleccionar\s+(otra\s+)?oposici[oó]n/i,
    /poner\s+(otra\s+)?oposici[oó]n/i,
    /(quiero|me\s+sale)\s+(la\s+)?(del?\s+)?estado\b.*\bmadr/i,
    /(quiero|me\s+sale)\s+(la\s+)?(del?\s+)?madr.*\bestado\b/i,
    /me\s+sale\s+(la\s+)?(oposici[oó]n|del\s+estado|otra)/i,
    /no\s+(es\s+)?mi\s+oposici[oó]n/i,
    /oposici[oó]n\s+(equivocada|incorrecta|mal)/i,
    /c[oó]mo\s+(cambio|elijo|selecciono).*oposici[oó]n/i,
    // Peticiones de crear/preparar tests (incluye variantes "preguntas", "cuestionario", "quiz")
    /prep[aá]ra(me|nos)?\s+(un\s+)?(test|quiz|cuestionario|preguntas?)/i,
    /hazme\s+(un\s+)?(test|quiz|cuestionario|preguntas?)/i,
    /me\s+(haces|creas|generas|preparas)\s+(un\s+)?(test|quiz|cuestionario|preguntas?)/i,
    /puedes\s+(hacer|crear|generar|preparar)(me)?\s+(un\s+)?(test|quiz|cuestionario|preguntas?)/i,
    /cr[eé]a(me)?\s+(un\s+)?(test|quiz|cuestionario|preguntas?)/i,
    /gen[eé]ra(me)?\s+(un\s+)?(test|quiz|cuestionario|preguntas?)/i,
    /quiero\s+(un\s+)?(test|quiz|cuestionario|practicar)\b/i,
    /necesito\s+(un\s+)?(test|quiz|cuestionario)\b/i,
    // Ver resultados / historial de tests y simulacros
    /(dame|ver|enseñ[aá]|muestra|dime)\s*(los\s*)?(resultado|estad[ií]stica|nota|puntuaci[oó]n)/i,
    /resultado.*que\s*he\s*(hecho|sacado|obtenido)/i,
    /resultado.*(sim[iu]lacro|examen|test)/i,
    /historial\s*(de\s*)?(test|examen|sim[iu]lacro)/i,
    // Quejas o dudas sobre comportamiento de la plataforma
    /por\s*qu[eé]\s*(me\s*)?(salen?|aparecen?|encuentro)\s*(preguntas?|temas?)/i,
    /selecciono\s+(un\s+)?tema.*preguntas?\s*(de\s+)?otro/i,
    /(preguntas?|temas?)\s*(de\s+)?otros?\s*(temas?|leyes?).*por\s*qu[eé]/i,
    // Imprimir, guardar, descargar tests/temario
    /imprim(ir|o|e|imos)/i,
    /guardar\s+(el\s+)?(test|resultado|examen)/i,
    /descargar/i,
    /\bpdf\b/i,
    /exportar/i,
    // Mnemotécnicas: ya NO se interceptan aquí — el LLM (verification/search/fallback)
    // las genera correctamente. Antes respondía "no tengo este servicio" pero sí funciona.
    // Quejas: no puedo hacer test / no me deja / no me cuenta progreso
    /no\s+(me\s+|se\s+)?(puedo|deja|sale)\s+.*(hacer|realizar|acceder\s+al?)\s+(\w+\s+){0,2}(test|examen|pregunta|sim[iu]lacro)/i,
    /por\s*qu[eé]\s+no\s+(me\s+|se\s+)?(puedo|deja|sale)\s+.*(test|pregunta|examen)/i,
    /no\s+(me\s+|se\s+)?(cuenta|registra|guarda|contabiliza)\s+.*(test|pregunta|progreso|resultado|respuest)/i,
    // Onboarding / primeros pasos
    /no\s+s[eé]\s+por\s+d[oó]nde\s+empez/i,
    /por\s+d[oó]nde\s+(puedo\s+)?empez(ar|o)/i,
    /c[oó]mo\s+empiezo/i,
    /\bsoy\s+nuevo\b/i,
    /acabo\s+de\s+registr/i,
    /primeros\s+pasos/i,
    // Sesión / autenticación / perfil
    /(iniciar|cerrar|abrir|salir\s+de\s+la)\s+sesi[oó]n/i,
    /no\s+puedo\s+(entrar|iniciar\s+sesi[oó]n|acceder|loguearme|logearme|hacer\s+login)/i,
    /\b(login|logout|log\s*in|log\s*out)\b/i,
    /(olvid[eéó]|restabl|recuperar|cambiar|no\s+(me\s+)?(funciona|recuerdo|sé|se))\s+(la\s+|mi\s+)?(contrase[ñn]a|password)/i,
    /(contrase[ñn]a|password)\s+(olvidad|olvidé|no\s+(me\s+)?funciona|restabl|no\s+(la|me)\s+(recuerdo|funciona|sé))/i,
    /(mi\s+)?(foto|avatar|imagen\s+de\s+perfil|nombre\s+de\s+usuario)/i,
    /(cambiar|actualizar|editar|modificar)\s+(mi\s+)?(email|correo|perfil|contrase[ñn]a|datos)/i,
    /eliminar\s+(mi\s+)?cuenta/i,
  ]

  return platformIndicators.some(p => p.test(message))
}

// ============================================
// BÚSQUEDA EN HELP_ARTICLES (RAG)
// ============================================

export interface HelpArticle {
  id: string
  slug: string
  title: string
  category: string
  content: string
  keywords: string[]
  relatedUrls: string[]
  similarity: number
}

/**
 * Busca artículos de ayuda por similitud semántica (RAG).
 * Usa la tabla help_articles con pgvector.
 */
export async function searchHelpArticles(
  embedding: number[],
  options: { threshold?: number; limit?: number } = {}
): Promise<HelpArticle[]> {
  const { threshold = 0.30, limit = 3 } = options

  try {
    const db = getReadDb()
    const data = (await db.execute(sql`
      SELECT * FROM match_help_articles(
        ${toVector(embedding)}::vector,
        ${threshold},
        ${limit}
      )
    `)) as any[]

    return (data || []).map((d: Record<string, unknown>) => ({
      id: d.id as string,
      slug: d.slug as string,
      title: d.title as string,
      category: d.category as string,
      content: d.content as string,
      keywords: (d.keywords || []) as string[],
      relatedUrls: (d.related_urls || []) as string[],
      similarity: d.similarity as number,
    }))
  } catch (err) {
    logger.error('Error in searchHelpArticles', err, { domain: 'knowledge-base' })
    return []
  }
}

// ============================================
// HELPERS
// ============================================

function mapKBEntry(data: any): KnowledgeBaseEntry {
  return {
    id: data.id,
    category: data.category,
    subcategory: data.subcategory,
    title: data.title,
    content: data.content,
    shortAnswer: data.short_answer,
    keywords: data.keywords || [],
    priority: data.priority || 0,
    similarity: data.similarity,
    metadata: data.metadata || {},
  }
}

/**
 * Extrae keywords relevantes de un mensaje para búsqueda
 */
export function extractPlatformKeywords(message: string): string[] {
  const platformKeywords = [
    'plan', 'planes', 'precio', 'gratis', 'free', 'premium', 'pro',
    'suscripción', 'pagar', 'pago', 'coste',
    'test', 'tests', 'preguntas', 'examen', 'exámenes',
    'temario', 'temas', 'leyes',
    'estadísticas', 'progreso', 'racha',
    'funciona', 'usar', 'uso',
    'app', 'aplicación', 'plataforma', 'vence',
    'ayuda', 'soporte', 'contacto',
    'psicotécnicos', 'psicotécnico',
    // Cancelación y devoluciones
    'cancelar', 'cancelación', 'cancelo',
    'devolver', 'devolución', 'reembolso',
    'garantía', 'baja',
    // Temarios y contenido
    'temarios', 'contenido', 'estudiar', 'legislación',
    'ofrece', 'incluye',
    // Multi-Ley
    'multi-ley', 'multiley', 'varias', 'diferentes', 'múltiples',
    'combinar', 'mezclar', 'configurador',
  ]

  const msgLower = message.toLowerCase()
  return platformKeywords.filter(kw => msgLower.includes(kw))
}
