import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const EMBEDDING_MODEL = 'text-embedding-3-small'

// Guardar log de interacción del chat (devuelve el ID del log)
async function logChatInteraction(logData) {
  try {
    const { data, error } = await supabase
      .from('ai_chat_logs')
      .insert({
        user_id: logData.userId || null,
        message: logData.message,
        response_preview: logData.response?.substring(0, 500) || null,
        full_response: logData.response || null,
        sources_used: logData.sources || [],
        question_context_id: logData.questionContextId || null,
        question_context_law: logData.questionContextLaw || null,
        suggestion_used: logData.suggestionUsed || null,
        response_time_ms: logData.responseTimeMs || null,
        tokens_used: logData.tokensUsed || null,
        had_error: logData.hadError || false,
        error_message: logData.errorMessage || null,
        user_oposicion: logData.userOposicion || null,
        detected_laws: logData.detectedLaws || []
      })
      .select('id')
      .single()

    if (error) {
      console.error('Error guardando log de chat:', error)
      return null
    }
    return data?.id || null
  } catch (err) {
    // No fallar la petición por errores de logging
    console.error('Error en logChatInteraction:', err)
    return null
  }
}

// Mapeo de oposición del usuario a position_type de topics
const OPOSICION_TO_POSITION_TYPE = {
  'auxiliar_administrativo_estado': 'auxiliar_administrativo',
  'administrativo_estado': 'administrativo',
  'gestion_procesal': 'gestion_procesal'
}

// Obtener IDs de leyes relevantes para una oposición desde topic_scope
async function getOposicionLawIds(userOposicion) {
  if (!userOposicion) return []

  const positionType = OPOSICION_TO_POSITION_TYPE[userOposicion]
  if (!positionType) return []

  // Obtener todos los topics de esta oposición
  const { data: topics } = await supabase
    .from('topics')
    .select('id')
    .eq('position_type', positionType)

  if (!topics || topics.length === 0) return []

  const topicIds = topics.map(t => t.id)

  // Obtener las leyes de estos topics desde topic_scope
  const { data: scopes } = await supabase
    .from('topic_scope')
    .select('law_id')
    .in('topic_id', topicIds)

  if (!scopes || scopes.length === 0) return []

  // Retornar IDs únicos de leyes
  return [...new Set(scopes.map(s => s.law_id))]
}

// Obtener API key de OpenAI de la configuración
async function getOpenAIKey() {
  const { data } = await supabase
    .from('ai_api_config')
    .select('api_key_encrypted')
    .eq('provider', 'openai')
    .eq('is_active', true)
    .single()

  if (!data?.api_key_encrypted) {
    return null
  }

  return Buffer.from(data.api_key_encrypted, 'base64').toString('utf-8')
}

// Generar embedding para la pregunta del usuario
async function generateEmbedding(openai, text) {
  const response = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: text.substring(0, 8000), // Límite seguro
  })
  return response.data[0].embedding
}

// Detectar menciones de leyes específicas en el mensaje del usuario
function detectMentionedLaws(message) {
  const msgLower = message.toLowerCase()
  const mentionedLaws = []

  // Ley 39/2015, LPAC
  if (/ley\s*39|39\/2015|lpac/.test(msgLower)) {
    mentionedLaws.push('Ley 39/2015')
  }

  // Ley 40/2015, LRJSP
  if (/ley\s*40|40\/2015|lrjsp/.test(msgLower)) {
    mentionedLaws.push('Ley 40/2015')
  }

  // Constitución Española
  if (/constituci[oó]n|c\.e\.|ce\b/.test(msgLower)) {
    mentionedLaws.push('CE')
  }

  // TREBEP / EBEP
  if (/trebep|ebep|estatuto\s*b[aá]sico/.test(msgLower)) {
    mentionedLaws.push('TREBEP')
  }

  // LGT
  if (/ley\s*general\s*tributaria|l\.g\.t|lgt\b/.test(msgLower)) {
    mentionedLaws.push('LGT')
  }

  return mentionedLaws
}

