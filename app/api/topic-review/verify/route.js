// app/api/topic-review/verify/route.js
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
 * Límite de tokens de salida por modelo
 */
function getMaxOutputTokens(model) {
  const limits = {
    'claude-3-haiku-20240307': 4096,
    'claude-sonnet-4-20250514': 8192,
    'claude-sonnet-4-5-20250929': 8192,
    'gpt-4o-mini': 16384,
    'gpt-4o': 16384,
    'gemini-1.5-flash': 8192,
    'gemini-1.5-pro': 8192,
    'gemini-2.0-flash-exp': 8192,
  }
  return limits[model] || 4096
}

/**
 * Determina el estado de revisión basándose en las 3 variables booleanas
 *
 * Para leyes normales (8 estados):
 * | articleOk | answerOk | explanationOk | Estado |
 * |-----------|----------|---------------|--------|
 * | ✅ | ✅ | ✅ | perfect |
 * | ✅ | ✅ | ❌ | bad_explanation |
 * | ✅ | ❌ | ✅ | bad_answer |
 * | ✅ | ❌ | ❌ | bad_answer_and_explanation |
 * | ❌ | ✅ | ✅ | wrong_article |
 * | ❌ | ✅ | ❌ | wrong_article_bad_explanation |
 * | ❌ | ❌ | ✅ | wrong_article_bad_answer |
 * | ❌ | ❌ | ❌ | all_wrong |
 *
 * Para leyes virtuales/técnicas (4 estados - articleOk no aplica):
 * | answerOk | explanationOk | Estado |
 * |----------|---------------|--------|
 * | ✅ | ✅ | tech_perfect |
 * | ✅ | ❌ | tech_bad_explanation |
 * | ❌ | ✅ | tech_bad_answer |
 * | ❌ | ❌ | tech_bad_answer_and_explanation |
 */
function determineReviewStatus(articleOk, answerOk, explanationOk, isVirtual = false) {
  // Para leyes virtuales, articleOk no aplica
  if (isVirtual) {
    if (answerOk && explanationOk) return 'tech_perfect'
    if (answerOk && !explanationOk) return 'tech_bad_explanation'
    if (!answerOk && explanationOk) return 'tech_bad_answer'
    return 'tech_bad_answer_and_explanation'
  }

  // Para leyes normales
  if (articleOk) {
    if (answerOk && explanationOk) return 'perfect'
    if (answerOk && !explanationOk) return 'bad_explanation'
    if (!answerOk && explanationOk) return 'bad_answer'
    return 'bad_answer_and_explanation'
  } else {
    if (answerOk && explanationOk) return 'wrong_article'
    if (answerOk && !explanationOk) return 'wrong_article_bad_explanation'
    if (!answerOk && explanationOk) return 'wrong_article_bad_answer'
    return 'all_wrong'
  }
}

/**
 * Detecta si una pregunta pide "la incorrecta" o "la falsa"
 */
function isNegativeQuestion(questionText) {
  const negativePatterns = [
    /incorrecta/i,
    /falsa/i,
    /no es\b/i,
    /no está/i,
    /no corresponde/i,
    /no se encuentra/i,
    /no se menciona/i,
    /no se recoge/i,
    /no se incluye/i,
    /no se contempla/i,
    /no figura/i,
    /no incluye/i,
    /no contempla/i,
    /no recoge/i,
    /no menciona/i,
    /no establece/i,
    /no reconoce/i,
    /no garantiza/i,
    /no prevé/i,
    /excepción/i,
    /excepto/i,
    /salvo/i,
    /menos/i,
    /cuál.*no\b/i,
    /qué.*no\b/i
  ]
  return negativePatterns.some(pattern => pattern.test(questionText))
}

/**
 * Construye el prompt para verificación de contenido TÉCNICO (leyes virtuales)
 * Solo verifica answerOk y explanationOk (articleOk no aplica)
 */
