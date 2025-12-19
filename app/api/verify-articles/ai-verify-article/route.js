import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

/**
 * Obtiene la configuración de IA desde la base de datos
 */
async function getAIConfig(provider) {
  const { data: config } = await supabase
    .from('ai_api_config')
    .select('*')
    .eq('provider', provider)
    .single()

  if (config?.api_key_encrypted) {
    return {
      apiKey: Buffer.from(config.api_key_encrypted, 'base64').toString('utf-8'),
      model: config.default_model,
      isActive: config.is_active
    }
  }

  // Fallback a variables de entorno
  const envKeys = {
    openai: process.env.OPENAI_API_KEY,
    anthropic: process.env.ANTHROPIC_API_KEY,
    google: process.env.GOOGLE_AI_API_KEY
  }

  const defaultModels = {
    openai: 'gpt-4o-mini',
    anthropic: 'claude-sonnet-4-20250514',
    google: 'gemini-1.5-flash'
  }

  return {
    apiKey: envKeys[provider],
    model: defaultModels[provider],
    isActive: !!envKeys[provider]
  }
}

/**
 * Obtiene el límite de tokens de salida apropiado para cada modelo
 */
function getMaxOutputTokens(model) {
  const limits = {
    // Claude models
    'claude-3-haiku-20240307': 4096,
    'claude-sonnet-4-20250514': 8192,
    'claude-sonnet-4-5-20250929': 8192,
    // OpenAI models
    'gpt-4o-mini': 16384,
    'gpt-4o': 16384,
    'gpt-4-turbo': 4096,
    // Google models
    'gemini-1.5-flash': 8192,
    'gemini-1.5-flash-8b': 8192,
    'gemini-1.5-pro': 8192,
    'gemini-2.0-flash-exp': 8192,
  }
  return limits[model] || 4096 // Default conservador
}

/**
 * Obtiene el número máximo de preguntas seguras por lote según el modelo
 * Basado en datos reales: con explicaciones extensas, cada pregunta usa ~700-800 tokens
 */
function getSafeBatchSize(model) {
  // Límites específicos por modelo basados en pruebas reales
  const modelBatchLimits = {
    // Claude 3 Haiku: muy limitado (4096 tokens) - con 6 preguntas se trunca
    'claude-3-haiku-20240307': 4,
    // Claude Sonnet: 8192 tokens
    'claude-sonnet-4-20250514': 10,
    'claude-sonnet-4-5-20250929': 10,
    // GPT-4o: 16384 tokens - más holgado
    'gpt-4o-mini': 18,
    'gpt-4o': 18,
    'gpt-4-turbo': 4,
    // Gemini: 8192 tokens
    'gemini-1.5-flash': 10,
    'gemini-1.5-flash-8b': 10,
    'gemini-1.5-pro': 10,
    'gemini-2.0-flash-exp': 10,
  }

  return modelBatchLimits[model] || 4 // Default conservador
}

/**
 * Guarda un error de verificación en la BD para análisis posterior
 */
async function logVerificationError({
  lawId,
  articleNumber,
  provider,
  model,
  prompt,
  rawResponse,
  errorMessage,
  errorType,
  questionsCount,
  tokensUsed
}) {
  try {
    await supabase.from('ai_verification_errors').insert({
      law_id: lawId,
      article_number: articleNumber,
      provider,
      model,
      prompt: prompt?.substring(0, 50000), // Limitar tamaño
      raw_response: rawResponse?.substring(0, 50000),
      error_message: errorMessage,
      error_type: errorType,
      questions_count: questionsCount,
      tokens_used: tokensUsed
    })
  } catch (err) {
    console.error('Error guardando log de error:', err)
  }
}

/**
 * Procesa un lote de preguntas con la IA
 */