// Buscar artículos por similitud semántica (solo leyes vigentes)
// priorityLawIds: IDs de leyes de la oposición del usuario para priorizar
// mentionedLawNames: nombres de leyes mencionadas explícitamente en la pregunta
async function searchArticlesBySimilarity(embedding, limit = 10, priorityLawIds = [], mentionedLawNames = []) {
  // Pedir más resultados para compensar los que filtremos y para poder priorizar
  const { data: articles, error } = await supabase.rpc('match_articles', {
    query_embedding: embedding,
    match_threshold: 0.25,
    match_count: limit * 4 // Pedir más para filtrar y priorizar
  })

  if (error) {
    console.error('Error en match_articles:', error)
    return []
  }

  if (!articles || articles.length === 0) {
    return []
  }

  // Obtener info de las leyes incluyendo is_derogated
  const lawIds = [...new Set(articles.map(a => a.law_id))]
  const { data: laws } = await supabase
    .from('laws')
    .select('id, short_name, name, is_derogated')
    .in('id', lawIds)

  const lawMap = {}
  laws?.forEach(l => lawMap[l.id] = l)

  // Filtrar artículos de leyes derogadas
  let validArticles = articles.filter(a => {
    const law = lawMap[a.law_id]
    if (law?.is_derogated) {
      console.log(`🚫 Excluido artículo de ley derogada: ${law.short_name || law.name}`)
      return false
    }
    return true
  })

  // 🎯 PRIORIDAD MÁXIMA: Si el usuario mencionó leyes específicas, filtrar SOLO esas
  if (mentionedLawNames.length > 0) {
    const mentionedArticles = validArticles.filter(a => {
      const law = lawMap[a.law_id]
      return mentionedLawNames.includes(law?.short_name)
    })

    if (mentionedArticles.length > 0) {
      console.log(`📚 Filtrando por leyes mencionadas: ${mentionedLawNames.join(', ')} → ${mentionedArticles.length} artículos`)
      validArticles = mentionedArticles
    } else {
      console.log(`⚠️ No se encontraron artículos de las leyes mencionadas: ${mentionedLawNames.join(', ')}`)
    }
  }

  // Si hay leyes prioritarias (de la oposición), reordenar
  let finalArticles = validArticles
  if (priorityLawIds.length > 0 && mentionedLawNames.length === 0) {
    // Solo aplicar priorización por oposición si NO hay leyes mencionadas explícitamente
    const prioritySet = new Set(priorityLawIds)
    const priorityArticles = validArticles.filter(a => prioritySet.has(a.law_id))
    const otherArticles = validArticles.filter(a => !prioritySet.has(a.law_id))

    // Mezclar: priorizar los de la oposición pero mantener algunos del resto por diversidad
    const numPriority = Math.min(priorityArticles.length, Math.ceil(limit * 0.7)) // 70% de oposición
    const numOther = limit - numPriority

    finalArticles = [
      ...priorityArticles.slice(0, numPriority),
      ...otherArticles.slice(0, numOther)
    ]

    if (priorityArticles.length > 0) {
      console.log(`🎯 Priorizando ${numPriority} artículos de leyes de la oposición`)
    }
  }

  return finalArticles
    .slice(0, limit)
    .map(a => ({
      ...a,
      law: lawMap[a.law_id] || null
    }))
}

// Fallback: búsqueda por keywords si no hay embeddings (solo leyes vigentes)
async function searchArticlesByKeywords(question, limit = 10) {
  const stopwords = new Set([
    'el', 'la', 'los', 'las', 'un', 'una', 'de', 'del', 'al',
    'y', 'o', 'que', 'en', 'a', 'por', 'para', 'con', 'sin',
    'es', 'son', 'qué', 'cómo', 'cuál', 'me', 'te', 'se'
  ])

  const keywords = question
    .toLowerCase()
    .replace(/[^\w\sáéíóúüñ]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !stopwords.has(w))
    .slice(0, 5)

  if (keywords.length === 0) return []

  const orConditions = keywords.map(term =>
    `title.ilike.%${term}%,content.ilike.%${term}%`
  ).join(',')

  // Pedir más para filtrar leyes derogadas
  const { data: articles } = await supabase
    .from('articles')
    .select(`
      id,
      article_number,
      title,
      content,
      law_id,
      law:laws(short_name, name, is_derogated)
    `)
    .eq('is_active', true)
    .or(orConditions)
    .limit(limit * 3)

  // Filtrar leyes derogadas
  const filtered = (articles || [])
    .filter(a => !a.law?.is_derogated)
    .slice(0, limit)

  return filtered
}