function buildTechnicalVerificationPrompt({ topicName, contentTitle, contentText, question }) {
  const correctLetter = ['A', 'B', 'C', 'D'][question.correct_option]
  const isNegative = isNegativeQuestion(question.question_text)

  // Instrucción especial para preguntas negativas
  const negativeWarning = isNegative ? `
⚠️ ATENCIÓN: Esta es una PREGUNTA NEGATIVA (pide "la incorrecta", "la falsa", "la que NO...", etc.)
En este tipo de preguntas:
- La respuesta correcta (${correctLetter}) es la opción que es FALSA o INCORRECTA técnicamente
- Las otras 3 opciones SÍ son verdaderas
- Para que answerOk=true, la opción ${correctLetter} debe ser efectivamente la que NO es correcta
` : ''

  return `Eres un experto verificador de contenido técnico para oposiciones de Auxiliar Administrativo. Tu tarea es analizar si una pregunta de informática/ofimática está correctamente configurada.

## CONTENIDO DE REFERENCIA
Tema: ${topicName}
Sección: ${contentTitle || ''}

${contentText}

## PREGUNTA A VERIFICAR
${question.question_text}

A) ${question.option_a}
B) ${question.option_b}
C) ${question.option_c}
D) ${question.option_d}

Respuesta marcada como correcta: ${correctLetter}
Explicación actual: ${question.explanation || 'No disponible'}
${negativeWarning}
## ANÁLISIS REQUERIDO - 2 VARIABLES BOOLEANAS

NOTA: Este es contenido TÉCNICO (informática/ofimática), NO legislación. No existe un "artículo legal" que verificar.

Debes evaluar estas 2 variables de forma INDEPENDIENTE:

1. **answerOk**: ¿La opción marcada como correcta (${correctLetter}) ES realmente la que debería estar marcada?
   ${isNegative ? '- RECUERDA: En preguntas negativas, la correcta es la opción FALSA o técnicamente incorrecta' : '- TRUE: La respuesta marcada es técnicamente correcta'}
   - TRUE: La respuesta marcada es la correcta
   - FALSE: La respuesta marcada es incorrecta, debería ser otra opción

2. **explanationOk**: ¿La explicación es correcta y coherente?
   - TRUE: La explicación es técnicamente correcta y ayuda a entender la respuesta
   - FALSE: La explicación es incorrecta, incompleta o confusa

Responde SOLO en JSON válido (sin texto antes ni después):
{
  "answerOk": true/false,
  "explanationOk": true/false,
  "isNegativeQuestion": ${isNegative},
  "confidence": "alta/media/baja",
  "analysis": "Tu análisis técnico detallado explicando cada decisión${isNegative ? '. Explica por qué la opción marcada es la incorrecta' : ''}",
  "correctOptionShouldBe": "Si answerOk=false, indica cuál debería ser (A/B/C/D)",
  "explanationFix": "Si explanationOk=false, indica qué está mal en la explicación"
}

IMPORTANTE:
- Evalúa cada variable de forma INDEPENDIENTE
- ${isNegative ? 'Esta pregunta pide LA INCORRECTA: verifica que la opción marcada sea realmente la que NO es verdadera' : 'Esta pregunta pide la correcta'}
- Este es contenido TÉCNICO, verifica según conocimientos de informática/ofimática
- Los saltos de línea dentro de strings DEBEN ser \\n (escapados)
- Devuelve SOLO el JSON, sin markdown ni texto adicional`
}

/**
 * Construye el prompt para verificación por tema (leyes normales)
 */
