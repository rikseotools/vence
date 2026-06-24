// lib/lawFetchers.ts - FETCHERS ESPECÍFICOS PARA TESTS POR LEY
import { mapSlugToShortName as mapLawSlugToShortName } from './lawSlugSync'

interface SupabaseQuestion {
  id: string
  question_text: string
  option_a: string
  option_b: string
  option_c: string
  option_d: string | null
  option_e?: string | null
  correct_option: number
  explanation: string | null
  difficulty: string | null
  question_type: string | null
  tags: string[] | null
  primary_article_id: string | null
  is_official_exam: boolean | null
  exam_source: string | null
  exam_date: string | null
  exam_entity: string | null
  official_difficulty_level: string | null
  is_active: boolean
  created_at: string
  updated_at: string | null
  articles?: {
    id: string
    article_number: string
    title: string | null
    content: string | null
    section: string | null
    laws?: {
      id: string
      name: string
      short_name: string
      slug: string | null
      year: number | null
      type: string | null
      scope: string | null
    }
  }
}

interface TransformedQuestion {
  id: string
  question: string
  options: string[]
  explanation: string | null
  primary_article_id: string | null
  article: {
    id: string | undefined
    number: string
    title: string
    full_text: string
    law_name: string
    law_short_name: string
    display_number: string
  }
  metadata: {
    id: string
    difficulty: string
    question_type: string
    tags: string[]
    is_active: boolean
    created_at: string
    updated_at: string | null
    is_official_exam: boolean | null
    exam_source: string | null
    exam_date: string | null
    exam_entity: string | null
    official_difficulty_level: string | null
  }
}

export interface LawStats {
  lawShortName: string
  totalQuestions: number
  officialQuestions: number
  regularQuestions: number
  hasQuestions: boolean
  hasOfficialQuestions: boolean
  error?: string
}

// =================================================================
// FUNCIÓN DE TRANSFORMACIÓN (misma que testFetchers.js)
// =================================================================
export function transformQuestions(supabaseQuestions: SupabaseQuestion[] | null | undefined): TransformedQuestion[] {
  if (!supabaseQuestions || !Array.isArray(supabaseQuestions)) {
    console.error('❌ transformQuestions: Datos inválidos recibidos')
    return []
  }

  return supabaseQuestions.map((q, index) => {
    return {
      // PRESERVAR ID ORIGINAL DE LA BASE DE DATOS
      id: q.id,
      question: q.question_text,
      options: [q.option_a, q.option_b, q.option_c, q.option_d, q.option_e].filter((v): v is string => v != null && v !== ''),
      // Respuesta correcta incluida para validación client-side instantánea
      correct_option: q.correct_option,
      explanation: q.explanation,

      // INCLUIR primary_article_id PARA HOT ARTICLES
      primary_article_id: q.primary_article_id,

      article: {
        id: q.articles?.id,
        number: q.articles?.article_number || (index + 1).toString(),
        title: q.articles?.title || `Artículo ${index + 1}`,
        full_text: q.articles?.content || `Contenido del artículo ${q.articles?.article_number || index + 1}`,
        law_name: q.articles?.laws?.name || q.articles?.laws?.short_name || 'Ley',
        law_short_name: q.articles?.laws?.short_name || 'Ley',
        display_number: `Art. ${q.articles?.article_number || index + 1} ${q.articles?.laws?.short_name || 'Ley'}`,
      },

      // METADATOS
      metadata: {
        id: q.id,
        difficulty: q.difficulty || 'auto',
        question_type: q.question_type || 'single',
        tags: q.tags || [],
        is_active: q.is_active,
        created_at: q.created_at,
        updated_at: q.updated_at,
        // Información de exámenes oficiales si aplica
        is_official_exam: q.is_official_exam,
        exam_source: q.exam_source,
        exam_date: q.exam_date,
        exam_entity: q.exam_entity,
        official_difficulty_level: q.official_difficulty_level,
      }
    }
  })
}

// =================================================================
// FUNCIÓN AUXILIAR: Validar que una ley existe
// =================================================================
export async function validateLawExists(lawShortName: string): Promise<boolean> {
  try {
    const stats = await getLawStats(lawShortName)
    return stats.hasQuestions
  } catch (error) {
    console.error('❌ [LAW FETCHER] Error en validateLawExists:', error)
    return false
  }
}

// =================================================================
// FUNCIÓN AUXILIAR: Obtener estadísticas de una ley
// =================================================================
export async function getLawStats(lawShortName: string): Promise<LawStats> {
  const resolvedShortName = mapLawSlugToShortName(lawShortName) || lawShortName

  try {
    console.log(`📊 [LAW FETCHER] Obteniendo estadísticas de ${resolvedShortName} via API`)

    const response = await fetch(`/api/questions/law-stats?lawShortName=${encodeURIComponent(resolvedShortName)}`)
    const data = await response.json()

    if (!response.ok || !data.success) {
      console.error(`❌ [LAW FETCHER] Error API law-stats: ${data.error}`)
      return {
        lawShortName: resolvedShortName,
        totalQuestions: 0, officialQuestions: 0, regularQuestions: 0,
        hasQuestions: false, hasOfficialQuestions: false,
        error: data.error || 'Error obteniendo estadísticas'
      }
    }

    const stats: LawStats = {
      lawShortName: data.lawShortName,
      totalQuestions: data.totalQuestions,
      officialQuestions: data.officialQuestions,
      regularQuestions: data.regularQuestions,
      hasQuestions: data.hasQuestions,
      hasOfficialQuestions: data.hasOfficialQuestions,
    }

    console.log(`📊 [LAW FETCHER] Estadísticas de ${resolvedShortName}:`, stats)
    return stats

  } catch (error) {
    console.error(`❌ [LAW FETCHER] Error obteniendo estadísticas de ${resolvedShortName}:`, error)
    return {
      lawShortName: resolvedShortName,
      totalQuestions: 0, officialQuestions: 0, regularQuestions: 0,
      hasQuestions: false, hasOfficialQuestions: false,
      error: (error as Error).message
    }
  }
}

