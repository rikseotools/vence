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
    anthropic: 'claude-3-haiku-20240307',
    google: 'gemini-1.5-flash'
  }

  return {
    apiKey: envKeys[provider],
    model: defaultModels[provider],
    isActive: !!envKeys[provider]
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

    // 5. Construir el prompt para verificar TODAS las preguntas
    const prompt = buildBatchVerificationPrompt({
      lawName: `${law.short_name} - ${law.name}`,
      articleNumber,
      articleContent,
      questions
    })

    // 6. Llamar a la IA
    // Normalizar nombres de proveedores (claude -> anthropic)
    const normalizedProvider = provider === 'claude' ? 'anthropic' : provider

    // Obtener configuración desde BD
    const aiConfig = await getAIConfig(normalizedProvider)

    if (!aiConfig.apiKey) {
      return Response.json({
        success: false,
        error: `No hay API key configurada para ${normalizedProvider}. Configúrala en /admin/ai`
      }, { status: 400 })
    }

    let aiResponse
    // Usar modelo enviado por el cliente si existe, sino usar el de config
    let modelUsed = model || aiConfig.model
    let tokenUsage = {}

    if (normalizedProvider === 'anthropic') {
      const result = await verifyWithClaude(prompt, aiConfig.apiKey, modelUsed)
      aiResponse = result.response
      tokenUsage = result.usage || {}
    } else if (normalizedProvider === 'google') {
      const result = await verifyWithGoogle(prompt, aiConfig.apiKey, modelUsed)
      aiResponse = result.response
      tokenUsage = result.usage || {}
    } else {
      // OpenAI por defecto
      const result = await verifyWithOpenAI(prompt, aiConfig.apiKey, modelUsed)
      aiResponse = result.response
      tokenUsage = result.usage || {}
    }

    // 7. Guardar uso de tokens
    const endpoints = {
      openai: '/v1/chat/completions',
      anthropic: '/v1/messages',
      google: '/v1beta/models/generateContent'
    }
    await supabase.from('ai_api_usage').insert({
      provider: normalizedProvider,
      model: modelUsed,
      endpoint: endpoints[normalizedProvider] || 'unknown',
      input_tokens: tokenUsage.input_tokens || tokenUsage.prompt_tokens,
      output_tokens: tokenUsage.output_tokens || tokenUsage.completion_tokens,
      total_tokens: tokenUsage.total_tokens,
      feature: 'article_verification',
      law_id: lawId,
      article_number: articleNumber,
      questions_count: questions.length
    })

    // 8. Procesar y guardar resultados
    const results = []

    if (aiResponse.error) {
      return Response.json({
        success: false,
        error: aiResponse.error
      }, { status: 500 })
    }

    // Parsear resultados (esperamos un array de verificaciones)
    const verifications = aiResponse.verifications || []

    for (const question of questions) {
      // Buscar la verificación correspondiente
      const verification = verifications.find(v => v.questionId === question.id) ||
                          verifications[questions.indexOf(question)] ||
                          { isCorrect: null, explanation: 'No se pudo verificar esta pregunta' }

      // Guardar en BD (upsert para evitar duplicados)
      const { error: insertError } = await supabase
        .from('ai_verification_results')
        .upsert({
          question_id: question.id,
          article_id: article.id,
          law_id: lawId,
          is_correct: verification.isCorrect,
          confidence: verification.confidence,
          explanation: verification.explanation,
          article_quote: verification.articleQuote,
          suggested_fix: verification.suggestedFix,
          correct_option_should_be: verification.correctOptionShouldBe,
          new_explanation: verification.newExplanation,
          ai_provider: normalizedProvider,
          ai_model: modelUsed,
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

    return Response.json({
      success: true,
      article: {
        number: articleNumber,
        title: article.title
      },
      questionsCount: questions.length,
      results,
      tokenUsage,
      provider,
      model: modelUsed,
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

    const articleRegex = new RegExp(
      `<div[^>]*id="a${articleNumber}"[^>]*>[\\s\\S]*?<h5[^>]*class="articulo"[^>]*>([\\s\\S]*?)</h5>([\\s\\S]*?)(?=<div[^>]*class="bloque"|<p[^>]*class="linkSubir"|$)`,
      'i'
    )

    const match = html.match(articleRegex)

    if (match) {
      let content = match[2]
        .replace(/<p[^>]*class="bloque"[^>]*>.*?<\/p>/gi, '')
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
      "newExplanation": "OBLIGATORIO - Explicación DIDÁCTICA y COMPLETA para el alumno (mínimo 3-4 párrafos). Estructura:\n\n1. CONTEXTO: Explica el concepto legal que trata la pregunta y su importancia en el procedimiento administrativo.\n\n2. RESPUESTA CORRECTA: Indica cuál es y por qué es correcta según el artículo, citando el texto literal entre comillas.\n\n3. ANÁLISIS DE CADA OPCIÓN:\n   - Opción A: [Correcta/Incorrecta porque...]\n   - Opción B: [Correcta/Incorrecta porque...]\n   - Opción C: [Correcta/Incorrecta porque...]\n   - Opción D: [Correcta/Incorrecta porque...]\n\n4. CONSEJO DE ESTUDIO: Cómo recordar este concepto o relacionarlo con otros artículos de la ley.\n\nIMPORTANTE: Sé pedagógico, claro y detallado. El objetivo es que el alumno ENTIENDA el concepto, no solo memorice la respuesta."
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
- El objetivo es ENSEÑAR al alumno, no solo indicar si está bien o mal`
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
        max_tokens: 4000
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

    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        return {
          response: JSON.parse(jsonMatch[0]),
          usage
        }
      }
    } catch (e) {
      return {
        response: { error: 'No se pudo parsear la respuesta como JSON', raw: content },
        usage
      }
    }

    return {
      response: { verifications: [] },
      usage
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
        max_tokens: 4000,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      })
    })

    const data = await response.json()

    if (data.error) {
      return {
        response: { error: data.error.message },
        usage: {}
      }
    }

    const content = data.content?.[0]?.text
    const usage = {
      input_tokens: data.usage?.input_tokens,
      output_tokens: data.usage?.output_tokens,
      total_tokens: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0)
    }

    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        return {
          response: JSON.parse(jsonMatch[0]),
          usage
        }
      }
    } catch (e) {
      return {
        response: { error: 'No se pudo parsear la respuesta como JSON', raw: content },
        usage
      }
    }

    return {
      response: { verifications: [] },
      usage
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
            maxOutputTokens: 4000
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

    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        return {
          response: JSON.parse(jsonMatch[0]),
          usage
        }
      }
    } catch (e) {
      return {
        response: { error: 'No se pudo parsear la respuesta como JSON', raw: content },
        usage
      }
    }

    return {
      response: { verifications: [] },
      usage
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