function buildVerificationPrompt({ lawName, articleNumber, articleTitle, articleContent, question }) {
  const correctLetter = ['A', 'B', 'C', 'D'][question.correct_option]
  const isNegative = isNegativeQuestion(question.question_text)

  // Instrucción especial para preguntas negativas
  const negativeWarning = isNegative ? `
⚠️ ATENCIÓN: Esta es una PREGUNTA NEGATIVA (pide "la incorrecta", "la falsa", "la que NO...", etc.)
En este tipo de preguntas:
- La respuesta correcta (${correctLetter}) es la opción que es FALSA o NO aparece en el artículo
- Las otras 3 opciones SÍ son verdaderas según el artículo
- Para que answerOk=true, la opción ${correctLetter} debe ser efectivamente la que NO es correcta según la ley
` : ''

  return `Eres un experto verificador de contenido legal español para oposiciones. Tu tarea es analizar si una pregunta de examen está correctamente configurada.

## ARTÍCULO VINCULADO EN LA BASE DE DATOS
Ley: ${lawName}
Artículo ${articleNumber}: ${articleTitle || ''}

${articleContent}

## PREGUNTA A VERIFICAR
${question.question_text}

A) ${question.option_a}
B) ${question.option_b}
C) ${question.option_c}
D) ${question.option_d}

Respuesta marcada como correcta: ${correctLetter}
Explicación actual: ${question.explanation || 'No disponible'}
${negativeWarning}
## ANÁLISIS REQUERIDO - 3 VARIABLES BOOLEANAS

Debes evaluar estas 3 variables de forma INDEPENDIENTE:

1. **articleOk**: ¿El artículo vinculado contiene la información necesaria para responder la pregunta?
   - TRUE: El artículo permite verificar qué opciones son correctas y cuáles no
   - FALSE: El artículo NO contiene la información, trata otro tema, o está mal vinculado

2. **answerOk**: ¿La opción marcada como correcta (${correctLetter}) ES realmente la que debería estar marcada?
   ${isNegative ? '- RECUERDA: En preguntas negativas, la correcta es la opción FALSA o que NO está en el artículo' : '- TRUE: La respuesta marcada es correcta según el artículo'}
   - TRUE: La respuesta marcada es la correcta
   - FALSE: La respuesta marcada es incorrecta, debería ser otra opción

3. **explanationOk**: ¿La explicación es correcta y coherente?
   - TRUE: La explicación es correcta y ayuda a entender la respuesta
   - FALSE: La explicación es incorrecta, incompleta o confusa

Responde SOLO en JSON válido (sin texto antes ni después):
{
  "articleOk": true/false,
  "answerOk": true/false,
  "explanationOk": true/false,
  "isNegativeQuestion": ${isNegative},
  "confidence": "alta/media/baja",
  "articleQuote": "Cita del artículo que justifica (si articleOk=true)",
  "analysis": "Tu análisis detallado explicando cada decisión${isNegative ? '. Explica por qué la opción marcada es la que NO aparece en el artículo' : ''}",
  "correctArticleSuggestion": "Si articleOk=false, indica qué artículo/ley debería estar vinculado",
  "correctOptionShouldBe": "Si answerOk=false, indica cuál debería ser (A/B/C/D)",
  "explanationFix": "Si explanationOk=false, indica qué está mal en la explicación"
}

IMPORTANTE:
- Evalúa cada variable de forma INDEPENDIENTE
- ${isNegative ? 'Esta pregunta pide LA INCORRECTA: verifica que la opción marcada sea realmente la que NO es verdadera' : 'Esta pregunta pide la correcta'}
- articleOk=false NO implica que answerOk sea false (la respuesta puede ser correcta aunque el artículo esté mal vinculado)
- Los saltos de línea dentro de strings DEBEN ser \\n (escapados)
- Devuelve SOLO el JSON, sin markdown ni texto adicional`
}

/**
 * Verifica con OpenAI
 */
async function verifyWithOpenAI(prompt, apiKey, model) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: 'Eres un experto en derecho administrativo español. Respondes siempre en JSON válido.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.1,
      max_tokens: getMaxOutputTokens(model)
    })
  })

  const data = await response.json()
  if (data.error) throw new Error(data.error.message)

  const content = data.choices?.[0]?.message?.content
  return {
    response: parseJSONResponse(content),
    usage: data.usage
  }
}

/**
 * Verifica con Claude
 */
