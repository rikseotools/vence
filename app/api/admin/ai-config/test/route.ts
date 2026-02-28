// app/api/admin/ai-config/test/route.ts
// API para probar APIs de IA
import { NextResponse } from 'next/server'
import { getConfigByProvider, updateVerificationStatus } from '@/lib/api/admin-ai-config'
import { testAiConfigRequestSchema } from '@/lib/api/admin-ai-config/schemas'

// Precios por millón de tokens (input/output) en USD
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  'gpt-4o-mini': { input: 0.15, output: 0.60 },
  'gpt-4o': { input: 2.50, output: 10.00 },
  'gpt-4-turbo': { input: 10.00, output: 30.00 },
  'claude-3-haiku-20240307': { input: 0.25, output: 1.25 },
  'claude-sonnet-4-20250514': { input: 3.00, output: 15.00 },
  'claude-sonnet-4-5-20250929': { input: 3.00, output: 15.00 },
  'gemini-1.5-flash': { input: 0.075, output: 0.30 },
  'gemini-1.5-flash-8b': { input: 0.0375, output: 0.15 },
  'gemini-1.5-pro': { input: 1.25, output: 5.00 },
  'gemini-2.0-flash-exp': { input: 0, output: 0 },
}

interface UsageData {
  input_tokens?: number
  prompt_tokens?: number
  output_tokens?: number
  completion_tokens?: number
}

function estimateCost(modelId: string, usage: UsageData | null) {
  const pricing = MODEL_PRICING[modelId]
  if (!pricing || !usage) return null

  const inputTokens = usage.input_tokens || usage.prompt_tokens || 0
  const outputTokens = usage.output_tokens || usage.completion_tokens || 0

  const inputCost = (inputTokens / 1_000_000) * pricing.input
  const outputCost = (outputTokens / 1_000_000) * pricing.output
  const totalCost = inputCost + outputCost

  return {
    inputTokens,
    outputTokens,
    totalTokens: inputTokens + outputTokens,
    inputCost: inputCost.toFixed(6),
    outputCost: outputCost.toFixed(6),
    totalCost: totalCost.toFixed(6),
    totalCostFormatted: totalCost < 0.01 ? `$${(totalCost * 1000).toFixed(4)}m` : `$${totalCost.toFixed(4)}`,
  }
}

const AVAILABLE_MODELS: Record<string, Array<{ id: string; name: string }>> = {
  openai: [
    { id: 'gpt-4o-mini', name: 'GPT-4o Mini' },
    { id: 'gpt-4o', name: 'GPT-4o' },
    { id: 'gpt-4-turbo', name: 'GPT-4 Turbo' },
  ],
  anthropic: [
    { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku' },
    { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4' },
    { id: 'claude-sonnet-4-5-20250929', name: 'Claude Sonnet 4.5' },
  ],
  google: [
    { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash' },
    { id: 'gemini-1.5-flash-8b', name: 'Gemini 1.5 Flash 8B' },
    { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro' },
    { id: 'gemini-2.0-flash-exp', name: 'Gemini 2.0 Flash (Exp)' },
  ],
}

interface TestResult {
  success: boolean
  provider: string
  model?: string
  latency?: number
  response?: string
  usage?: UsageData | null
  error?: string
  errorType?: string
  message?: string
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const parsed = testAiConfigRequestSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Se requiere provider' },
        { status: 400 }
      )
    }

    const { provider, apiKey, model, testAllModels } = parsed.data

    // Obtener la key: o la que nos pasan, o la guardada en BD
    let keyToTest = apiKey

    if (!keyToTest) {
      const config = await getConfigByProvider(provider)
      if (config?.apiKeyEncrypted) {
        keyToTest = Buffer.from(config.apiKeyEncrypted, 'base64').toString('utf-8')
      }
    }

    if (!keyToTest) {
      // Fallback a variables de entorno
      if (provider === 'openai') keyToTest = process.env.OPENAI_API_KEY
      else if (provider === 'anthropic') keyToTest = process.env.ANTHROPIC_API_KEY
      else if (provider === 'google') keyToTest = process.env.GOOGLE_AI_API_KEY
    }

    if (!keyToTest) {
      return NextResponse.json(
        { success: false, error: 'No hay API key configurada para este proveedor' },
        { status: 400 }
      )
    }

    // Si testAllModels=true, probar todos los modelos del proveedor
    if (testAllModels) {
      const models = AVAILABLE_MODELS[provider] || []
      const modelResults: Array<{
        modelId: string
        modelName: string
        success: boolean
        latency?: number
        error?: string
        errorType?: string
        usage?: UsageData | null
        estimatedCost: ReturnType<typeof estimateCost>
      }> = []
      let anySuccess = false

      for (const modelInfo of models) {
        let result: TestResult
        if (provider === 'openai') result = await testOpenAI(keyToTest, modelInfo.id)
        else if (provider === 'anthropic') result = await testAnthropic(keyToTest, modelInfo.id)
        else if (provider === 'google') result = await testGoogle(keyToTest, modelInfo.id)
        else result = { success: false, provider, error: 'Proveedor no soportado' }

        modelResults.push({
          modelId: modelInfo.id,
          modelName: modelInfo.name,
          success: result.success,
          latency: result.latency,
          error: result.error,
          errorType: result.errorType,
          usage: result.usage,
          estimatedCost: result.usage ? estimateCost(modelInfo.id, result.usage) : null,
        })

        if (result.success) anySuccess = true
      }

      const workingModels = modelResults.filter(m => m.success).map(m => m.modelId)
      const failedModels = modelResults.filter(m => !m.success).map(m => ({
        id: m.modelId,
        error: m.error,
      }))

      const testResults = JSON.stringify({
        working: workingModels,
        failed: failedModels,
        testedAt: new Date().toISOString(),
      })

      await updateVerificationStatus(
        provider,
        anySuccess ? 'valid' : 'invalid',
        testResults
      )

      return NextResponse.json({
        success: anySuccess,
        provider,
        testAllModels: true,
        modelResults,
        workingModels,
        failedModels,
        summary: {
          total: modelResults.length,
          working: workingModels.length,
          failed: failedModels.length,
        },
      })
    }

    // Probar solo un modelo específico
    let result: TestResult

    if (provider === 'openai') result = await testOpenAI(keyToTest, model || 'gpt-4o-mini')
    else if (provider === 'anthropic') result = await testAnthropic(keyToTest, model || 'claude-sonnet-4-20250514')
    else if (provider === 'google') result = await testGoogle(keyToTest, model || 'gemini-1.5-flash')
    else {
      return NextResponse.json(
        { success: false, error: 'Proveedor no soportado' },
        { status: 400 }
      )
    }

    await updateVerificationStatus(
      provider,
      result.success ? 'valid' : 'invalid',
      result.error || null
    )

    return NextResponse.json(result)
  } catch (error) {
    console.error('❌ [API/admin/ai-config/test] Error:', error)
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    )
  }
}