// Formatear artículos como contexto
function formatContext(articles) {
  if (articles.length === 0) {
    return 'No se encontraron artículos específicos relacionados con tu pregunta.'
  }

  return articles.map(art => {
    const lawName = art.law?.short_name || art.law?.name || 'Normativa'
    const artNum = art.article_number ? `Art. ${art.article_number}` : ''
    const header = `[${lawName} ${artNum}]`.trim()
    const similarity = art.similarity ? ` (relevancia: ${Math.round(art.similarity * 100)}%)` : ''

    let content = art.content || ''
    if (content.length > 1500) {
      content = content.substring(0, 1500) + '...'
    }

    return `${header}${similarity}\n${art.title || ''}\n${content}`
  }).join('\n\n---\n\n')
}

// Generar el system prompt
function generateSystemPrompt(context, questionContextText, userOposicion) {
  const oposicionInfo = userOposicion
    ? `El usuario está preparando la oposición de ${userOposicion.replace(/_/g, ' ')}.`
    : ''

  return `Eres el asistente de IA de Vence, una plataforma de preparación para oposiciones en España.

SOBRE TI:
- Tienes acceso a una base de datos con 176 leyes y 21.000+ artículos de legislación española actualizada
- Tu conocimiento proviene de esta base de datos, NO de un entrenamiento genérico
- Cuando el usuario pregunta, buscas en la base de datos los artículos más relevantes
${oposicionInfo}

ESTILO DE INTERACCIÓN:
- Sé conversacional y cercano, como un tutor de oposiciones
- Si la pregunta es ambigua o muy general, PREGUNTA para clarificar antes de responder
  Ejemplo: "¿Te refieres a los plazos de cómputo (días hábiles/naturales), los plazos máximos para resolver, o el silencio administrativo?"
- Si hay varios temas relacionados, ofrece opciones al usuario
- No des respuestas largas si el usuario no ha especificado qué necesita exactamente

INSTRUCCIONES:
- Responde de forma concisa pero completa
- Cita SIEMPRE los artículos específicos del contexto (ej: "Según el Art. 14 de la CE...")
- Basa tus respuestas ÚNICAMENTE en el contexto proporcionado abajo
- Si el contexto no contiene información relevante, pregunta al usuario si puede reformular o ser más específico
- NO inventes información ni uses conocimiento externo
- Si preguntan sobre ti, explica que eres el asistente de Vence con acceso a 176 leyes españolas
- Si la pregunta no está relacionada con oposiciones o legislación, indica educadamente que solo puedes ayudar con esos temas
- NUNCA generes tests, cuestionarios o preguntas de examen directamente. Si el usuario pide un test, dile que puede usar el botón "¿Te preparo un test?" que aparece debajo de cada respuesta para crear un test real con seguimiento de progreso
${questionContextText}
CONTEXTO (artículos relevantes encontrados en la base de datos):
${context}`
}

// Generar sugerencias de seguimiento basadas en la respuesta
function generateFollowUpSuggestions(sources, response, questionContext) {
  // Obtener las leyes únicas mencionadas en las fuentes
  const lawsInSources = [...new Set(sources.map(s => s.law).filter(Boolean))]

  // Si hay leyes, ofrecer preparar test
  if (lawsInSources.length > 0) {
    return {
      offerTest: true,
      laws: lawsInSources
    }
  }

  return { offerTest: false, laws: [] }
}