async function processBatch({
  questions,
  lawName,
  articleNumber,
  articleContent,
  provider,
  apiKey,
  model,
  lawId,
  articleId,
  batchIndex,
  totalBatches
}) {
  const prompt = buildBatchVerificationPrompt({
    lawName,
    articleNumber,
    articleContent,
    questions
  })

  console.log(`[AI-Verify] Procesando lote ${batchIndex + 1}/${totalBatches} (${questions.length} preguntas)`)

  let aiResponse
  let tokenUsage = {}

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

  // Guardar uso de tokens para este lote
  const endpoints = {
    openai: '/v1/chat/completions',
    anthropic: '/v1/messages',
    google: '/v1beta/models/generateContent'
  }
  await supabase.from('ai_api_usage').insert({
    provider,
    model,
    endpoint: endpoints[provider] || 'unknown',
    input_tokens: tokenUsage.input_tokens || tokenUsage.prompt_tokens,
    output_tokens: tokenUsage.output_tokens || tokenUsage.completion_tokens,
    total_tokens: tokenUsage.total_tokens,
    feature: 'article_verification',
    law_id: lawId,
    article_number: articleNumber,
    questions_count: questions.length
  })

  // Verificar si hay error
  if (aiResponse.error) {
    await logVerificationError({
      lawId,
      articleNumber,
      provider,
      model,
      prompt,
      rawResponse: aiResponse.raw,
      errorMessage: aiResponse.error,
      errorType: aiResponse.error.includes('JSON') ? 'json_parse' : 'api_error',
      questionsCount: questions.length,
      tokensUsed: tokenUsage
    })

    return {
      success: false,
      error: aiResponse.error,
      raw: aiResponse.raw,
      tokenUsage,
      results: []
    }
  }

  // Procesar y guardar resultados del lote
  const verifications = aiResponse.verifications || []
  const results = []

  for (const question of questions) {
    const verification = verifications.find(v => v.questionId === question.id) ||
                        verifications[questions.indexOf(question)] ||
                        { isCorrect: null, explanation: 'No se pudo verificar esta pregunta' }

    // Guardar en BD
    const { error: insertError } = await supabase
      .from('ai_verification_results')
      .upsert({
        question_id: question.id,
        article_id: articleId,
        law_id: lawId,
        is_correct: verification.isCorrect,
        confidence: verification.confidence,
        explanation: verification.explanation,
        article_quote: verification.articleQuote,
        suggested_fix: verification.suggestedFix,
        correct_option_should_be: verification.correctOptionShouldBe,
        new_explanation: verification.newExplanation,
        ai_provider: provider,
        ai_model: model,
        verified_at: new Date().toISOString()
      }, {
        onConflict: 'question_id,ai_provider'
      })

    if (insertError) {
      console.error('Error guardando verificación:', insertError)
    }

    results.push({
      questionId: question.id,
      questionText: question.question_text.substring(0, 100) + '...',
      ...verification
    })
  }

  return {
    success: true,
    tokenUsage,
    results
  }
}

/**
 * POST /api/verify-articles/ai-verify-article
 * Verifica TODAS las preguntas de un artículo con IA en una sola llamada
 */