async function testOpenAI(apiKey: string, model: string): Promise<TestResult> {
  try {
    const startTime = Date.now()
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: 'Responde solo con la palabra "OK"' }],
        max_tokens: 10,
        temperature: 0,
      }),
    })

    const latency = Date.now() - startTime
    const data = await response.json()

    if (!response.ok) {
      return { success: false, provider: 'openai', error: data.error?.message || 'Error de autenticación', errorType: data.error?.type }
    }

    return {
      success: true, provider: 'openai', model, latency,
      response: data.choices?.[0]?.message?.content,
      usage: data.usage,
      message: `API funcionando correctamente (${latency}ms)`,
    }
  } catch (error) {
    return { success: false, provider: 'openai', error: (error as Error).message }
  }
}

async function testAnthropic(apiKey: string, model: string): Promise<TestResult> {
  try {
    const startTime = Date.now()
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: 10,
        messages: [{ role: 'user', content: 'Responde solo con la palabra "OK"' }],
      }),
    })

    const latency = Date.now() - startTime
    const data = await response.json()

    if (!response.ok) {
      return { success: false, provider: 'anthropic', error: data.error?.message || 'Error de autenticación', errorType: data.error?.type }
    }

    return {
      success: true, provider: 'anthropic', model, latency,
      response: data.content?.[0]?.text,
      usage: data.usage,
      message: `API funcionando correctamente (${latency}ms)`,
    }
  } catch (error) {
    return { success: false, provider: 'anthropic', error: (error as Error).message }
  }
}

async function testGoogle(apiKey: string, model: string): Promise<TestResult> {
  try {
    const startTime = Date.now()
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: 'Responde solo con la palabra "OK"' }] }],
          generationConfig: { maxOutputTokens: 10, temperature: 0 },
        }),
      }
    )

    const latency = Date.now() - startTime
    const data = await response.json()

    if (!response.ok) {
      return { success: false, provider: 'google', error: data.error?.message || 'Error de autenticación', errorType: data.error?.status }
    }

    const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text

    return {
      success: true, provider: 'google', model, latency,
      response: responseText,
      usage: data.usageMetadata ? {
        input_tokens: data.usageMetadata.promptTokenCount,
        output_tokens: data.usageMetadata.candidatesTokenCount,
      } : null,
      message: `API funcionando correctamente (${latency}ms)`,
    }
  } catch (error) {
    return { success: false, provider: 'google', error: (error as Error).message }
  }
}
