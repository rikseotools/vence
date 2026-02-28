// app/api/verify-articles/ai-verify-article/route.ts - Verificación IA de artículos (batch)
import { NextRequest, NextResponse } from 'next/server'
import { aiVerifyArticleParamsSchema } from '@/lib/api/verify-articles/schemas'
import {
  getLawById,
  getArticleByLawAndNumber,
  getActiveQuestionsByArticleId,
  getAiApiConfig,
  upsertVerificationResult,
  updateQuestion,
  logVerificationError,
  logApiUsage,
  getVerificationResultsByArticle,
} from '@/lib/api/verify-articles/queries'
import {
  getMaxOutputTokens,
  getSafeBatchSize,
  normalizeProvider,
  decryptApiKey,
  getAIConfigFromEnv,
  buildBatchVerificationPrompt,
  fetchArticleFromBOE,
  verifyWithOpenAI,
  verifyWithClaude,
  verifyWithGoogle,
} from '@/lib/api/verify-articles/ai-helpers'

// ============================================
// TYPES
// ============================================

interface BatchQuestion {
  id: string
  questionText: string
  optionA: string
  optionB: string
  optionC: string
  optionD: string
  correctOption: number
  explanation: string | null
}

interface Verification {
  questionId?: string
  isCorrect: boolean | null
  confidence?: string | null
  explanation?: string | null
  articleQuote?: string | null
  suggestedFix?: string | null
  correctOptionShouldBe?: string | null
  newExplanation?: string | null
}

interface BatchResult {
  success: boolean
  error?: string
  raw?: string
  tokenUsage: { input_tokens?: number; output_tokens?: number; total_tokens?: number }
  results: Record<string, unknown>[]
}

// ============================================
// BATCH PROCESSOR
// ============================================

async function processBatch(params: {
  questions: BatchQuestion[]
  lawName: string
  articleNumber: string
  articleContent: string
  provider: string
  apiKey: string
  model: string
  lawId: string
  articleId: string
  batchIndex: number
  totalBatches: number
}): Promise<BatchResult> {
  const { questions, lawName, articleNumber, articleContent, provider, apiKey, model, lawId, articleId, batchIndex, totalBatches } = params

  const prompt = buildBatchVerificationPrompt({
    lawName,
    articleNumber,
    articleContent,
    questions,
  })

  console.log(`[AI-Verify] Procesando lote ${batchIndex + 1}/${totalBatches} (${questions.length} preguntas)`)

  let aiResponse: Record<string, unknown>
  let tokenUsage: { input_tokens?: number; output_tokens?: number; total_tokens?: number } = {}

  if (provider === 'anthropic') {
    const result = await verifyWithClaude(prompt, apiKey, model)
    aiResponse = result.response
    tokenUsage = result.usage || {}
  } else if (provider === 'google') {
    const result = await verifyWithGoogle(prompt, apiKey, model)
    aiResponse = result.response
    tokenUsage = result.usage || {}
  } else {
    const result = await verifyWithOpenAI(prompt, apiKey, model)
    aiResponse = result.response
    tokenUsage = result.usage || {}
  }

  // Log token usage
  const endpoints: Record<string, string> = {
    openai: '/v1/chat/completions',
    anthropic: '/v1/messages',
    google: '/v1beta/models/generateContent',
  }

  try {
    await logApiUsage({
      provider,
      model,
      endpoint: endpoints[provider] || 'unknown',
      inputTokens: (tokenUsage.input_tokens as number) || (tokenUsage as Record<string, unknown>).prompt_tokens as number | undefined,
      outputTokens: (tokenUsage.output_tokens as number) || (tokenUsage as Record<string, unknown>).completion_tokens as number | undefined,
      totalTokens: tokenUsage.total_tokens as number | undefined,
      feature: 'article_verification',
      lawId,
      articleNumber,
      questionsCount: questions.length,
    })
  } catch (e) {
    console.error('Error guardando uso de tokens:', e)
  }

  // Check for errors
  if (aiResponse.error) {
    try {
      await logVerificationError({
        lawId,
        articleNumber,
        provider,
        model,
        prompt,
        rawResponse: aiResponse.raw as string | undefined,
        errorMessage: aiResponse.error as string,
        errorType: (aiResponse.error as string).includes('JSON') ? 'json_parse' : 'api_error',
        questionsCount: questions.length,
        tokensUsed: tokenUsage as Record<string, unknown>,
      })
    } catch (e) {
      console.error('Error guardando log de error:', e)
    }

    return {
      success: false,
      error: aiResponse.error as string,
      raw: aiResponse.raw as string | undefined,
      tokenUsage,
      results: [],
    }
  }

  // Process and save results
  const verifications = (aiResponse.verifications as Verification[]) || []
  const results: Record<string, unknown>[] = []

  for (const question of questions) {
    const verification: Verification = verifications.find(v => v.questionId === question.id) ||
      verifications[questions.indexOf(question)] ||
      { isCorrect: null, explanation: 'No se pudo verificar esta pregunta' }

    try {
      await upsertVerificationResult({
        questionId: question.id,
        articleId,
        lawId,
        isCorrect: verification.isCorrect ?? null,
        confidence: verification.confidence ?? null,
        explanation: verification.explanation ?? null,
        articleQuote: verification.articleQuote ?? null,
        suggestedFix: verification.suggestedFix ?? null,
        correctOptionShouldBe: verification.correctOptionShouldBe ?? null,
        newExplanation: verification.newExplanation ?? null,
        aiProvider: provider,
        aiModel: model,
        verifiedAt: new Date().toISOString(),
      })
    } catch (e) {
      console.error('Error guardando verificación:', e)
    }

    // Update question verification status
    const verificationStatus = verification.isCorrect === true
      ? 'ok'
      : verification.isCorrect === false
        ? 'problem'
        : null

    try {
      await updateQuestion(question.id, {
        verifiedAt: new Date().toISOString(),
        verificationStatus,
      })
    } catch (e) {
      console.error('Error actualizando verificación en pregunta:', e)
    }

    results.push({
      questionId: question.id,
      questionText: question.questionText.substring(0, 100) + '...',
      ...verification,
    })
  }

  return { success: true, tokenUsage, results }
}