async function verifyWithClaude(prompt, apiKey, model) {
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
      messages: [{ role: 'user', content: prompt }]
    })
  })

  const data = await response.json()
  if (data.error || data.type === 'error') {
    throw new Error(data.error?.message || data.message || 'Error de Claude')
  }

  const content = data.content?.[0]?.text
  return {
    response: parseJSONResponse(content),
    usage: {
      input_tokens: data.usage?.input_tokens,
      output_tokens: data.usage?.output_tokens,
      total_tokens: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0)
    }
  }
}

/**
 * Verifica con Google Gemini
 */
async function verifyWithGoogle(prompt, apiKey, model) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.1, maxOutputTokens: getMaxOutputTokens(model) }
      })
    }
  )

  const data = await response.json()
  if (data.error) throw new Error(data.error.message)

  const content = data.candidates?.[0]?.content?.parts?.[0]?.text
  return {
    response: parseJSONResponse(content),
    usage: {
      input_tokens: data.usageMetadata?.promptTokenCount || 0,
      output_tokens: data.usageMetadata?.candidatesTokenCount || 0,
      total_tokens: data.usageMetadata?.totalTokenCount || 0
    }
  }
}

/**
 * Parsea respuesta JSON de la IA
 */
function parseJSONResponse(content) {
  if (!content) throw new Error('No se recibió contenido de la IA')

  const jsonMatch = content.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('No se encontró JSON en la respuesta')

  let jsonStr = jsonMatch[0]

  try {
    return JSON.parse(jsonStr)
  } catch (e) {
    // Limpiar caracteres de control
    jsonStr = jsonStr.replace(/"([^"\\]|\\.)*"/g, (match) => {
      return match
        .replace(/\n/g, '\\n')
        .replace(/\r/g, '\\r')
        .replace(/\t/g, '\\t')
        .replace(/[\x00-\x1F\x7F]/g, '')
    })
    return JSON.parse(jsonStr)
  }
}

/**
 * POST /api/topic-review/verify
 * Verifica preguntas seleccionadas con IA
 */