export async function POST(request) {
  try {
    const { lawId, articleNumber, provider = 'openai', model } = await request.json()

    if (!lawId || !articleNumber) {
      return Response.json({
        success: false,
        error: 'Se requiere lawId y articleNumber'
      }, { status: 400 })
    }

    // 1. Obtener la ley y su URL del BOE
    const { data: law, error: lawError } = await supabase
      .from('laws')
      .select('id, short_name, name, boe_url')
      .eq('id', lawId)
      .single()

    if (lawError || !law) {
      return Response.json({
        success: false,
        error: 'Ley no encontrada'
      }, { status: 404 })
    }

    // 2. Obtener el artículo
    const { data: article, error: articleError } = await supabase
      .from('articles')
      .select('id, article_number, title, content')
      .eq('law_id', lawId)
      .eq('article_number', articleNumber)
      .single()

    if (articleError || !article) {
      return Response.json({
        success: false,
        error: 'Artículo no encontrado'
      }, { status: 404 })
    }

    // 3. Obtener todas las preguntas del artículo
    const { data: questions, error: questionsError } = await supabase
      .from('questions')
      .select(`
        id,
        question_text,
        option_a,
        option_b,
        option_c,
        option_d,
        correct_option,
        explanation
      `)
      .eq('primary_article_id', article.id)
      .eq('is_active', true)

    if (questionsError) {
      return Response.json({
        success: false,
        error: 'Error obteniendo preguntas',
        details: questionsError.message
      }, { status: 500 })
    }

    if (!questions || questions.length === 0) {
      return Response.json({
        success: true,
        message: 'No hay preguntas vinculadas a este artículo',
        results: [],
        questionsCount: 0
      })
    }

    // 4. Obtener contenido del artículo del BOE (o usar el de BD)
    let articleContent = article.content
    if (law.boe_url) {
      const boeContent = await fetchArticleFromBOE(law.boe_url, articleNumber)
      if (boeContent) {
        articleContent = `${article.title || ''}\n\n${boeContent}`
      }
    }

    // 5. Configurar proveedor y modelo
    // Normalizar nombres de proveedores (claude -> anthropic)
    const normalizedProvider = provider === 'claude' ? 'anthropic' : provider

    // Obtener configuración desde BD
    const aiConfig = await getAIConfig(normalizedProvider)

    console.log(`[AI-Verify] Provider: ${normalizedProvider}, Model config: ${aiConfig.model}, Has API key: ${!!aiConfig.apiKey}`)

    if (!aiConfig.apiKey) {
      return Response.json({
        success: false,
        error: `No hay API key configurada para ${normalizedProvider}. Configúrala en /admin/ai`
      }, { status: 400 })
    }

    // Usar modelo enviado por el cliente si existe, sino usar el de config
    const modelUsed = model || aiConfig.model
    const lawName = `${law.short_name} - ${law.name}`

    // 6. Dividir en lotes si es necesario
    const safeBatchSize = getSafeBatchSize(modelUsed)
    const totalBatches = Math.ceil(questions.length / safeBatchSize)

    console.log(`[AI-Verify] Modelo: ${modelUsed}, max_tokens: ${getMaxOutputTokens(modelUsed)}, Preguntas: ${questions.length}, Lote seguro: ${safeBatchSize}, Total lotes: ${totalBatches}`)

    // 7. Procesar preguntas en lotes
    const allResults = []
    const allTokenUsage = { input_tokens: 0, output_tokens: 0, total_tokens: 0 }
    const errors = []

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
        apiKey: aiConfig.apiKey,
        model: modelUsed,
        lawId,
        articleId: article.id,
        batchIndex: i,
        totalBatches
      })

      // Acumular tokens
      if (batchResult.tokenUsage) {
        allTokenUsage.input_tokens += batchResult.tokenUsage.input_tokens || 0
        allTokenUsage.output_tokens += batchResult.tokenUsage.output_tokens || 0
        allTokenUsage.total_tokens += batchResult.tokenUsage.total_tokens || 0
      }

      if (batchResult.success) {
        allResults.push(...batchResult.results)
      } else {
        // Si falla un lote, registrar el error pero continuar con los demás
        errors.push({
          batch: i + 1,
          questionsRange: `${startIdx + 1}-${endIdx}`,
          error: batchResult.error
        })
        console.error(`[AI-Verify] Error en lote ${i + 1}/${totalBatches}:`, batchResult.error)
      }
    }

    // 8. Retornar resultados combinados
    const hasErrors = errors.length > 0
    const allFailed = errors.length === totalBatches

    if (allFailed) {
      return Response.json({
        success: false,
        error: `Todos los lotes fallaron. Primer error: ${errors[0]?.error}`,
        errors,
        provider: normalizedProvider,
        model: modelUsed
      }, { status: 500 })
    }

    return Response.json({
      success: true,
      article: {
        number: articleNumber,
        title: article.title
      },
      questionsCount: questions.length,
      results: allResults,
      tokenUsage: allTokenUsage,
      provider: normalizedProvider,
      model: modelUsed,
      batches: {
        total: totalBatches,
        successful: totalBatches - errors.length,
        failed: errors.length,
        batchSize: safeBatchSize
      },
      errors: hasErrors ? errors : undefined,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Error en verificación IA por artículo:', error)
    return Response.json({
      success: false,
      error: 'Error interno del servidor',
      details: error.message
    }, { status: 500 })
  }
}

/**
 * Extrae contenido de un artículo del BOE
 */
