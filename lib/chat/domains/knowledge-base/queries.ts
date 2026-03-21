// lib/chat/domains/knowledge-base/queries.ts
// Queries para la base de conocimiento

import { createClient } from '@supabase/supabase-js'
import { getDb } from '@/db/client'
import { aiKnowledgeBase } from '@/db/schema'
import { eq, and, or, ilike, inArray } from 'drizzle-orm'
import { logger } from '../../shared/logger'

// Cliente Supabase para RPC functions (match_knowledge_base usa pgvector)
const getSupabase = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

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
    const { data, error } = await getSupabase().rpc('match_knowledge_base', {
      query_embedding: embedding,
      match_threshold: threshold,
      match_count: limit,
      filter_category: category,
    })

    if (error) {
      logger.error('Error in match_knowledge_base RPC', error, { domain: 'knowledge-base' })
      return []
    }

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
    // Construir condiciones OR para los keywords
    const keywordConditions = keywords.map(kw =>
      `title.ilike.%${kw}%,content.ilike.%${kw}%,short_answer.ilike.%${kw}%`
    ).join(',')

    let query = getSupabase()
      .from('ai_knowledge_base')
      .select('*')
      .eq('is_active', true)
      .or(keywordConditions)
      .order('priority', { ascending: false })
      .limit(limit)

    if (category) {
      query = query.eq('category', category)
    }

    const { data, error } = await query

    if (error) {
      logger.error('Error in keyword search', error, { domain: 'knowledge-base' })
      return []
    }

    return (data || []).map(mapKBEntry)
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
    const { data, error } = await getSupabase()
      .from('ai_knowledge_base')
      .select('*')
      .eq('id', id)
      .single()

    if (error || !data) {
      return null
    }

    return mapKBEntry(data)
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
    /plan(es)?|precio|suscripci[oó]n|premium|free/i,
    /c[oó]mo\s+(funciona|uso|hago)/i,
    /la\s+(app|aplicaci[oó]n|plataforma|p[aá]gina)/i,
    /vence/i,
    /soporte|ayuda|contacto/i,
    /funcionalidad|caracter[ií]stica/i,
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
    /simulacro/i,
    /modo\s+examen/i,
    /examen\s+(completo|simulado|de\s+prueba|real)/i,
    /practicar\s+(un\s+)?examen/i,
    // Funcionalidades de test
    /repas(o|ar)\s+(de\s+)?fallo/i,
    /test\s+(de\s+)?art[ií]culo/i,
    /test\s+(de\s+)?ley/i,
    /test\s+(de\s+)?examen/i,
    /modo\s+adaptativo/i,
    // Preguntas sobre la plataforma
    /\b(hay|ten[eé]is|existe|se\s+puede)\b.*(test|examen|simulacro|practicar|repas|psicot[eé]c)/i,
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
    /d[oó]nde\s+(veo|est[aá]n?|encuentro)\s+(mis\s+)?(estad[ií]stica|impugnaci|notificaci|perfil|suscripci)/i,
    // Impugnaciones y disputas
    /impugn/i,
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
    // Imprimir, guardar, descargar tests/temario
    /imprim(ir|o|e|imos)/i,
    /guardar\s+(el\s+)?(test|resultado|examen)/i,
    /descargar/i,
    /\bpdf\b/i,
    /exportar/i,
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
    const { data, error } = await getSupabase().rpc('match_help_articles', {
      query_embedding: embedding,
      match_threshold: threshold,
      match_count: limit,
    })

    if (error) {
      logger.error('Error in match_help_articles RPC', error, { domain: 'knowledge-base' })
      return []
    }

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
