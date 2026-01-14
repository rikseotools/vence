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
 */
export async function getUserStats(
  userId: string,
  lawShortName: string | null = null,
  limit: number = 10,
  fromDate: Date | null = null
): Promise<UserStatsResult | null> {
  if (!userId) return null

  const supabase = getSupabase()
  const PAGE_SIZE = 1000

  try {
    // Paso 1: Obtener TODOS los IDs de tests del usuario (con paginación)
    let allTests: { id: string }[] = []
    let testOffset = 0
    let hasMoreTests = true

    while (hasMoreTests) {
      const { data: pageTests, error: testsError } = await supabase
        .from('tests')
        .select('id')
        .eq('user_id', userId)
        .range(testOffset, testOffset + PAGE_SIZE - 1)

      if (testsError) {
        logger.error('Error obteniendo tests', testsError, { domain: 'stats' })
        return null
      }

      if (!pageTests || pageTests.length === 0) {
        hasMoreTests = false
      } else {
        allTests = allTests.concat(pageTests)
        testOffset += PAGE_SIZE
        hasMoreTests = pageTests.length === PAGE_SIZE
      }
    }

    if (allTests.length === 0) {
      logger.debug('No se encontraron tests para el usuario', { domain: 'stats' })
      return null
    }

    const testIds = allTests.map(t => t.id)
    logger.debug(`Found ${testIds.length} total tests for user`, { domain: 'stats' })

    // Paso 2: Obtener respuestas con paginación
    let allAnswers: any[] = []
    let offset = 0
    let hasMore = true

    while (hasMore) {
      let answersQuery = supabase
        .from('test_questions')
        .select('question_id, is_correct, article_number, law_name, created_at')
        .in('test_id', testIds)
        .range(offset, offset + PAGE_SIZE - 1)
        .order('created_at', { ascending: false })

      if (fromDate) {
        answersQuery = answersQuery.gte('created_at', fromDate.toISOString())
      }

      const { data: pageAnswers, error: answersError } = await answersQuery

      if (answersError) {
        logger.error('Error obteniendo respuestas', answersError, { domain: 'stats' })
        return null
      }

      if (!pageAnswers || pageAnswers.length === 0) {
        hasMore = false
      } else {
        allAnswers = allAnswers.concat(pageAnswers)
        offset += PAGE_SIZE
        hasMore = pageAnswers.length === PAGE_SIZE
      }
    }

    if (allAnswers.length === 0) {
      logger.debug('No se encontraron respuestas en el período', { domain: 'stats' })
      return null
    }

    logger.debug(`Found ${allAnswers.length} answers in period`, { domain: 'stats' })

    // Filtrar por ley si se especifica
    let filteredAnswers = allAnswers
    if (lawShortName) {
      filteredAnswers = allAnswers.filter(a =>
        a.law_name?.includes(lawShortName) ||
        a.law_name?.toLowerCase().includes(lawShortName.toLowerCase())
      )
    }

    // Filtrar solo respuestas con artículo asociado
    filteredAnswers = filteredAnswers.filter(a => a.article_number != null)

    if (filteredAnswers.length === 0) {
      logger.debug('No hay respuestas con artículos para este filtro', { domain: 'stats' })
      return null
    }

    // Agrupar por artículo + ley
    const articleStats: Record<string, ArticleStats> = {}
    filteredAnswers.forEach(a => {
      const law = a.law_name || 'Ley'
      const article = a.article_number
      if (article === undefined || article === null) return

      // Artículo 0 = preguntas de estructura (no de un artículo específico)
      const articleLabel = article === 0 || article === '0' ? 'Estructura' : `Art. ${article}`
      // Extraer nombre corto de la ley
      const lawShort = law.split(' de ')[0] || law.substring(0, 20)
      const key = `${lawShort} ${articleLabel}`

      if (!articleStats[key]) {
        articleStats[key] = {
          law: lawShort,
          article: articleLabel,
          total: 0,
          correct: 0,
          failed: 0,
          accuracy: 0,
        }
      }
      articleStats[key].total += 1
      if (a.is_correct) {
        articleStats[key].correct += 1
      } else {
        articleStats[key].failed += 1
      }
    })

    // Calcular porcentaje de acierto
    const withPercentage = Object.values(articleStats).map(s => ({
      ...s,
      accuracy: s.total > 0 ? Math.round((s.correct / s.total) * 100) : 0,
    }))

    // Artículos más fallados (ordenados por número de fallos)
    const mostFailed = [...withPercentage]
      .filter(s => s.failed > 0)
      .sort((a, b) => b.failed - a.failed)
      .slice(0, limit)

    // Artículos con peor porcentaje (mínimo 2 intentos)
    const worstAccuracy = [...withPercentage]
      .filter(s => s.total >= 2)
      .sort((a, b) => a.accuracy - b.accuracy)
      .slice(0, limit)

    // Estadísticas generales
    const totalAnswers = filteredAnswers.length
    const totalCorrect = filteredAnswers.filter(a => a.is_correct).length
    const overallAccuracy = totalAnswers > 0 ? Math.round((totalCorrect / totalAnswers) * 100) : 0

    logger.info('User stats calculated', {
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
