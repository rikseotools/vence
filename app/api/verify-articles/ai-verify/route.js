import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

/**
 * POST /api/verify-articles/ai-verify
 * Verifica una pregunta contra el contenido real del BOE usando IA
 */
export async function POST(request) {
  try {
    const { lawId, articleNumber, questionId, provider = 'openai' } = await request.json()

    if (!lawId || !articleNumber || !questionId) {
      return Response.json({
        success: false,
        error: 'Se requiere lawId, articleNumber y questionId'
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

    // 2. Obtener la pregunta
    const { data: question, error: questionError } = await supabase
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
      .eq('id', questionId)
      .single()

    if (questionError || !question) {
      return Response.json({
        success: false,
        error: 'Pregunta no encontrada'
      }, { status: 404 })
    }

    // 3. Obtener el contenido del artículo del BOE
    const boeContent = await fetchArticleFromBOE(law.boe_url, articleNumber)

    if (!boeContent) {
      return Response.json({
        success: false,
        error: `No se pudo obtener el contenido del artículo ${articleNumber} del BOE`
      }, { status: 500 })
    }

    // 4. Construir el prompt para la IA
    const correctOptionLetter = ['A', 'B', 'C', 'D'][question.correct_option]
    const correctAnswer = question[`option_${correctOptionLetter.toLowerCase()}`]

    const prompt = buildVerificationPrompt({
      lawName: `${law.short_name} - ${law.name}`,
      articleNumber,
      articleContent: boeContent,
      questionText: question.question_text,
      options: {
        a: question.option_a,
        b: question.option_b,
        c: question.option_c,
        d: question.option_d
      },
      correctOption: correctOptionLetter,
      correctAnswer,
      explanation: question.explanation
    })

    // 5. Llamar a la IA según el provider
    let aiResponse
    if (provider === 'claude') {
      aiResponse = await verifyWithClaude(prompt)
    } else {
      aiResponse = await verifyWithOpenAI(prompt)
    }

    return Response.json({
      success: true,
      result: aiResponse,
      metadata: {
        provider,
        lawId,
        articleNumber,
        questionId,
        timestamp: new Date().toISOString()
      }
    })

  } catch (error) {
    console.error('Error en verificación IA:', error)
    return Response.json({
      success: false,
      error: 'Error interno del servidor',
      details: error.message
    }, { status: 500 })
  }
}

/**
 * Extrae el contenido de un artículo específico del BOE
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

    // Buscar el artículo específico
    // Estructura: <div class="bloque" id="aX">...</div>
    const articleRegex = new RegExp(
      `<div[^>]*id="a${articleNumber}"[^>]*>[\\s\\S]*?<h5[^>]*class="articulo"[^>]*>([\\s\\S]*?)</h5>([\\s\\S]*?)(?=<div[^>]*class="bloque"|<p[^>]*class="linkSubir"|$)`,
      'i'
    )

    const match = html.match(articleRegex)

    if (match) {
      const title = match[1].replace(/<[^>]*>/g, '').trim()
      let content = match[2]
        .replace(/<p[^>]*class="bloque"[^>]*>.*?<\/p>/gi, '') // Quitar [Bloque X: #aX]
        // Preservar estructura de párrafos
        .replace(/<\/p>/gi, '\n\n') // Fin de párrafo = doble salto
        .replace(/<br\s*\/?>/gi, '\n') // Salto de línea
        .replace(/<\/li>/gi, '\n') // Fin de item de lista
        .replace(/<\/div>/gi, '\n') // Fin de div
        .replace(/<[^>]*>/g, '') // Quitar resto de tags HTML
        .replace(/\n{3,}/g, '\n\n') // Máximo 2 saltos seguidos
        .replace(/[ \t]+/g, ' ') // Normalizar espacios horizontales
        .replace(/^ +| +$/gm, '') // Quitar espacios al inicio/fin de cada línea
        .trim()

      return `${title}\n\n${content}`
    }

    return null
  } catch (error) {
    console.error('Error fetching BOE article:', error)
    return null
  }
}

/**
 * Construye el prompt de verificación
 */
function buildVerificationPrompt({ lawName, articleNumber, articleContent, questionText, options, correctOption, correctAnswer, explanation }) {
  return `Eres un experto en derecho administrativo español. Tu tarea es verificar si una pregunta de examen de oposiciones es correcta basándote en el contenido LITERAL del artículo de la ley.

## ARTÍCULO OFICIAL DEL BOE
Ley: ${lawName}
Artículo ${articleNumber}:
${articleContent}

## PREGUNTA A VERIFICAR
${questionText}

A) ${options.a}
B) ${options.b}
C) ${options.c}
D) ${options.d}

Respuesta marcada como correcta: ${correctOption}) ${correctAnswer}

## EXPLICACIÓN ACTUAL
${explanation || 'No hay explicación disponible'}

## TU ANÁLISIS
Analiza si:
1. La respuesta marcada como correcta (${correctOption}) es realmente correcta según el artículo LITERAL del BOE
2. Las otras opciones son claramente incorrectas
3. La explicación es correcta y didáctica

Responde en formato JSON exactamente así:
{
  "isCorrect": true/false,
  "confidence": "alta/media/baja",
  "explanation": "Explicación breve de tu análisis",
  "articleQuote": "Cita literal del artículo que justifica la respuesta",
  "suggestedFix": "Si hay error, sugiere la corrección. Si está bien, null",
  "correctOptionShouldBe": "A/B/C/D o null si está bien"
}`
}

/**
 * Verifica con OpenAI (GPT)
 */
async function verifyWithOpenAI(prompt) {
  const apiKey = process.env.OPENAI_API_KEY

  if (!apiKey) {
    return {
      error: 'OpenAI API key no configurada. Añade OPENAI_API_KEY en .env.local'
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
        model: 'gpt-4o-mini',
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
        max_tokens: 1000
      })
    })

    const data = await response.json()

    if (data.error) {
      return { error: data.error.message }
    }

    const content = data.choices?.[0]?.message?.content

    try {
      // Intentar parsear JSON de la respuesta
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0])
      }
    } catch (e) {
      // Si no es JSON válido, devolver como texto
      return {
        isCorrect: null,
        explanation: content,
        error: 'No se pudo parsear la respuesta como JSON'
      }
    }

    return { explanation: content }
  } catch (error) {
    return { error: error.message }
  }
}

/**
 * Verifica con Claude (Anthropic)
 */
async function verifyWithClaude(prompt) {
  const apiKey = process.env.ANTHROPIC_API_KEY

  if (!apiKey) {
    return {
      error: 'Anthropic API key no configurada. Añade ANTHROPIC_API_KEY en .env.local'
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
        model: 'claude-3-haiku-20240307',
        max_tokens: 1000,
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
      return { error: data.error.message }
    }

    const content = data.content?.[0]?.text

    try {
      // Intentar parsear JSON de la respuesta
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0])
      }
    } catch (e) {
      return {
        isCorrect: null,
        explanation: content,
        error: 'No se pudo parsear la respuesta como JSON'
      }
    }

    return { explanation: content }
  } catch (error) {
    return { error: error.message }
  }
}