export async function POST(request) {
  try {
    const { questionIds, provider = 'openai', model } = await request.json()

    if (!questionIds || !Array.isArray(questionIds) || questionIds.length === 0) {
      return Response.json({
        success: false,
        error: 'Se requiere un array de questionIds'
      }, { status: 400 })
    }

    // Normalizar provider
    const normalizedProvider = provider === 'claude' ? 'anthropic' : provider

    // Obtener configuración IA
    const aiConfig = await getAIConfig(normalizedProvider)
    if (!aiConfig.apiKey) {
      return Response.json({
        success: false,
        error: `No hay API key configurada para ${normalizedProvider}`
      }, { status: 400 })
    }

    const modelUsed = model || aiConfig.model

    // Obtener preguntas con sus artículos
    // Nota: Las leyes virtuales se detectan por tener "ficticia" en su descripción
    const { data: questions, error: qError } = await supabase
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
        primary_article_id,
        articles!primary_article_id (
          id,
          article_number,
          title,
          content,
          law_id,
          laws (
            id,
            short_name,
            name,
            description
          )
        )
      `)
      .in('id', questionIds)
      .eq('is_active', true)

    if (qError) {
      return Response.json({
        success: false,
        error: 'Error obteniendo preguntas',
        details: qError.message
      }, { status: 500 })
    }

    // Verificar cada pregunta
    const results = []
    const errors = []
    let totalTokens = { input: 0, output: 0, total: 0 }

    // Contadores por estado (leyes normales + leyes virtuales/técnicas + estructural)
    const statusCounts = {
      // Estados para leyes normales
      perfect: 0,
      bad_explanation: 0,
      bad_answer: 0,
      bad_answer_and_explanation: 0,
      wrong_article: 0,
      wrong_article_bad_explanation: 0,
      wrong_article_bad_answer: 0,
      all_wrong: 0,
      // Estados para leyes virtuales/técnicas
      tech_perfect: 0,
      tech_bad_explanation: 0,
      tech_bad_answer: 0,
      tech_bad_answer_and_explanation: 0,
      // Estados estructurales (sin necesidad de IA)
      invalid_structure: 0
    }

    for (const question of questions) {
      try {
        // === VALIDACIÓN ESTRUCTURAL (sin IA) ===
        // Verificar que todas las opciones tienen contenido
        const emptyOptions = []
        if (!question.option_a?.trim()) emptyOptions.push('A')
        if (!question.option_b?.trim()) emptyOptions.push('B')
        if (!question.option_c?.trim()) emptyOptions.push('C')
        if (!question.option_d?.trim()) emptyOptions.push('D')

        if (emptyOptions.length > 0) {
          // Marcar como estructura inválida y saltar verificación IA
          await supabase
            .from('questions')
            .update({
              verified_at: new Date().toISOString(),
              verification_status: 'problem',
              topic_review_status: 'invalid_structure'
            })
            .eq('id', question.id)

          statusCounts.invalid_structure++
          results.push({
            questionId: question.id,
            questionText: question.question_text?.substring(0, 80) + '...',
            topicReviewStatus: 'invalid_structure',
            structuralIssue: `Opciones vacías: ${emptyOptions.join(', ')}`,
            emptyOptions
          })
          continue
        }

        // Verificar que el texto de la pregunta existe
        if (!question.question_text?.trim()) {
          await supabase
            .from('questions')
            .update({
              verified_at: new Date().toISOString(),
              verification_status: 'problem',
              topic_review_status: 'invalid_structure'
            })
            .eq('id', question.id)

          statusCounts.invalid_structure++
          results.push({
            questionId: question.id,
            questionText: '(sin texto)',
            topicReviewStatus: 'invalid_structure',
            structuralIssue: 'Texto de pregunta vacío'
          })
          continue
        }

        // Verificar que correct_option es válido (0-3)
        if (question.correct_option === null || question.correct_option === undefined ||
            question.correct_option < 0 || question.correct_option > 3) {
          await supabase
            .from('questions')
            .update({
              verified_at: new Date().toISOString(),
              verification_status: 'problem',
              topic_review_status: 'invalid_structure'
            })
            .eq('id', question.id)

          statusCounts.invalid_structure++
          results.push({
            questionId: question.id,
            questionText: question.question_text?.substring(0, 80) + '...',
            topicReviewStatus: 'invalid_structure',
            structuralIssue: `correct_option inválido: ${question.correct_option}`
          })
          continue
        }

        // === FIN VALIDACIÓN ESTRUCTURAL ===

        const article = question.articles
        if (!article) {
          errors.push({
            questionId: question.id,
            error: 'No hay artículo vinculado'
          })
          continue
        }

        // Detectar si es ley virtual/técnica (tienen "ficticia" en la descripción)
        const isVirtual = article.laws?.description?.toLowerCase().includes('ficticia') || false

        // Construir prompt según tipo de ley
        let prompt
        if (isVirtual) {
          // Ley virtual: solo verificar answerOk y explanationOk
          prompt = buildTechnicalVerificationPrompt({
            topicName: article.laws?.name || article.laws?.short_name,
            contentTitle: article.title,
            contentText: article.content,
            question
          })
        } else {
          // Ley normal: verificar las 3 variables
          const lawName = `${article.laws?.short_name} - ${article.laws?.name}`
          prompt = buildVerificationPrompt({
            lawName,
            articleNumber: article.article_number,
            articleTitle: article.title,
            articleContent: article.content,
            question
          })
        }

        // Llamar a la IA
        let aiResponse, usage
        if (normalizedProvider === 'anthropic') {
          const result = await verifyWithClaude(prompt, aiConfig.apiKey, modelUsed)
          aiResponse = result.response
          usage = result.usage
        } else if (normalizedProvider === 'google') {
          const result = await verifyWithGoogle(prompt, aiConfig.apiKey, modelUsed)
          aiResponse = result.response
          usage = result.usage
        } else {
          const result = await verifyWithOpenAI(prompt, aiConfig.apiKey, modelUsed)
          aiResponse = result.response
          usage = result.usage
        }

        // Acumular tokens
        totalTokens.input += usage?.input_tokens || usage?.prompt_tokens || 0
        totalTokens.output += usage?.output_tokens || usage?.completion_tokens || 0
        totalTokens.total += usage?.total_tokens || 0

        // Para leyes virtuales, articleOk es null (no aplica)
        const articleOkValue = isVirtual ? null : (aiResponse.articleOk === true)

        // Determinar estado de revisión basándose en las variables
        const topicReviewStatus = determineReviewStatus(
          articleOkValue,
          aiResponse.answerOk === true,
          aiResponse.explanationOk === true,
          isVirtual
        )

        // Incrementar contador
        if (statusCounts[topicReviewStatus] !== undefined) {
          statusCounts[topicReviewStatus]++
        }

        // Guardar en ai_verification_results
        await supabase
          .from('ai_verification_results')
          .upsert({
            question_id: question.id,
            article_id: article.id,
            law_id: article.law_id,
            article_ok: articleOkValue, // null para leyes virtuales
            answer_ok: aiResponse.answerOk,
            explanation_ok: aiResponse.explanationOk,
            confidence: aiResponse.confidence,
            explanation: aiResponse.analysis,
            article_quote: isVirtual ? null : aiResponse.articleQuote,
            correct_article_suggestion: isVirtual ? null : aiResponse.correctArticleSuggestion,
            correct_option_should_be: aiResponse.correctOptionShouldBe,
            explanation_fix: aiResponse.explanationFix,
            ai_provider: normalizedProvider,
            ai_model: modelUsed,
            verified_at: new Date().toISOString()
          }, {
            onConflict: 'question_id,ai_provider'
          })

        // Actualizar pregunta
        const isPerfect = topicReviewStatus === 'perfect' || topicReviewStatus === 'tech_perfect'
        await supabase
          .from('questions')
          .update({
            verified_at: new Date().toISOString(),
            verification_status: isPerfect ? 'ok' : 'problem',
            topic_review_status: topicReviewStatus
          })
          .eq('id', question.id)

        // Guardar uso de tokens
        await supabase.from('ai_api_usage').insert({
          provider: normalizedProvider,
          model: modelUsed,
          endpoint: 'topic-review-verify',
          input_tokens: usage?.input_tokens || usage?.prompt_tokens,
          output_tokens: usage?.output_tokens || usage?.completion_tokens,
          total_tokens: usage?.total_tokens,
          feature: 'topic_review_verification',
          questions_count: 1
        })

        results.push({
          questionId: question.id,
          questionText: question.question_text.substring(0, 80) + '...',
          isVirtual, // Indica si es ley virtual/técnica
          articleOk: articleOkValue, // null para leyes virtuales
          answerOk: aiResponse.answerOk,
          explanationOk: aiResponse.explanationOk,
          topicReviewStatus,
          confidence: aiResponse.confidence,
          analysis: aiResponse.analysis,
          articleQuote: isVirtual ? null : aiResponse.articleQuote,
          correctArticleSuggestion: isVirtual ? null : aiResponse.correctArticleSuggestion,
          correctOptionShouldBe: aiResponse.correctOptionShouldBe,
          explanationFix: aiResponse.explanationFix
        })

        // Pequeña pausa entre llamadas para evitar rate limits
        await new Promise(resolve => setTimeout(resolve, 300))

      } catch (err) {
        console.error(`Error verificando pregunta ${question.id}:`, err)
        errors.push({
          questionId: question.id,
          error: err.message
        })
      }
    }

    return Response.json({
      success: true,
      results,
      errors: errors.length > 0 ? errors : undefined,
      summary: {
        total: questionIds.length,
        verified: results.length,
        failed: errors.length,
        ...statusCounts
      },
      tokenUsage: totalTokens,
      provider: normalizedProvider,
      model: modelUsed,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Error en topic-review/verify:', error)
    return Response.json({
      success: false,
      error: 'Error interno del servidor',
      details: error.message
    }, { status: 500 })
  }
}
