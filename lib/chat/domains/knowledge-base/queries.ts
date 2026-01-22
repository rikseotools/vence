// lib/chat/domains/knowledge-base/queries.ts
// Queries para la base de conocimiento

import { createClient } from '@supabase/supabase-js'
import { getDb } from '@/db/client'
import { aiKnowledgeBase } from '@/db/schema'
import { eq, and, or, ilike, inArray } from 'drizzle-orm'
import { logger } from '../../shared/logger'

// Cliente Supabase para RPC functions (match_knowledge_base usa pgvector)
const supabase = createClient(
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
    const { data, error } = await supabase.rpc('match_knowledge_base', {
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

    let query = supabase
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
    const { data, error } = await supabase
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
    // Cancelación y devoluciones
    /cancel(ar|aci[oó]n|o)/i,
    /devol(ver|uci[oó]n)/i,
    /reembolso/i,
    /garant[ií]a.*devoluci[oó]n/i,
    /dar(me)?\s+de\s+baja/i,
    // Temarios
    /temario(s)?/i,
    /contenido\s+(gratis|gratuito)/i,
    /qu[eé]\s+ofrece/i,
  ]

  return platformIndicators.some(p => p.test(message))
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
  ]

  const msgLower = message.toLowerCase()
  return platformKeywords.filter(kw => msgLower.includes(kw))
}