async function fetchArticleFromBOE(boeUrl, articleNumber) {
  try {
    const response = await fetch(boeUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; VenceBot/1.0)',
        'Accept': 'text/html',
        'Accept-Language': 'es-ES,es;q=0.9'
      }
    })

    if (!response.ok) return null

    const html = await response.text()

    // Nota: algunos BOE usan IDs numéricos (a207) y otros textuales (adoscientossiete)
    const articleRegex = new RegExp(
      `<div[^>]*id="a${articleNumber}"[^>]*>[\\s\\S]*?<h5[^>]*class="articulo"[^>]*>([\\s\\S]*?)</h5>([\\s\\S]*?)(?=<div[^>]*class="bloque"|$)`,
      'i'
    )

    const match = html.match(articleRegex)

    if (match) {
      let content = match[2]
        .replace(/<p[^>]*class="bloque"[^>]*>.*?<\/p>/gi, '') // Quitar [Bloque X: #aX]
        .replace(/<p[^>]*class="nota_pie"[^>]*>[\s\S]*?<\/p>/gi, '') // Quitar notas de modificación
        .replace(/<p[^>]*class="linkSubir"[^>]*>[\s\S]*?<\/p>/gi, '') // Quitar enlace "Subir"
        .replace(/<blockquote[^>]*>[\s\S]*?<\/blockquote>/gi, '') // Quitar bloques de notas
        .replace(/<form[^>]*>[\s\S]*?<\/form>/gi, '') // Quitar formularios
        .replace(/<a[^>]*class="[^"]*jurisprudencia[^"]*"[^>]*>[\s\S]*?<\/a>/gi, '') // Quitar jurisprudencia
        .replace(/Jurisprudencia/gi, '')
        // Preservar estructura de párrafos
        .replace(/<\/p>/gi, '\n\n')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/li>/gi, '\n')
        .replace(/<\/div>/gi, '\n')
        .replace(/<[^>]*>/g, '')
        .replace(/\n{3,}/g, '\n\n')
        .replace(/[ \t]+/g, ' ')
        .replace(/^ +| +$/gm, '')
        .trim()

      return content
    }

    return null
  } catch (error) {
    console.error('Error fetching BOE article:', error)
    return null
  }
}

/**
 * Construye el prompt para verificar múltiples preguntas
 */
function buildBatchVerificationPrompt({ lawName, articleNumber, articleContent, questions }) {
  const questionsText = questions.map((q, i) => {
    const correctLetter = ['A', 'B', 'C', 'D'][q.correct_option]
    return `
### Pregunta ${i + 1} (ID: ${q.id})
${q.question_text}

A) ${q.option_a}
B) ${q.option_b}
C) ${q.option_c}
D) ${q.option_d}

Respuesta marcada como correcta: ${correctLetter}
Explicación actual: ${q.explanation || 'No disponible'}
`
  }).join('\n---\n')

  return `Eres un experto en derecho administrativo español. Tu tarea es verificar si las siguientes preguntas de examen de oposiciones son correctas basándote en el contenido LITERAL del artículo de la ley.

## ARTÍCULO OFICIAL DEL BOE
Ley: ${lawName}
Artículo ${articleNumber}:

${articleContent}

## PREGUNTAS A VERIFICAR (${questions.length} preguntas)

${questionsText}

## TU ANÁLISIS

Para CADA pregunta, verifica:
1. Si la respuesta marcada como correcta es realmente correcta según el artículo LITERAL del BOE
2. Si las otras opciones son claramente incorrectas
3. Si la explicación es correcta

Responde en formato JSON con este esquema exacto:
{
  "verifications": [
    {
      "questionId": "uuid-de-la-pregunta",
      "isCorrect": true/false,
      "confidence": "alta/media/baja",
      "explanation": "Tu análisis interno sobre por qué la respuesta es correcta o incorrecta",
      "articleQuote": "Cita LITERAL del artículo del BOE que justifica la respuesta",
      "suggestedFix": "Descripción del error si lo hay. null si está bien",
      "correctOptionShouldBe": "A/B/C/D si hay error, null si está bien",
      "newExplanation": "OBLIGATORIO - Explicación DIDÁCTICA y COMPLETA para el alumno. Estructura:\n\n1. FUNDAMENTO LEGAL: Cita SIEMPRE el artículo completo con su apartado específico y la ley. Ejemplos correctos:\n   - 'El artículo 3.5 de la Ley 39/2015 establece que...'\n   - 'Según el artículo 21.2.a) de la Ley 39/2015 del Procedimiento Administrativo Común...'\n   - 'El apartado 3 del artículo 53 de la Ley 39/2015 dispone...'\n   NUNCA digas solo 'El artículo establece...' sin especificar número, apartado y ley.\n\n2. RESPUESTA CORRECTA: Explica POR QUÉ es correcta citando el texto literal del artículo entre comillas.\n\n3. ANÁLISIS DE OPCIONES INCORRECTAS: Explica brevemente por qué cada opción incorrecta no es válida.\n\n4. CONSEJO PRÁCTICO: Un truco nemotécnico o relación con otros conceptos para recordarlo.\n\nIMPORTANTE: Sé claro, pedagógico y preciso. El alumno debe entender el concepto legal, no solo memorizar."
    }
  ]
}

IMPORTANTE:
- Devuelve exactamente ${questions.length} verificaciones, una por pregunta
- Mantén el orden de las preguntas
- Usa los IDs de pregunta proporcionados
- El campo "newExplanation" es OBLIGATORIO y debe ser DIDÁCTICO Y EXTENSO (mínimo 200 palabras)
- NO ALUCINES: si algo no está en el artículo, no lo inventes
- Las citas entre comillas deben ser EXACTAS del texto proporcionado arriba
- Si no puedes verificar algo con el artículo dado, indícalo claramente
- El objetivo es ENSEÑAR al alumno, no solo indicar si está bien o mal

FORMATO JSON CRÍTICO:
- Devuelve SOLO el JSON, sin texto antes ni después
- Los saltos de línea dentro de strings DEBEN ser \\n (escapados), NUNCA saltos de línea literales
- Ejemplo correcto: "explanation": "Primera línea.\\n\\nSegunda línea."
- Ejemplo INCORRECTO: "explanation": "Primera línea.
Segunda línea."
- El JSON debe ser válido y parseable directamente`
}