// ============================================
// POST: Run AI verification
// ============================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validation = aiVerifyArticleParamsSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: `Datos inválidos: ${validation.error.errors.map(e => e.message).join(', ')}` },
        { status: 400 }
      )
    }

    const { lawId, articleNumber, provider, model: requestedModel, questionIds } = validation.data

    // 1. Get law
    const law = await getLawById(lawId)
    if (!law) {
      return NextResponse.json({ success: false, error: 'Ley no encontrada' }, { status: 404 })
    }

    // 2. Get article
    const article = await getArticleByLawAndNumber(lawId, articleNumber)
    if (!article) {
      return NextResponse.json({ success: false, error: 'Artículo no encontrado' }, { status: 404 })
    }

    // 3. Get questions
    const questions = await getActiveQuestionsByArticleId(article.id, questionIds)

    if (!questions || questions.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No hay preguntas vinculadas a este artículo',
        results: [],
        questionsCount: 0,
      })
    }

    // 4. Get article content from BOE (or use DB)
    let articleContent = article.content || ''
    if (law.boeUrl) {
      const boeContent = await fetchArticleFromBOE(law.boeUrl, articleNumber)
      if (boeContent) {
        articleContent = `${article.title || ''}\n\n${boeContent}`
      }
    }

    // 5. Configure provider and model
    const normalizedProvider = normalizeProvider(provider)

    const dbConfig = await getAiApiConfig(normalizedProvider)
    let apiKey: string | undefined
    let defaultModel: string

    if (dbConfig?.apiKeyEncrypted) {
      apiKey = decryptApiKey(dbConfig.apiKeyEncrypted)
      defaultModel = dbConfig.defaultModel || 'gpt-4o-mini'
    } else {
      const envConfig = getAIConfigFromEnv(normalizedProvider)
      apiKey = envConfig.apiKey
      defaultModel = envConfig.model
    }

    console.log(`[AI-Verify] Provider: ${normalizedProvider}, Has API key: ${!!apiKey}`)

    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: `No hay API key configurada para ${normalizedProvider}. Configúrala en /admin/ai` },
        { status: 400 }
      )
    }

    const modelUsed = requestedModel || defaultModel
    const lawName = `${law.shortName} - ${law.name}`

    // 6. Divide into batches
    const safeBatchSize = getSafeBatchSize(modelUsed)
    const totalBatches = Math.ceil(questions.length / safeBatchSize)

    console.log(`[AI-Verify] Modelo: ${modelUsed}, max_tokens: ${getMaxOutputTokens(modelUsed)}, Preguntas: ${questions.length}, Lote seguro: ${safeBatchSize}, Total lotes: ${totalBatches}`)

    // 7. Process batches
    const allResults: Record<string, unknown>[] = []
    const allTokenUsage = { input_tokens: 0, output_tokens: 0, total_tokens: 0 }
    const errors: { batch: number; questionsRange: string; error: string }[] = []

    for (let i = 0; i < totalBatches; i++) {
      const startIdx = i * safeBatchSize
      const endIdx = Math.min(startIdx + safeBatchSize, questions.length)
      const batchQuestions = questions.slice(startIdx, endIdx)

      const batchResult = await processBatch({
        questions: batchQuestions,
        lawName,
        articleNumber,
        articleContent,
        provider: normalizedProvider,
        apiKey,
        model: modelUsed,
        lawId,
        articleId: article.id,
        batchIndex: i,
        totalBatches,
      })

      // Accumulate tokens
      if (batchResult.tokenUsage) {
        allTokenUsage.input_tokens += batchResult.tokenUsage.input_tokens || 0
        allTokenUsage.output_tokens += batchResult.tokenUsage.output_tokens || 0
        allTokenUsage.total_tokens += batchResult.tokenUsage.total_tokens || 0
      }

      if (batchResult.success) {
        allResults.push(...batchResult.results)
      } else {
        errors.push({
          batch: i + 1,
          questionsRange: `${startIdx + 1}-${endIdx}`,
          error: batchResult.error || 'Unknown error',
        })
        console.error(`[AI-Verify] Error en lote ${i + 1}/${totalBatches}:`, batchResult.error)
      }
    }

    // 8. Return combined results
    const hasErrors = errors.length > 0
    const allFailed = errors.length === totalBatches

    if (allFailed) {
      return NextResponse.json(
        {
          success: false,
          error: `Todos los lotes fallaron. Primer error: ${errors[0]?.error}`,
          errors,
          provider: normalizedProvider,
          model: modelUsed,
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      article: { number: articleNumber, title: article.title },
      questionsCount: questions.length,
      results: allResults,
      tokenUsage: allTokenUsage,
      provider: normalizedProvider,
      model: modelUsed,
      batches: {
        total: totalBatches,
        successful: totalBatches - errors.length,
        failed: errors.length,
        batchSize: safeBatchSize,
      },
      errors: hasErrors ? errors : undefined,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Error en verificación IA por artículo:', error)
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor', details: (error as Error).message },
      { status: 500 }
    )
  }
}

// ============================================
// GET: Retrieve saved verification results
// ============================================

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const lawId = searchParams.get('lawId')
  const articleNumber = searchParams.get('articleNumber')

  if (!lawId || !articleNumber) {
    return NextResponse.json(
      { success: false, error: 'Se requiere lawId y articleNumber' },
      { status: 400 }
    )
  }

  try {
    const article = await getArticleByLawAndNumber(lawId, articleNumber)

    if (!article) {
      return NextResponse.json({ success: true, results: [] })
    }

    const verifications = await getVerificationResultsByArticle(article.id)

    return NextResponse.json({ success: true, results: verifications })
  } catch (error) {
    console.error('Error obteniendo verificaciones:', error)
    return NextResponse.json(
      { success: false, error: 'Error obteniendo verificaciones', details: (error as Error).message },
      { status: 500 }
    )
  }
}
