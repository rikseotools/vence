// lib/chat/domains/stats/queries.ts
// Queries para estadísticas de exámenes y usuarios

import { createClient } from '@supabase/supabase-js'
import { logger } from '../../shared/logger'
import type { ExamStatsResult, UserStatsResult, ArticleCount, ArticleStats } from './schemas'

// ============================================
// CLIENTE SUPABASE
// ============================================

// Usamos Supabase directamente porque test_questions no está en Drizzle schema
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

function getSupabase() {
  return createClient(supabaseUrl, supabaseServiceKey)
}

// ============================================
// ESTADÍSTICAS DE EXÁMENES OFICIALES
// ============================================

/**
 * Obtiene estadísticas de artículos más preguntados en exámenes oficiales
 */
export async function getExamStats(
  lawShortName: string | null = null,
  limit: number = 15,
  examPosition: string | null = null
): Promise<ExamStatsResult | null> {
  const supabase = getSupabase()

  try {
    // Buscar preguntas de exámenes oficiales con join a través de articles
    let query = supabase
      .from('questions')
      .select(`
        id,
        exam_position,
        article:articles!primary_article_id(
          id,
          article_number,
          law:laws!inner(id, short_name, name)
        )
      `)
      .eq('is_active', true)
      .eq('is_official_exam', true)
      .not('primary_article_id', 'is', null)

    // Filtrar por oposición si se especifica
    if (examPosition) {
      query = query.eq('exam_position', examPosition)
    }

    const { data: questions, error } = await query

    if (error || !questions?.length) {
      logger.debug('No se encontraron preguntas de exámenes oficiales', {
        domain: 'stats',
        error: error?.message,
      })
      return null
    }

    // Filtrar por ley si se especifica (después del query porque el filtro nested es complejo)
    let filteredQuestions = questions
    if (lawShortName) {
      filteredQuestions = questions.filter((q: any) =>
        q.article?.law?.short_name === lawShortName
      )
    }

    if (filteredQuestions.length === 0) {
      logger.debug('No hay preguntas para el filtro especificado', { domain: 'stats' })
      return null
    }

    // Contar apariciones por artículo, incluyendo desglose por oposición
    const articleCounts: Record<string, ArticleCount> = {}
    filteredQuestions.forEach((q: any) => {
      const law = q.article?.law?.short_name || q.article?.law?.name || 'Ley'
      const artNum = q.article?.article_number
      if (!artNum) return

      const key = `${law} Art. ${artNum}`
      if (!articleCounts[key]) {
        articleCounts[key] = {
          law,
          article: String(artNum),
          count: 0,
          byPosition: {},
        }
      }
      articleCounts[key].count++

      // Registrar por oposición
      const pos = q.exam_position || 'sin_especificar'
      if (!articleCounts[key].byPosition[pos]) {
        articleCounts[key].byPosition[pos] = 0
      }
      articleCounts[key].byPosition[pos]++
    })

    // Ordenar por frecuencia y devolver top
    const sorted = Object.values(articleCounts)
      .sort((a, b) => b.count - a.count)
      .slice(0, limit)

    logger.info('Exam stats calculated', {
      domain: 'stats',
      totalQuestions: filteredQuestions.length,
      topArticlesCount: sorted.length,
    })

    return {
      totalOfficialQuestions: filteredQuestions.length,
      topArticles: sorted,
      lawFilter: lawShortName,
      positionFilter: examPosition,
    }
  } catch (err) {
    logger.error('Error obteniendo estadísticas de exámenes', err, { domain: 'stats' })
    return null
  }
}

// ============================================
// ESTADÍSTICAS DE USUARIO
// ============================================

/**
 * Obtiene estadísticas de fallos y áreas débiles del usuario
 * Usa la RPC get_user_statistics_complete para evitar queries lentas
 */
export async function getUserStats(
  userId: string,
  lawShortName: string | null = null,
  limit: number = 10,
  _fromDate: Date | null = null // No usado por la RPC actual, pero mantenemos la firma
): Promise<UserStatsResult | null> {
  if (!userId) return null

  const supabase = getSupabase()

  try {
    // Usar la RPC optimizada que hace JOINs server-side
    const { data: rpcResult, error: rpcError } = await supabase
      .rpc('get_user_statistics_complete', { p_user_id: userId })

    if (rpcError) {
      logger.error('Error llamando RPC get_user_statistics_complete', rpcError, { domain: 'stats' })
      return null
    }

    if (!rpcResult) {
      logger.debug('No se encontraron estadísticas para el usuario', { domain: 'stats' })
      return null
    }

    // La RPC devuelve JSON con article_performance
    const stats = rpcResult as {
      total_questions: number
      correct_answers: number
      accuracy: number
      article_performance?: Array<{
        law_name: string
        article_number: string | number
        tema_number: number
        total: number
        correct: number
        accuracy: number
      }>
    }

    // Procesar article_performance para obtener mostFailed y worstAccuracy
    let articlePerf = stats.article_performance || []

    // Filtrar por ley si se especifica
    if (lawShortName) {
      articlePerf = articlePerf.filter(a =>
        a.law_name?.includes(lawShortName) ||
        a.law_name?.toLowerCase().includes(lawShortName.toLowerCase())
      )
    }

    // Filtrar solo artículos con datos
    articlePerf = articlePerf.filter(a => a.article_number != null)

    if (articlePerf.length === 0 && stats.total_questions === 0) {
      logger.debug('No hay estadísticas para este usuario', { domain: 'stats' })
      return null
    }

    // Transformar al formato esperado
    const articleStats: ArticleStats[] = articlePerf.map(a => {
      const article = a.article_number
      const articleLabel = article === 0 || article === '0' ? 'Estructura' : `Art. ${article}`
      const lawShort = a.law_name?.split(' de ')[0] || a.law_name?.substring(0, 20) || 'Ley'
      const failed = a.total - a.correct

      return {
        law: lawShort,
        article: articleLabel,
        total: a.total,
        correct: a.correct,
        failed,
        accuracy: a.accuracy,
      }
    })

    // Artículos más fallados (ordenados por número de fallos)
    const mostFailed = [...articleStats]
      .filter(s => s.failed > 0)
      .sort((a, b) => b.failed - a.failed)
      .slice(0, limit)

    // Artículos con peor porcentaje (mínimo 2 intentos)
    const worstAccuracy = [...articleStats]
      .filter(s => s.total >= 2)
      .sort((a, b) => a.accuracy - b.accuracy)
      .slice(0, limit)

    // Estadísticas generales
    const totalAnswers = stats.total_questions || 0
    const totalCorrect = stats.correct_answers || 0
    const overallAccuracy = stats.accuracy || 0

    logger.info('User stats calculated via RPC', {
      domain: 'stats',
      totalAnswers,
      overallAccuracy,
      mostFailedCount: mostFailed.length,
    })

    return {
      totalAnswers,
      totalCorrect,
      totalFailed: totalAnswers - totalCorrect,
      overallAccuracy,
      mostFailed,
      worstAccuracy,
      lawFilter: lawShortName,
    }
  } catch (err) {
    logger.error('Error obteniendo estadísticas del usuario', err, { domain: 'stats' })
    return null
  }
}