/**
 * Verifica con OpenAI (GPT)
 */
async function verifyWithOpenAI(prompt, apiKey, model = 'gpt-4o-mini') {
  if (!apiKey) {
    return {
      response: { error: 'OpenAI API key no configurada' },
      usage: {}
    }
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'system',
            content: 'Eres un experto en derecho administrativo español. Respondes siempre en JSON válido.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.1,
        max_tokens: getMaxOutputTokens(model)
      })
    })

    const data = await response.json()

    if (data.error) {
      return {
        response: { error: data.error.message },
        usage: {}
      }
    }

    const content = data.choices?.[0]?.message?.content
    const usage = data.usage

    // Verificar que hay contenido
    if (!content) {
      console.error('OpenAI no devolvió contenido. Respuesta:', JSON.stringify(data))
      return {
        response: { error: 'OpenAI no devolvió contenido en la respuesta', raw: JSON.stringify(data) },
        usage
      }
    }

    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        let jsonStr = jsonMatch[0]

        // Intentar parsear directamente primero
        try {
          return { response: JSON.parse(jsonStr), usage }
        } catch (firstError) {
          // Si falla, limpiar caracteres de control dentro de strings
          jsonStr = jsonStr.replace(/"([^"\\]|\\.)*"/g, (match) => {
            return match
              .replace(/\n/g, '\\n')
              .replace(/\r/g, '\\r')
              .replace(/\t/g, '\\t')
              .replace(/[\x00-\x1F\x7F]/g, '')
          })
          return { response: JSON.parse(jsonStr), usage }
        }
      } else {
        console.error('No se encontró JSON en la respuesta de OpenAI:', content.substring(0, 500))
        return {
          response: { error: 'No se encontró JSON en la respuesta', raw: content.substring(0, 500) },
          usage
        }
      }
    } catch (e) {
      console.error('Error parseando JSON de OpenAI:', e.message, 'Contenido:', content.substring(0, 500))
      return {
        response: { error: `No se pudo parsear la respuesta como JSON: ${e.message}`, raw: content.substring(0, 500) },
        usage
      }
    }
  } catch (error) {
    return {
      response: { error: error.message },
      usage: {}
    }
  }
}

/**
 * Verifica con Claude (Anthropic)
 */
async function verifyWithClaude(prompt, apiKey, model = 'claude-3-haiku-20240307') {
  if (!apiKey) {
    return {
      response: { error: 'Anthropic API key no configurada' },
      usage: {}
    }
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model,
        max_tokens: getMaxOutputTokens(model),
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      })
    })

    const data = await response.json()

    // Manejar errores HTTP
    if (!response.ok) {
      console.error('Error HTTP de Claude:', response.status, JSON.stringify(data))
      return {
        response: { error: data.error?.message || `Error HTTP ${response.status}`, raw: JSON.stringify(data) },
        usage: {}
      }
    }

    // Manejar errores en la respuesta
    if (data.error || data.type === 'error') {
      console.error('Error en respuesta de Claude:', JSON.stringify(data))
      return {
        response: { error: data.error?.message || data.message || 'Error desconocido de Claude', raw: JSON.stringify(data) },
        usage: {}
      }
    }

    const content = data.content?.[0]?.text
    const usage = {
      input_tokens: data.usage?.input_tokens,
      output_tokens: data.usage?.output_tokens,
      total_tokens: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0)
    }

    // Verificar que hay contenido
    if (!content) {
      console.error('Claude no devolvió contenido. Respuesta:', JSON.stringify(data))
      return {
        response: { error: 'Claude no devolvió contenido en la respuesta', raw: JSON.stringify(data) },
        usage
      }
    }

    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        let jsonStr = jsonMatch[0]

        // Intentar parsear directamente primero
        try {
          return { response: JSON.parse(jsonStr), usage }
        } catch (firstError) {
          // Si falla, limpiar caracteres de control dentro de strings
          // Reemplazar caracteres de control problemáticos dentro de strings JSON
          jsonStr = jsonStr.replace(/"([^"\\]|\\.)*"/g, (match) => {
            return match
              .replace(/\n/g, '\\n')
              .replace(/\r/g, '\\r')
              .replace(/\t/g, '\\t')
              .replace(/[\x00-\x1F\x7F]/g, '') // Eliminar otros caracteres de control
          })

          return { response: JSON.parse(jsonStr), usage }
        }
      } else {
        console.error('No se encontró JSON en la respuesta de Claude:', content.substring(0, 500))
        return {
          response: { error: 'No se encontró JSON en la respuesta', raw: content.substring(0, 500) },
          usage
        }
      }
    } catch (e) {
      console.error('Error parseando JSON de Claude:', e.message, 'Contenido:', content.substring(0, 500))
      return {
        response: { error: `No se pudo parsear la respuesta como JSON: ${e.message}`, raw: content.substring(0, 500) },
        usage
      }
    }
  } catch (error) {
    return {
      response: { error: error.message },
      usage: {}
    }
  }
}