export async function POST(request) {
  const startTime = Date.now()

  try {
    const {
      message,
      history = [],
      questionContext = null,
      userOposicion = null,
      stream = false,
      userId = null,
      suggestionUsed = null
    } = await request.json()

    if (!message || typeof message !== 'string') {
      return Response.json({
        success: false,
        error: 'Se requiere un mensaje'
      }, { status: 400 })
    }

    // Obtener API key
    const apiKey = await getOpenAIKey()
    if (!apiKey) {
      return Response.json({
        success: false,
        error: 'La IA no está configurada. Un administrador debe configurar la API key de OpenAI en /admin/ai'
      }, { status: 503 })
    }

    const openai = new OpenAI({ apiKey })

    // Obtener leyes prioritarias de la oposición del usuario
    const priorityLawIds = await getOposicionLawIds(userOposicion)
    if (priorityLawIds.length > 0) {
      console.log(`📚 Usuario con oposición ${userOposicion}: ${priorityLawIds.length} leyes prioritarias`)
    }

    // 🎯 Detectar menciones de leyes específicas en el mensaje
    const mentionedLaws = detectMentionedLaws(message)
    if (mentionedLaws.length > 0) {
      console.log(`🔍 Leyes mencionadas en la pregunta: ${mentionedLaws.join(', ')}`)
    }

    // Intentar búsqueda semántica con embeddings
    let articles = []
    let searchMethod = 'keywords'

    try {
      const embedding = await generateEmbedding(openai, message)
      articles = await searchArticlesBySimilarity(embedding, 10, priorityLawIds, mentionedLaws)

      if (articles.length > 0) {
        searchMethod = 'semantic'
      }
    } catch (embeddingError) {
      console.log('Embeddings no disponibles, usando keywords:', embeddingError.message)
    }

    // Fallback a keywords si no hay resultados con embeddings
    if (articles.length === 0) {
      articles = await searchArticlesByKeywords(message)
      searchMethod = 'keywords'
    }

    const context = formatContext(articles)

    // Formatear contexto de pregunta si existe
    let questionContextText = ''
    if (questionContext) {
      const options = questionContext.options
      // Obtener letra correcta (puede venir como 1,2,3,4 o a,b,c,d o A,B,C,D)
      let correctLetter = '?'
      let correctText = ''
      const rawCorrect = questionContext.correctAnswer

      if (rawCorrect !== null && rawCorrect !== undefined) {
        // IMPORTANTE: La BD usa 0-indexed (0=A, 1=B, 2=C, 3=D)
        // Pero el QuestionContext ya convierte a letra, así que puede llegar como 'A', 'B', 'C', 'D'
        const num = parseInt(rawCorrect, 10)
        if (!isNaN(num) && num >= 0 && num <= 3) {
          // Es número 0-indexed
          correctLetter = ['A', 'B', 'C', 'D'][num]
        } else if (typeof rawCorrect === 'string' && /^[a-dA-D]$/.test(rawCorrect)) {
          // Ya es letra
          correctLetter = rawCorrect.toUpperCase()
        } else {
          correctLetter = String(rawCorrect).toUpperCase()
        }

        // Obtener el texto de la opción correcta
        const optionKey = correctLetter.toLowerCase()
        correctText = options?.[optionKey] || ''
      }


      questionContextText = `

PREGUNTA DE TEST ACTUAL:
El usuario está viendo esta pregunta en un test:

Pregunta: ${questionContext.questionText || 'Sin texto'}

Opciones:
A) ${options?.a || 'Sin opción'}
B) ${options?.b || 'Sin opción'}
C) ${options?.c || 'Sin opción'}
D) ${options?.d || 'Sin opción'}

⭐ RESPUESTA CORRECTA: ${correctLetter}) ${correctText}
${questionContext.explanation ? `Explicación oficial: ${questionContext.explanation}` : ''}
${questionContext.lawName ? `Ley: ${questionContext.lawName}` : ''}
${questionContext.articleNumber ? `Artículo: ${questionContext.articleNumber}` : ''}

INSTRUCCIONES ESPECIALES PARA PREGUNTAS DE TEST:
- IMPORTANTE: La respuesta correcta es "${correctLetter}" (${correctText}). NO cambies esta respuesta.
- Cuando expliques la pregunta, di siempre "La respuesta correcta es ${correctLetter}) ${correctText}"
- Explica POR QUÉ esta respuesta es correcta basándote en la legislación
- Si detectas un posible ERROR en la pregunta, indícalo con "⚠️ POSIBLE ERROR DETECTADO:"
- Verifica la información con los artículos de la base de datos
`
    }

    // Preparar mensajes para OpenAI
    const systemPrompt = generateSystemPrompt(context, questionContextText, userOposicion)

    const messages = [
      { role: 'system', content: systemPrompt },
      ...history.slice(-6).map(h => ({
        role: h.role,
        content: h.content
      })),
      { role: 'user', content: message }
    ]

    // Preparar sources para enviar
    const sources = articles.map(a => ({
      law: a.law?.short_name || a.law?.name,
      article: a.article_number,
      title: a.title,
      similarity: a.similarity ? Math.round(a.similarity * 100) : null
    }))

    // Si se solicita streaming
    if (stream) {
      const encoder = new TextEncoder()

      const streamResponse = new ReadableStream({
        async start(controller) {
          try {
            // Enviar metadata primero
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'meta', sources, searchMethod })}\n\n`))

            // Crear stream de OpenAI
            const completion = await openai.chat.completions.create({
              model: 'gpt-4o-mini',
              messages,
              max_tokens: 1000,
              temperature: 0.7,
              stream: true
            })

            let fullResponse = ''

            for await (const chunk of completion) {
              const content = chunk.choices[0]?.delta?.content || ''
              if (content) {
                fullResponse += content
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'content', content })}\n\n`))
              }
            }

            // Detectar si la IA encontró un error en la pregunta
            const potentialErrorDetected = fullResponse.includes('POSIBLE ERROR DETECTADO') ||
                                            fullResponse.includes('⚠️')

            // Generar sugerencias de seguimiento basadas en las fuentes
            const suggestions = generateFollowUpSuggestions(sources, fullResponse, questionContext)

            // Enviar evento de finalización con sugerencias
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({
              type: 'done',
              potentialErrorDetected,
              questionId: questionContext?.id || null,
              suggestions
            })}\n\n`))

            // Loguear interacción exitosa
            const responseTime = Date.now() - startTime
            const logId = await logChatInteraction({
              userId,
              message,
              response: fullResponse,
              sources,
              questionContextId: questionContext?.id,
              questionContextLaw: questionContext?.lawName,
              suggestionUsed,
              responseTimeMs: responseTime,
              hadError: false,
              userOposicion,
              detectedLaws: mentionedLaws
            })

            // Enviar logId para feedback
            if (logId) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'logId', logId })}\n\n`))
            }

            controller.close()
          } catch (error) {
            console.error('Error en streaming:', error)
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`))

            // Loguear error
            const responseTime = Date.now() - startTime
            logChatInteraction({
              userId,
              message,
              sources,
              questionContextId: questionContext?.id,
              questionContextLaw: questionContext?.lawName,
              suggestionUsed,
              responseTimeMs: responseTime,
              hadError: true,
              errorMessage: error.message,
              userOposicion,
              detectedLaws: mentionedLaws
            })

            controller.close()
          }
        }
      })

      return new Response(streamResponse, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      })
    }

    // Sin streaming (modo normal)
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages,
      max_tokens: 1000,
      temperature: 0.7
    })

    const response = completion.choices[0]?.message?.content || 'No pude generar una respuesta.'

    // Detectar si la IA encontró un error en la pregunta
    const potentialErrorDetected = response.includes('POSIBLE ERROR DETECTADO') ||
                                    response.includes('⚠️')

    // Generar sugerencias de seguimiento
    const suggestions = generateFollowUpSuggestions(sources, response, questionContext)

    // Loguear interacción exitosa
    const responseTime = Date.now() - startTime
    logChatInteraction({
      userId,
      message,
      response,
      sources,
      questionContextId: questionContext?.id,
      questionContextLaw: questionContext?.lawName,
      suggestionUsed,
      responseTimeMs: responseTime,
      tokensUsed: completion.usage?.total_tokens,
      hadError: false,
      userOposicion,
      detectedLaws: mentionedLaws
    })

    // Retornar respuesta con artículos citados
    return Response.json({
      success: true,
      response,
      searchMethod,
      hasQuestionContext: !!questionContext,
      potentialErrorDetected,
      questionId: questionContext?.id || null,
      sources,
      suggestions
    })

  } catch (error) {
    console.error('Error en chat IA:', error)

    // Loguear error general
    const responseTime = Date.now() - startTime
    const body = await request.clone().json().catch(() => ({}))
    logChatInteraction({
      userId: body.userId,
      message: body.message || 'unknown',
      responseTimeMs: responseTime,
      hadError: true,
      errorMessage: error.message,
      userOposicion: body.userOposicion,
      detectedLaws: []
    })

    if (error.code === 'insufficient_quota') {
      return Response.json({
        success: false,
        error: 'Se ha agotado el crédito de la API de OpenAI'
      }, { status: 503 })
    }

    if (error.code === 'invalid_api_key') {
      return Response.json({
        success: false,
        error: 'La API key de OpenAI no es válida'
      }, { status: 503 })
    }

    return Response.json({
      success: false,
      error: 'Error procesando tu pregunta. Inténtalo de nuevo.'
    }, { status: 500 })
  }
}
