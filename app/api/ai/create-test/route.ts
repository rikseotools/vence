// app/api/ai/create-test/route.ts
// API genérica para crear tests desde el chat de IA
// Soporta múltiples tipos: preguntas falladas, por ley, por tema, etc.
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

import { withErrorLogging } from '@/lib/api/withErrorLogging'
const getSupabase = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

type TestType = 'failed_questions' | 'law' | 'topic' | 'essential_articles' | 'custom' | 'article'

interface CreateTestRequest {
  type: TestType
  // Común
  numQuestions?: number
  // Para failed_questions
  orderBy?: 'recent' | 'most_failed' | 'worst_accuracy'
  days?: number // Días hacia atrás (ej: 30 = últimos 30 días)
  fromDate?: string // ISO date string (alternativa a days, más preciso)
  // Para law
  lawSlug?: string
  lawId?: string
  // Para topic
  topicId?: string
  // Para custom
  questionIds?: string[]
  // Para article
  articleNumber?: string
  lawShortName?: string
}

async function _POST(request: NextRequest) {
  console.log('🎯 [API/create-test] Request received')

  try {
    // Verificar autenticación
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      console.log('🎯 [API/create-test] No auth header')
      return NextResponse.json(
        { success: false, error: 'No autorizado' },
        { status: 401 }
      )
    }

    const token = authHeader.split(' ')[1]
    const { data: { user }, error: authError } = await getSupabase().auth.getUser(token)

    if (authError || !user) {
      console.log('🎯 [API/create-test] Auth error:', authError?.message)
      return NextResponse.json(
        { success: false, error: 'Token inválido' },
        { status: 401 }
      )
    }

    console.log('🎯 [API/create-test] User authenticated:', user.id)
    const body: CreateTestRequest = await request.json()
    console.log('🎯 [API/create-test] Body:', body)
    const { type, numQuestions = 10 } = body

    let questionIds: string[] = []
    let testParams: Record<string, string> = {}
    let message = ''

    switch (type) {
      case 'failed_questions':
        const failedResult = await getFailedQuestions(user.id, body)
        if (!failedResult.success) {
          return NextResponse.json(failedResult)
        }
        questionIds = failedResult.questionIds!
        message = failedResult.message!
        testParams = {
          n: questionIds.length.toString(),
          only_failed: 'true',
          failed_question_ids: JSON.stringify(questionIds),
          failed_questions_order: body.orderBy || 'recent',
          from_repaso: 'true'
        }
        break

      case 'law':
        const lawResult = await getLawQuestions(body)
        if (!lawResult.success) {
          return NextResponse.json(lawResult)
        }
        questionIds = lawResult.questionIds!
        message = lawResult.message!
        testParams = {
          n: questionIds.length.toString(),
          law_question_ids: JSON.stringify(questionIds),
          from_chat: 'true'
        }
        break

      case 'essential_articles':
        const essentialResult = await getEssentialArticlesQuestions(body)
        if (!essentialResult.success) {
          return NextResponse.json(essentialResult)
        }
        questionIds = essentialResult.questionIds!
        message = essentialResult.message!
        testParams = {
          n: questionIds.length.toString(),
          essential_only: 'true',
          from_chat: 'true'
        }
        break

      case 'custom':
        if (!body.questionIds || body.questionIds.length === 0) {
          return NextResponse.json({
            success: false,
            error: 'No se proporcionaron IDs de preguntas'
          })
        }
        questionIds = body.questionIds.slice(0, numQuestions)
        message = `Test personalizado con ${questionIds.length} preguntas`
        testParams = {
          n: questionIds.length.toString(),
          custom_question_ids: JSON.stringify(questionIds),
          from_chat: 'true'
        }
        break

      case 'article':
        const articleResult = await getArticleQuestions(body)
        if (!articleResult.success) {
          return NextResponse.json(articleResult)
        }
        questionIds = articleResult.questionIds!
        message = articleResult.message!
        testParams = {
          n: questionIds.length.toString(),
          article_question_ids: JSON.stringify(questionIds),
          from_chat: 'true'
        }
        break

      default:
        return NextResponse.json({
          success: false,
          error: 'Tipo de test no soportado'
        })
    }

    if (questionIds.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No se encontraron preguntas para este test'
      })
    }

    // Cargar las preguntas completas desde el servidor (evita problemas de RLS en cliente)
    console.log('🎯 [API/create-test] Loading', questionIds.length, 'questions:', questionIds)

    // Primero, intentar con la relación completa
    let questionsData: any[] | null = null
    let questionsError: any = null

    try {
      // Query simplificada - la relación con articles es opcional (left join)
      const result = await getSupabase()
        .from('questions')
        .select(`
          id,
          question_text,
          option_a,
          option_b,
          option_c,
          option_d,
          correct_option,
          explanation,
          difficulty,
          primary_article_id,
          articles(
            article_number,
            title,
            content,
            law_id,
            laws(name, short_name)
          )
        `)
        .in('id', questionIds)
        .eq('is_active', true)

      questionsData = result.data
      questionsError = result.error
    } catch (e) {
      console.error('❌ [API/create-test] Exception loading questions:', e)
      questionsError = e
    }

    console.log('🎯 [API/create-test] Query result:', {
      hasData: !!questionsData,
      count: questionsData?.length || 0,
      error: questionsError?.message || null
    })

    if (questionsError) {
      console.error('❌ [API/create-test] Supabase error:', questionsError)
      return NextResponse.json({
        success: false,
        error: `Error de base de datos: ${questionsError.message}`
      })
    }

    if (!questionsData || questionsData.length === 0) {
      console.log('⚠️ [API/create-test] No active questions found for IDs:', questionIds)
      return NextResponse.json({
        success: false,
        error: 'Las preguntas falladas ya no están disponibles (pueden haber sido desactivadas)'
      })
    }

    // Transformar preguntas al formato esperado por TestLayout
    const questions = questionsData.map(q => {
      const articleData = q.articles as any
      const law = articleData?.laws as any
      return {
        id: q.id,
        question: q.question_text, // TestLayout usa 'question', no 'question_text'
        question_text: q.question_text, // Mantener para compatibilidad
        options: [q.option_a, q.option_b, q.option_c, q.option_d],
        explanation: q.explanation,
        correct_option: (q as any).correct_option ?? null,
        difficulty: q.difficulty,
        law_name: law?.name || 'Desconocida',
        law_slug: law?.short_name,
        article_number: articleData?.article_number,
        article_title: articleData?.title,
        primary_article_id: q.primary_article_id,
        // Incluir artículo completo para ArticleDropdown
        article: articleData ? {
          article_number: articleData.article_number,
          number: articleData.article_number,
          title: articleData.title,
          full_text: articleData.content,
          content: articleData.content,
          law_short_name: law?.short_name,
        } : null
      }
    })

    console.log('🎯 [API/create-test] Returning', questions.length, 'questions')

    return NextResponse.json({
      success: true,
      questions,
      questionCount: questions.length,
      message,
      testType: type
    })

  } catch (error) {
    console.error('❌ [API/create-test] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

// Obtener preguntas falladas del usuario
// NOTA: Filtra por test_questions.created_at (igual que el RPC get_user_statistics_complete)
async function getFailedQuestions(userId: string, options: CreateTestRequest) {
  console.log('🎯 [getFailedQuestions] Starting for user:', userId, 'options:', options)
  const { numQuestions = 10, orderBy = 'recent', days = 30, fromDate } = options

  try {
    // Usar fromDate si está disponible, si no calcular desde days
    let cutoffDate: string
    let periodLabel: string

    if (fromDate) {
      cutoffDate = fromDate
      periodLabel = 'período especificado'
    } else {
      cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
      periodLabel = `últimos ${days} días`
    }

    console.log('🎯 [getFailedQuestions] Cutoff date:', cutoffDate, '| Period:', periodLabel)

    // Paso 1: Obtener TODOS los IDs de tests del usuario
    const { data: tests, error: testsError } = await getSupabase()
      .from('tests')
      .select('id')
      .eq('user_id', userId)

    if (testsError) {
      console.error('🎯 [getFailedQuestions] Error getting tests:', testsError)
      return { success: false, error: 'Error al obtener tests' }
    }

    if (!tests || tests.length === 0) {
      console.log('🎯 [getFailedQuestions] No tests found for user')
      return {
        success: true,
        questionIds: [],
        message: `No tienes tests realizados`
      }
    }

    const testIds = tests.map(t => t.id)
    console.log('🎯 [getFailedQuestions] Found', testIds.length, 'total tests for user')

    // Paso 2: Obtener respuestas falladas filtrando por created_at de test_questions
    const { data: answers, error: answersError } = await getSupabase()
      .from('test_questions')
      .select('question_id, is_correct, created_at')
      .in('test_id', testIds)
      .eq('is_correct', false)
      .gte('created_at', cutoffDate)

    if (answersError) {
      console.error('🎯 [getFailedQuestions] Error getting answers:', answersError)
      return { success: false, error: 'Error al obtener respuestas' }
    }

    if (!answers || answers.length === 0) {
      console.log('🎯 [getFailedQuestions] No failed answers in period')
      return {
        success: true,
        questionIds: [],
        message: `¡Enhorabuena! No tienes preguntas falladas en ${periodLabel}`
      }
    }

    console.log('🎯 [getFailedQuestions] Found', answers.length, 'failed answers')

    // Agrupar por question_id y contar fallos
    const questionFailCounts: Record<string, { questionId: string, failCount: number, lastFail: string }> = {}
    answers.forEach(a => {
      if (!questionFailCounts[a.question_id]) {
        questionFailCounts[a.question_id] = {
          questionId: a.question_id,
          failCount: 0,
          lastFail: a.created_at || ''
        }
      }
      questionFailCounts[a.question_id].failCount++
      if (a.created_at && a.created_at > questionFailCounts[a.question_id].lastFail) {
        questionFailCounts[a.question_id].lastFail = a.created_at
      }
    })

    let sortedQuestions = Object.values(questionFailCounts)
    console.log('🎯 [getFailedQuestions] Unique failed questions:', sortedQuestions.length)

    // Ordenar según criterio
    switch (orderBy) {
      case 'most_failed':
        sortedQuestions.sort((a, b) => b.failCount - a.failCount)
        break
      case 'worst_accuracy':
        // Para worst_accuracy necesitaríamos también los aciertos, pero por simplicidad
        // usamos los más fallados
        sortedQuestions.sort((a, b) => b.failCount - a.failCount)
        break
      default: // 'recent'
        sortedQuestions.sort((a, b) =>
          new Date(b.lastFail).getTime() - new Date(a.lastFail).getTime()
        )
    }

    const questionIds = sortedQuestions.slice(0, numQuestions).map(q => q.questionId)
    console.log('🎯 [getFailedQuestions] Returning', questionIds.length, 'questions')

    return {
      success: true,
      questionIds,
      message: `Test de repaso con ${questionIds.length} preguntas falladas en ${periodLabel}`
    }
  } catch (dbError) {
    console.error('🎯 [getFailedQuestions] DB Error:', dbError)
    return {
      success: false,
      error: 'Error al consultar la base de datos'
    }
  }
}

// Obtener preguntas de una ley específica
async function getLawQuestions(options: CreateTestRequest) {
  const { numQuestions = 10, lawSlug, lawId } = options

  let lawIdToUse = lawId

  // Si tenemos slug, buscar el ID de la ley
  if (!lawIdToUse && lawSlug) {
    const { data: law } = await getSupabase()
      .from('laws')
      .select('id')
      .eq('slug', lawSlug)
      .single()

    if (law) {
      lawIdToUse = law.id
    }
  }

  if (!lawIdToUse) {
    return {
      success: false,
      error: 'Ley no encontrada'
    }
  }

  // Obtener preguntas de la ley
  const { data: lawQuestions, error } = await getSupabase()
    .from('questions')
    .select('id')
    .eq('law_id', lawIdToUse)
    .eq('is_active', true)
    .limit(numQuestions * 2) // Obtener más para randomizar

  if (error || !lawQuestions) {
    return {
      success: false,
      error: 'Error al obtener preguntas de la ley'
    }
  }

  if (lawQuestions.length === 0) {
    return {
      success: true,
      questionIds: [],
      message: 'No hay preguntas disponibles para esta ley'
    }
  }

  // Randomizar y limitar
  const shuffled = lawQuestions.sort(() => Math.random() - 0.5)
  const questionIds = shuffled.slice(0, numQuestions).map(q => q.id)

  return {
    success: true,
    questionIds,
    message: `Test con ${questionIds.length} preguntas de la ley`
  }
}

// Obtener preguntas de artículos imprescindibles
async function getEssentialArticlesQuestions(options: CreateTestRequest) {
  const { numQuestions = 10, lawSlug, lawId } = options

  let lawIdToUse = lawId

  if (!lawIdToUse && lawSlug) {
    const { data: law } = await getSupabase()
      .from('laws')
      .select('id')
      .eq('slug', lawSlug)
      .single()

    if (law) {
      lawIdToUse = law.id
    }
  }

  // Obtener artículos esenciales
  // NOTA: La columna is_essential no existe actualmente en articles
  // Esta función está preparada para cuando se añada esa característica
  let articlesQuery = getSupabase()
    .from('articles')
    .select('id')
    // .eq('is_essential', true) // Descomentar cuando exista la columna

  if (lawIdToUse) {
    articlesQuery = articlesQuery.eq('law_id', lawIdToUse)
  }

  const { data: articlesData } = await articlesQuery.limit(100)

  if (!articlesData || articlesData.length === 0) {
    return {
      success: true,
      questionIds: [],
      message: 'No hay artículos imprescindibles disponibles'
    }
  }

  const articleIds = articlesData.map(a => a.id)

  // Obtener preguntas de esos artículos
  const { data: essentialQuestions } = await getSupabase()
    .from('questions')
    .select('id')
    .in('primary_article_id', articleIds)
    .eq('is_active', true)
    .limit(numQuestions * 2)

  if (!essentialQuestions || essentialQuestions.length === 0) {
    return {
      success: true,
      questionIds: [],
      message: 'No hay preguntas de artículos imprescindibles'
    }
  }

  const shuffled = essentialQuestions.sort(() => Math.random() - 0.5)
  const questionIds = shuffled.slice(0, numQuestions).map(q => q.id)

  return {
    success: true,
    questionIds,
    message: `Test con ${questionIds.length} preguntas de artículos imprescindibles`
  }
}

// Obtener preguntas de un artículo específico
async function getArticleQuestions(options: CreateTestRequest) {
  const { numQuestions = 10, articleNumber, lawShortName, lawSlug } = options

  console.log('🎯 [getArticleQuestions] Options:', { articleNumber, lawShortName, lawSlug })

  if (!articleNumber) {
    return {
      success: false,
      error: 'No se especificó el número de artículo'
    }
  }

  // Buscar la ley por short_name o slug
  let lawId: string | null = null

  if (lawShortName) {
    const { data: law } = await getSupabase()
      .from('laws')
      .select('id, short_name')
      .eq('short_name', lawShortName)
      .single()

    if (law) {
      lawId = law.id
    }
  }

  if (!lawId && lawSlug) {
    const { data: law } = await getSupabase()
      .from('laws')
      .select('id, short_name')
      .eq('slug', lawSlug)
      .single()

    if (law) {
      lawId = law.id
    }
  }

  if (!lawId) {
    return {
      success: false,
      error: 'Ley no encontrada'
    }
  }

  // Buscar el artículo
  const { data: article } = await getSupabase()
    .from('articles')
    .select('id, article_number, title')
    .eq('law_id', lawId)
    .eq('article_number', articleNumber)
    .single()

  if (!article) {
    return {
      success: false,
      error: `Artículo ${articleNumber} no encontrado en esta ley`
    }
  }

  console.log('🎯 [getArticleQuestions] Found article:', article.id, article.article_number)

  // Obtener preguntas de este artículo
  const { data: articleQuestions, error } = await getSupabase()
    .from('questions')
    .select('id')
    .eq('primary_article_id', article.id)
    .eq('is_active', true)
    .limit(numQuestions * 2)

  if (error) {
    console.error('🎯 [getArticleQuestions] Error:', error)
    return {
      success: false,
      error: 'Error al obtener preguntas del artículo'
    }
  }

  if (!articleQuestions || articleQuestions.length === 0) {
    return {
      success: true,
      questionIds: [],
      message: `No hay preguntas disponibles para el artículo ${articleNumber}`
    }
  }

  // Randomizar y limitar
  const shuffled = articleQuestions.sort(() => Math.random() - 0.5)
  const questionIds = shuffled.slice(0, numQuestions).map(q => q.id)

  console.log('🎯 [getArticleQuestions] Returning', questionIds.length, 'questions')

  return {
    success: true,
    questionIds,
    message: `Test con ${questionIds.length} preguntas del Art. ${articleNumber}`
  }
}

export const POST = withErrorLogging('/api/ai/create-test', _POST)