/**
 * Verifica con Google Gemini
 */
async function verifyWithGoogle(prompt, apiKey, model = 'gemini-1.5-flash') {
  if (!apiKey) {
    return {
      response: { error: 'Google AI API key no configurada' },
      usage: {}
    }
  }

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: `Eres un experto en derecho administrativo español. Respondes siempre en JSON válido.\n\n${prompt}` }]
            }
          ],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: getMaxOutputTokens(model)
          }
        })
      }
    )

    const data = await response.json()

    if (data.error) {
      return {
        response: { error: data.error.message },
        usage: {}
      }
    }

    const content = data.candidates?.[0]?.content?.parts?.[0]?.text
    const usage = {
      input_tokens: data.usageMetadata?.promptTokenCount || 0,
      output_tokens: data.usageMetadata?.candidatesTokenCount || 0,
      total_tokens: data.usageMetadata?.totalTokenCount || 0
    }

    // Verificar que hay contenido
    if (!content) {
      console.error('Google no devolvió contenido. Respuesta:', JSON.stringify(data))
      return {
        response: { error: 'Google no devolvió contenido en la respuesta', raw: JSON.stringify(data) },
        usage
      }
    }

    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        return {
          response: JSON.parse(jsonMatch[0]),
          usage
        }
      } else {
        console.error('No se encontró JSON en la respuesta de Google:', content.substring(0, 500))
        return {
          response: { error: 'No se encontró JSON en la respuesta', raw: content.substring(0, 500) },
          usage
        }
      }
    } catch (e) {
      console.error('Error parseando JSON de Google:', e.message, 'Contenido:', content.substring(0, 500))
      return {
        response: { error: `No se pudo parsear la respuesta como JSON: ${e.message}`, raw: content.substring(0, 500) },
        usage
      }
    }
  } catch (error) {
    return {
      response: { error: error.message },
      usage: {}
    }
  }
}

/**
 * GET /api/verify-articles/ai-verify-article
 * Obtiene los resultados de verificación guardados para un artículo
 */
export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const lawId = searchParams.get('lawId')
  const articleNumber = searchParams.get('articleNumber')

  if (!lawId || !articleNumber) {
    return Response.json({
      success: false,
      error: 'Se requiere lawId y articleNumber'
    }, { status: 400 })
  }

  try {
    // Obtener el artículo
    const { data: article } = await supabase
      .from('articles')
      .select('id')
      .eq('law_id', lawId)
      .eq('article_number', articleNumber)
      .single()

    if (!article) {
      return Response.json({
        success: true,
        results: []
      })
    }

    // Obtener verificaciones guardadas
    const { data: verifications, error } = await supabase
      .from('ai_verification_results')
      .select(`
        *,
        questions (
          id,
          question_text,
          option_a,
          option_b,
          option_c,
          option_d,
          correct_option
        )
      `)
      .eq('article_id', article.id)
      .order('verified_at', { ascending: false })

    if (error) {
      throw error
    }

    return Response.json({
      success: true,
      results: verifications || []
    })

  } catch (error) {
    console.error('Error obteniendo verificaciones:', error)
    return Response.json({
      success: false,
      error: 'Error obteniendo verificaciones',
      details: error.message
    }, { status: 500 })
  }
}
