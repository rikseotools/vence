// lib/chat/domains/search/SearchDomain.ts
// Dominio de búsqueda de artículos para el chat

import type { ChatDomain, ChatContext, ChatResponse, ArticleSource, AITracerInterface } from '../../core/types'
import { ChatResponseBuilder } from '../../core/ChatResponseBuilder'
import { getOpenAI, CHAT_MODEL, CHAT_MODEL_PREMIUM } from '../../shared/openai'
import { logger } from '../../shared/logger'
import { DOMAIN_PRIORITIES } from '../../core/types'
import {
  searchArticles,
  formatArticlesForContext,
  wantsLiteralContent,
  generateSearchSuggestions,
  detectMentionedLaws,
  isGenericLawQuery,
} from './ArticleSearchService'
import { detectQueryPattern } from './PatternMatcher'
import { detectLawsFromText, getHotArticlesByOposicion, formatHotArticlesResponse, hasQuestionsForArticle, extractArticleNumbers, getSupabaseForSearch } from './queries'
import { isPsychometricSubtype } from '../../shared/constants'
import { detectStatsQueryType } from '../stats/StatsService'

// ============================================
// LEYES VIRTUALES (INFORMÁTICA/OFIMÁTICA)
// Estas "leyes" son contenido técnico, no legislación real
// ============================================
const VIRTUAL_LAWS = [
  'Base de datos: Access',
  'Correo electrónico',
  'Explorador Windows 11',
  'Hojas de cálculo. Excel',
  'Informática Básica',
  'La Red Internet',
  'Portal de Internet',
  'Procesadores de texto',
  'Windows 11',
]

function isVirtualLaw(lawName: string | undefined): boolean {
  if (!lawName) return false
  return VIRTUAL_LAWS.some(vl =>
    lawName.toLowerCase().includes(vl.toLowerCase())
  )
}

// ============================================
// DOMINIO DE BÚSQUEDA
// ============================================

export class SearchDomain implements ChatDomain {
  name = 'search'
  priority = DOMAIN_PRIORITIES.SEARCH

  /**
   * Detecta si es una pregunta psicotécnica
   */
  private isPsychometricQuestion(context: ChatContext): boolean {
    return isPsychometricSubtype(context.questionContext?.questionSubtype)
  }

  /**
   * Comprueba si el mensaje es un follow-up genérico de una respuesta previa de search.
   * Ej: "Que quiere decir?", "Y el art. 30 de esta ley", "Pero este artículo no regula...?"
   */
  private isSearchFollowUp(context: ChatContext): boolean {
    const lastAssistant = [...context.messages].reverse().find(m => m.role === 'assistant')
    if (!lastAssistant) return false

    // Detectar si la respuesta anterior fue de search (contenido legal)
    const searchMarkers = [
      'Artículo',                // Cita de artículos
      '/test/articulo?',         // Link a test de artículo
      'Ley ',                    // Mención de ley
      'Real Decreto',            // Mención de RD
      'Ley Orgánica',            // Mención de LO
      '📚 **Fuente:**',         // Fuente citada
    ]
    const wasSearch = searchMarkers.some(m => lastAssistant.content.includes(m))
    if (!wasSearch) return false

    // El mensaje actual debe parecer un follow-up (pregunta corta o referencia a lo anterior)
    const msg = context.currentMessage.trim()
    const followUpPatterns = [
      /^(qu[eé]|qué)\s+(quiere|significa|es|dice|implica)/i,   // "Qué quiere decir?"
      /^(y|pero)\s+(\w+\s+)?(el|la|los|las|este|esta|ese|esa)\s+art/i,  // "Y el art. 30...", "Y el el art. 30..."
      /^(pero|y|entonces)\s+(\w+\s+)?(este|esta|ese|esa)\s+(art|ley|norma)/i, // "Pero este artículo..."
      /^(pero|y|entonces)\s+(no|sí|si)\s+(regula|establece|dice|incluye|contempla)/i, // "Pero no regula...?"
      /^(en|de)\s+(qu[eé]|qué)\s+(consiste|trata|habla|se\s+refiere)/i, // "En qué consiste?"
      /^(cu[aá]l|cuál)\s+(es|son|ser[ií]a)/i,                  // "Cuál es la diferencia?"
      /^(y|pero)\s+(cu[aá]l|qu[eé]|c[oó]mo)/i,                // "Y cuál...?", "Pero cómo...?"
      /^(me\s+)?explic/i,                                       // "Explícame", "Me explicas"
      /^(no\s+)?entiendo/i,                                     // "No entiendo"
    ]
    if (followUpPatterns.some(p => p.test(msg))) return true

    // Mensajes cortos con signo de interrogación que refieren a lo anterior
    if (msg.length <= 60 && msg.includes('?')) return true

    return false
  }

  /**
   * Comprueba si la última respuesta del assistant fue de stats.
   * Usado para ceder el manejo a StatsDomain en follow-ups.
   */
  private isPreviousResponseStats(messages: Array<{ role: string; content: string }>): boolean {
    const lastAssistant = [...messages].reverse().find(m => m.role === 'assistant')
    if (!lastAssistant) return false
    const markers = [
      'Estadísticas de Exámenes Oficiales',
      'Artículos más preguntados',
      'Tu Progreso de Estudio',
      'Tu Progreso: Esta Semana',
      'preguntas de exámenes oficiales',
    ]
    return markers.some(m => lastAssistant.content.includes(m))
  }

  /**
   * Determina si este dominio puede manejar el contexto
   */
  async canHandle(context: ChatContext): Promise<boolean> {
    // Las preguntas psicotécnicas NO deben ir a búsqueda de artículos
    // Se manejan por el fallback del orchestrator con prompt específico
    if (this.isPsychometricQuestion(context)) {
      logger.debug('SearchDomain: Skipping psychometric question, will be handled by fallback', {
        domain: 'search',
        questionSubtype: context.questionContext?.questionSubtype,
      })
      return false
    }

    const msg = context.currentMessage.toLowerCase()

    // Patrones que indican búsqueda de información legal
    const searchIndicators = [
      // Preguntas sobre leyes
      /qu[eé]\s+(dice|establece|regula)/i,
      /seg[uú]n\s+(la\s+)?ley/i,
      /art[ií]culo\s+\d+/i,
      /\bley\s+\d+/i,
      /\bla\s+\d+\/\d+/i,
      /\b\d{1,4}\/\d{4}\b/i, // Bare law reference: "951/2005"

      // Patrones legales
      /plazo|plazos/i,
      /recurso|recursos/i,
      /silencio\s+administrativo/i,
      /notificaci[oó]n/i,
      /procedimiento/i,
      /competencia/i,
      /delegaci[oó]n/i,
      /nulidad|anulabilidad/i,
      /sanci[oó]n|sancionador/i,

      // Preguntas de concepto (con soporte de tildes)
      /qu[eé]\s+es\s+(el|la|un|una)/i,
      /expl[ií]ca(me|r)?/i,  // explica, explícame, explicar, etc.
      /c[oó]mo\s+(funciona|se|es)/i,
      /por\s*qu[eé]/i,  // por qué, porque
      /cu[aá]l\s+(es|son)/i,  // cuál es, cuáles son
      /d[oó]nde/i,  // dónde
      /respuesta\s+(correcta|incorrecta)/i,
    ]

    // Si hay contexto de pregunta con ley, activar búsqueda
    if (context.questionContext?.lawName) {
      logger.debug('SearchDomain: questionContext has lawName, will handle', {
        domain: 'search',
        lawName: context.questionContext.lawName,
      })
      return true
    }

    // Detectar si hay leyes mencionadas en el mensaje
    // PERO ceder a StatsDomain cuando:
    // 1. El mensaje es una consulta de stats (ej: "preguntas más preguntadas de la CE")
    // 2. La conversación previa era de stats (follow-up)
    const mentionedLaws = detectMentionedLaws(msg)
    if (mentionedLaws.length > 0) {
      const statsQueryType = detectStatsQueryType(context.currentMessage)
      if (statsQueryType !== 'none') {
        logger.debug('SearchDomain: law mention detected but message is stats query, deferring to StatsDomain', { domain: 'search', statsQueryType })
        return false
      }
      if (this.isPreviousResponseStats(context.messages)) {
        logger.debug('SearchDomain: law mention detected but previous response was stats, deferring to StatsDomain', { domain: 'search' })
        return false
      }
      return true
    }

    // Detectar si hay patrón legal
    const pattern = detectQueryPattern(msg)
    if (pattern) return true

    // Verificar indicadores de búsqueda
    if (searchIndicators.some(regex => regex.test(msg))) return true

    // Follow-up de una respuesta previa de search
    // Si la última respuesta fue de este dominio y el mensaje es una pregunta genérica
    // ("Que quiere decir?", "Y el art. 30 de esta ley", "Pero este artículo no regula...?")
    if (this.isSearchFollowUp(context)) return true

    // Patrones de recomendación de estudio (usan hot_articles)
    const studyPatterns = [
      /qu[eé]\s+(ejercicio|tema|ley|materia)s?\s+.*\b(recomend|important|priorit|imprescindible)/i,
      /\b(recomend|important|priorit|imprescindible).*\b(ejercicio|tema|ley|materia|estudiar|preparar)/i,
      /qu[eé]\s+(debo|tengo\s+que|hay\s+que)\s+(estudiar|preparar|repasar)/i,
      /\b(m[aá]s\s+important|lo\s+esencial|lo\s+b[aá]sico).*\b(estudi|prepar|oposici)/i,
      /por\s+d[oó]nde\s+(empiezo|empezar|inicio)/i,
    ]
    return studyPatterns.some(regex => regex.test(msg))
  }

  /**
   * Procesa el contexto y genera una respuesta
   */
  async handle(context: ChatContext, tracer?: AITracerInterface): Promise<ChatResponse> {
    const startTime = Date.now()

    logger.info('SearchDomain handling request', {
      domain: 'search',
      userId: context.userId,
      hasQuestionContext: !!context.questionContext,
      hasExplanation: !!context.questionContext?.explanation,
      lawName: context.questionContext?.lawName,
    })

    // 0. PRIMERO: Detectar y expandir follow-ups ANTES de detectar leyes
    // Esto es importante porque "y del tribunal constitucional" no debe buscar en LOTC,
    // sino mantener la ley de la pregunta anterior (CE)
    const followUpResult = this.detectAndExpandFollowUp(context)
    const effectiveMessage = followUpResult.expandedMessage

    // 0.5. ESPECIAL: Detectar preguntas sobre exámenes oficiales
    // Estas preguntas deben consultar hot_articles, no buscar artículos semánticamente
    const examQueryResult = await this.handleExamQuery(context, effectiveMessage)
    if (examQueryResult) {
      return examQueryResult
    }

    // 0.6. ESPECIAL: Detectar preguntas de informática/ofimática
    // Los artículos virtuales son solo contenedores para agrupar preguntas,
    // no contienen información útil para responder - usar conocimiento del LLM
    if (this.isInformaticsQuery(context)) {
      logger.info('SearchDomain: Detected informatics query, using LLM knowledge', { domain: 'search' })
      return this.handleInformaticsQuery(context, startTime, tracer)
    }

    // 1. Detectar ley - PRIORIDAD:
    //    a) Ley del follow-up (de la conversación anterior)
    //    b) Ley mencionada explícitamente por el usuario en su mensaje
    //    c) Ley de la explicación (lo que el usuario ve)
    //    d) Ley del artículo vinculado (interno, puede estar mal)
    let effectiveLawName = context.questionContext?.lawName

    // Si es follow-up, usar la ley de la conversación anterior
    if (followUpResult.isFollowUp && followUpResult.previousLaw) {
      logger.info(`🔎 SearchDomain: Using law from previous conversation: ${followUpResult.previousLaw}`, {
        domain: 'search',
      })
      effectiveLawName = followUpResult.previousLaw
    } else {
      // No es follow-up - detectar ley del mensaje actual
      // Solo sobrescribir la ley del contexto si el usuario menciona una ley
      // EXPLÍCITAMENTE (por nombre/número), no por inferencia de keywords
      const userMentionedLaws = detectMentionedLaws(effectiveMessage)
      const hasExplicitLawRef = /\b(ley|lo|rd|rdl)\s+\d+\/?\d*/i.test(effectiveMessage) ||
                                /\b(CE|LOPJ|LOTC|LEC|LECrim|TREBEP|EBEP|LPAC|LRJSP)\b/.test(effectiveMessage)
      if (userMentionedLaws.length > 0 && hasExplicitLawRef) {
        logger.info(`🔎 SearchDomain: User explicitly mentioned law: ${userMentionedLaws[0]}`, {
          domain: 'search',
        })
        effectiveLawName = userMentionedLaws[0]
      } else if (!effectiveLawName && userMentionedLaws.length > 0) {
        // Sin ley de contexto, usar la inferida
        logger.info(`🔎 SearchDomain: No context law, using inferred: ${userMentionedLaws[0]}`, {
          domain: 'search',
        })
        effectiveLawName = userMentionedLaws[0]
      } else if (context.questionContext?.explanation) {
        const detectedLaws = await detectLawsFromText(context.questionContext.explanation)
        if (detectedLaws.length > 0 && detectedLaws[0] !== effectiveLawName) {
          logger.info(`🔎 SearchDomain: Law from explanation: ${effectiveLawName} -> ${detectedLaws[0]}`, {
            domain: 'search',
          })
          effectiveLawName = detectedLaws[0]
        }
      }
    }

    // 2. Buscar artículos relevantes (usar mensaje expandido)
    const dbSpan = tracer?.spanDB('searchArticles', {
      // Parámetros de búsqueda
      userOposicion: context.userDomain,
      contextLawName: effectiveLawName,
      isFollowUp: followUpResult.isFollowUp,
      searchLimit: 10,
      // Mensaje usado para búsqueda
      originalMessage: context.currentMessage,
      effectiveMessage: effectiveMessage,
      // Contexto de usuario
      userId: context.userId,
      isPremium: context.isPremium,
      // Contexto de pregunta si existe
      questionContext: context.questionContext ? {
        questionId: context.questionContext.questionId,
        lawName: context.questionContext.lawName,
        questionText: context.questionContext.questionText,
      } : null,
    })

    const searchContext = followUpResult.isFollowUp
      ? { ...context, currentMessage: effectiveMessage }
      : context
    const searchResult = await searchArticles(searchContext, {
      userOposicion: context.userDomain,
      contextLawName: effectiveLawName ?? undefined,
      limit: 10,
    })

    dbSpan?.setOutput({
      // Resultados completos
      articlesFound: searchResult.articles.length,
      searchMethod: searchResult.searchMethod,
      mentionedLaws: searchResult.mentionedLaws,
      // Detalle de artículos encontrados
      articles: searchResult.articles.map(a => ({
        id: a.id,
        articleNumber: a.articleNumber,
        lawShortName: a.lawShortName,
        lawName: a.lawName,
        title: a.title,
        contentPreview: a.content?.substring(0, 200),
      })),
    })
    dbSpan?.end()

    logger.info(`Search completed: ${searchResult.articles.length} articles found via ${searchResult.searchMethod}`, {
      domain: 'search',
    })

    // 2. Verificar si es consulta genérica sobre una ley
    // NO mostrar menú genérico si:
    // - Hay contexto de pregunta (estamos en un test, el usuario pregunta sobre la pregunta)
    // - Hay historial de conversación (es un mensaje de seguimiento)
    const hasConversationContext = !!context.questionContext || context.messages.length > 1
    if (!hasConversationContext && isGenericLawQuery(context.currentMessage, searchResult.mentionedLaws)) {
      return this.handleGenericLawQuery(context, searchResult.mentionedLaws[0])
    }

    // 3. Generar respuesta con OpenAI
    const { content: responseText, tokensUsed, modelProvider, modelId } = await this.generateResponse(context, searchResult, tracer)

    // 4. Construir respuesta final
    const builder = new ChatResponseBuilder()
      .domain('search')
      .text(responseText)
      .processingTime(Date.now() - startTime)

    if (tokensUsed) {
      builder.tokensUsed(tokensUsed)
    }
    if (modelProvider && modelId) {
      builder.model(modelProvider, modelId)
    }

    // Añadir fuentes
    if (searchResult.articles.length > 0) {
      const sources: ArticleSource[] = searchResult.articles.slice(0, 5).map(a => ({
        lawName: a.lawShortName,
        articleNumber: a.articleNumber,
        title: a.title || undefined,
        relevance: a.similarity,
      }))
      builder.addSources(sources) // Sin mostrar bloque de fuentes al usuario
    }

    return builder.build()
  }

  /**
   * Detecta si el mensaje es sobre informática/ofimática (Excel, Word, Windows, etc.)
   */
  private isInformaticsQuery(context: ChatContext): boolean {
    // Detectar por contexto de pregunta (ley virtual)
    if (context.questionContext?.lawName && isVirtualLaw(context.questionContext.lawName)) {
      return true
    }

    // Detectar por patrones en el mensaje
    const informaticsPatterns = [
      // Excel
      /\b(excel|hoja\s+de\s+c[aá]lculo|spreadsheet)\b/i,
      /\b(celda|celdas|rango|fila|columna)\b.*\b[a-z]\d/i,
      /=[A-Z]+\(/i, // fórmulas tipo =INDICE(, =SUMA(, =BUSCARV(
      /\b(indice|buscarv|buscarh|si\.conjunto|sumar\.si|contar\.si|promedio|concatenar|vlookup|hlookup|index|match)\b/i,
      /\b(tabla\s+din[aá]mica|pivot\s+table|formato\s+condicional|validaci[oó]n\s+de\s+datos)\b/i,
      // Word
      /\b(word|procesador\s+de\s+textos?)\b/i,
      /\b(encabezado|pie\s+de\s+p[aá]gina|tabla\s+de\s+contenido|marcador|macro)\b.*\b(word|documento)\b/i,
      // Windows / SO
      /\b(windows\s+\d+|escritorio\s+remoto|explorador\s+de\s+archivos|panel\s+de\s+control|registro\s+de\s+windows)\b/i,
      // General IT
      /\b(hardware|software|cpu|ram|disco\s+duro|ssd|sistema\s+operativo|navegador|firewall|antivirus)\b/i,
      /\b(internet|intranet|extranet|dns|ip|tcp|http|url|html|css)\b/i,
      /\b(base\s+de\s+datos|sql|access|libreoffice|openoffice)\b/i,
      // Formato de celdas/rangos Excel (B5:C9, A1:Z100, etc.)
      /\b[A-Z]{1,3}\d{1,5}:[A-Z]{1,3}\d{1,5}\b/,
    ]

    return informaticsPatterns.some(p => p.test(context.currentMessage))
  }

  /**
   * Maneja preguntas de informática/ofimática usando conocimiento del LLM.
   * Los artículos virtuales son solo contenedores para agrupar preguntas,
   * no contienen información útil - el LLM responde con su propio conocimiento.
   */
  private async handleInformaticsQuery(
    context: ChatContext,
    startTime: number,
    tracer?: AITracerInterface
  ): Promise<ChatResponse> {
    const openai = await getOpenAI()
    const model = context.isPremium ? CHAT_MODEL_PREMIUM : CHAT_MODEL

    const systemPrompt = `Eres un tutor experto en informática y ofimática para oposiciones, desarrollado por Vence. Si te preguntan quién eres o qué modelo usas, responde que eres el asistente de Vence entrenado para oposiciones. Tu rol es explicar de forma clara, precisa y didáctica.

## Directrices:
1. **Usa tu conocimiento**: No hay artículos legales para estas preguntas. Usa tu conocimiento técnico.
2. **Sé preciso**: Da la respuesta exacta con el razonamiento paso a paso.
3. **Analiza opciones**: Si hay opciones A/B/C/D, explica por qué cada una es correcta o incorrecta.
4. **Formato**: Usa markdown (negritas, listas, código) para estructurar la respuesta.
5. **NO menciones artículos ni legislación** - esto es contenido técnico de informática.
6. **Ejemplos prácticos**: Si es útil, muestra ejemplos concretos (fórmulas, capturas de pantalla mentales, etc.).`

    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: systemPrompt },
    ]

    const recentHistory = context.messages.slice(-6)
    for (const msg of recentHistory) {
      if (msg.role === 'user' || msg.role === 'assistant') {
        messages.push({ role: msg.role, content: msg.content })
      }
    }
    messages.push({ role: 'user', content: context.currentMessage })

    const llmSpan = tracer?.spanLLM({
      model,
      temperature: 0.5,
      maxTokens: 1500,
      systemPrompt,
      userPrompt: context.currentMessage,
      messagesArray: messages,
      isInformatics: true,
    })

    try {
      const completion = await openai.chat.completions.create({
        model,
        messages,
        temperature: 0.5,
        max_tokens: 1500,
      })

      const content = completion.choices[0]?.message?.content || 'No pude generar una respuesta.'
      const totalTokens = completion.usage?.total_tokens

      llmSpan?.setOutput({
        responseContent: content,
        finishReason: completion.choices[0]?.finish_reason,
        totalTokens,
      })
      llmSpan?.end()

      const builder = new ChatResponseBuilder()
        .domain('search')
        .text(content)
        .processingTime(Date.now() - startTime)

      if (totalTokens) {
        builder.tokensUsed(totalTokens)
      }

      return builder.build()
    } catch (error) {
      llmSpan?.setError(error instanceof Error ? error.message : 'Unknown error')
      llmSpan?.end()
      logger.error('Error generating informatics response', error, { domain: 'search' })
      return new ChatResponseBuilder()
        .domain('search')
        .text('Hubo un error al procesar tu consulta. Por favor, intenta de nuevo.')
        .processingTime(Date.now() - startTime)
        .build()
    }
  }

  /**
   * Maneja consultas genéricas sobre una ley
   */
  private handleGenericLawQuery(context: ChatContext, lawName: string): ChatResponse {
    const response = `Has mencionado la **${lawName}**. ¿Qué aspecto específico te gustaría conocer?

Puedo ayudarte con:
• **Plazos** - Términos y plazos establecidos
• **Procedimientos** - Fases y trámites
• **Recursos** - Impugnaciones y revisiones
• **Órganos** - Competencias y composición
• **Definiciones** - Conceptos clave

💡 *Tip: Cuanto más específica sea tu pregunta, mejor podré ayudarte.*`

    return new ChatResponseBuilder()
      .domain('search')
      .text(response)
      .build()
  }

  /**
   * Genera respuesta usando OpenAI con contexto de artículos
   */
  private async generateResponse(
    context: ChatContext,
    searchResult: Awaited<ReturnType<typeof searchArticles>>,
    tracer?: AITracerInterface
  ): Promise<{ content: string; tokensUsed?: number; modelProvider?: string; modelId?: string }> {
    const openai = await getOpenAI()
    const model = context.isPremium ? CHAT_MODEL_PREMIUM : CHAT_MODEL

    // Detectar si el usuario quiere el texto literal/completo
    const wantsFullContent = wantsLiteralContent(context.currentMessage)
    logger.info(`🔎 wantsFullContent: ${wantsFullContent} for message: "${context.currentMessage}"`, { domain: 'search' })

    // Verificar si encontramos el artículo específico que pidió el usuario
    let foundRequestedArticle = true
    if (wantsFullContent) {
      const requestedNumbers = extractArticleNumbers(context.currentMessage)
      if (requestedNumbers.length > 0) {
        const foundNumbers = searchResult.articles.map(a => a.articleNumber)
        foundRequestedArticle = requestedNumbers.some(num => foundNumbers.includes(num))
        logger.info(`🔎 Requested articles: ${requestedNumbers.join(', ')}, Found: ${foundNumbers.join(', ')}, Match: ${foundRequestedArticle}`, { domain: 'search' })
      }
    }

    // Verificar si el artículo tiene preguntas disponibles (solo si pide contenido literal)
    let hasTestQuestions = false
    if (wantsFullContent && foundRequestedArticle && searchResult.articles.length > 0) {
      const firstArticle = searchResult.articles[0]
      if (firstArticle.id) {
        hasTestQuestions = await hasQuestionsForArticle(firstArticle.id)
        logger.info(`🔎 hasTestQuestions: ${hasTestQuestions} for article ${firstArticle.articleNumber}`, { domain: 'search' })
      }
    }

    // Construir contexto de artículos - siempre contenido completo para máxima precisión
    const articlesContext = formatArticlesForContext(searchResult.articles, {
      fullContent: true,
    })

    // System prompt específico para búsqueda
    const systemPrompt = this.buildSystemPrompt(context, searchResult, wantsFullContent, hasTestQuestions, foundRequestedArticle)

    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: systemPrompt },
    ]

    // Añadir historial de conversación (últimos mensajes)
    const recentHistory = context.messages.slice(-6)
    for (const msg of recentHistory) {
      if (msg.role === 'user' || msg.role === 'assistant') {
        messages.push({ role: msg.role, content: msg.content })
      }
    }

    // El mensaje ya viene expandido desde handle() si era un follow-up
    // Añadir contexto de artículos al mensaje actual
    const userMessageWithContext = `${context.currentMessage}

---
ARTÍCULOS RELEVANTES:
${articlesContext}`

    messages.push({ role: 'user', content: userMessageWithContext })

    // Crear span LLM - COMPLETO sin truncar
    const llmSpan = tracer?.spanLLM({
      model,
      temperature: 0.7,
      maxTokens: 1500,
      // Prompts completos
      systemPrompt,
      userPrompt: context.currentMessage,
      userPromptWithContext: userMessageWithContext,
      // Mensajes completos enviados a la API
      messagesArray: messages,
      // Contexto adicional
      articlesInContext: searchResult.articles.length,
      articlesSummary: searchResult.articles.map(a => ({
        id: a.id,
        articleNumber: a.articleNumber,
        lawShortName: a.lawShortName,
        title: a.title,
      })),
      conversationHistoryLength: recentHistory.length,
    })

    try {
      const completion = await openai.chat.completions.create({
        model,
        messages,
        temperature: 0.7,
        max_tokens: 1500,
      })

      const content = completion.choices[0]?.message?.content || 'No pude generar una respuesta.'
      const totalTokens = completion.usage?.total_tokens

      // Finalizar span LLM - COMPLETO
      llmSpan?.setOutput({
        // Respuesta completa
        responseContent: content,
        finishReason: completion.choices[0]?.finish_reason,
        // Uso de tokens
        promptTokens: completion.usage?.prompt_tokens,
        completionTokens: completion.usage?.completion_tokens,
        totalTokens,
      })
      llmSpan?.addMetadata('tokensIn', completion.usage?.prompt_tokens)
      llmSpan?.addMetadata('tokensOut', completion.usage?.completion_tokens)
      llmSpan?.addMetadata('model', model)
      llmSpan?.addMetadata('responseLength', content.length)
      llmSpan?.end()

      return { content, tokensUsed: totalTokens, modelProvider: 'openai', modelId: model }
    } catch (error) {
      llmSpan?.setError(error instanceof Error ? error.message : 'Unknown error')
      llmSpan?.end()

      logger.error('Error generating response with OpenAI', error, { domain: 'search' })
      return { content: 'Hubo un error al procesar tu consulta. Por favor, intenta de nuevo.', modelProvider: 'openai', modelId: model }
    }
  }

  /**
   * Construye el system prompt para búsqueda
   */
  private buildSystemPrompt(
    context: ChatContext,
    searchResult: Awaited<ReturnType<typeof searchArticles>>,
    wantsFullContent: boolean = false,
    hasTestQuestions: boolean = false,
    foundRequestedArticle: boolean = true
  ): string {
    // Generar enlace al test si hay artículos específicos Y hay preguntas disponibles
    let testSuggestion = ''
    if (wantsFullContent && foundRequestedArticle && hasTestQuestions && searchResult.articles.length > 0) {
      const firstArticle = searchResult.articles[0]
      const testLink = `/test/articulo?law=${encodeURIComponent(firstArticle.lawShortName)}&article=${encodeURIComponent(firstArticle.articleNumber)}`
      const articleInfo = `Art. ${firstArticle.articleNumber} de ${firstArticle.lawShortName}`
      testSuggestion = `
5. **Sugerencia final**: Al terminar de mostrar el artículo, añade esta línea exacta al final:
   "🎯 **¿Quieres practicar?** 👉 [Hacer test de ${articleInfo}](${testLink})"`
    }

    // Instrucciones base o instrucciones para contenido literal
    let responseGuidelines: string
    if (wantsFullContent && !foundRequestedArticle) {
      // Usuario pidió un artículo específico pero NO lo encontramos
      responseGuidelines = `## Directrices - ARTÍCULO NO ENCONTRADO:
1. **SÉ HONESTO**: El usuario pidió un artículo específico pero NO lo encontré en mi base de datos.
2. **NO INVENTES**: NO te inventes el contenido del artículo. Nunca alucines texto legal.
3. **INFORMA**: Dile al usuario que no encontraste ese artículo específico y pregúntale si puede verificar el número o la ley.
4. **SUGIERE**: Ofrece buscar artículos relacionados o ayudar de otra forma.

IMPORTANTE: Responde algo como: "No he encontrado el artículo [número] en [ley] en mi base de datos. ¿Podrías verificar el número del artículo o la ley? Puedo ayudarte a buscar artículos relacionados."`
    } else if (wantsFullContent) {
      // Detectar si es una pregunta de test (tiene opciones A/B/C/D)
      const isTestQuestion = /\b[ABCD]\)\s*.+/i.test(context.currentMessage) ||
        /las opciones son:/i.test(context.currentMessage)

      if (isTestQuestion) {
        // NO mostrar "¿Quieres practicar?" porque ya está en un test
        responseGuidelines = `## Directrices para pregunta de test:
1. **CITA EL TEXTO LITERAL**: Si es de legislación, muestra el texto exacto del artículo relevante usando citas (>).
2. **ANALIZA LAS OPCIONES**: Explica por qué cada opción es correcta o incorrecta.
3. **Formato**:
   - Primero indica la respuesta correcta
   - Luego explica el razonamiento (citando artículo si aplica)
   - Después analiza cada opción`
      } else {
        responseGuidelines = `## Directrices para texto literal:
1. **PROPORCIONA EL TEXTO COMPLETO**: El usuario ha pedido el artículo literal/completo. Copia el contenido íntegro del artículo tal como aparece.
2. **No resumas ni parafrasees**: Transcribe el texto exacto del artículo sin modificaciones.
3. **Cita la fuente**: Indica claramente de qué ley y artículo se trata.
4. **Formato**: Mantén la estructura original del artículo (apartados, números, letras).${testSuggestion}`
      }
    } else {
      responseGuidelines = `## Directrices:
1. **Prioriza artículos**: Si hay artículos relevantes que cubren la pregunta, basa tu respuesta en ellos y cita la fuente (ej: "Según el Art. 21 de la Ley 39/2015...")
2. **No inventes contenido legal**: Si los artículos proporcionados NO cubren el tema específico de la pregunta, indícalo claramente. Dile al usuario que no has encontrado el artículo concreto y sugiérele que especifique el artículo o la ley. NUNCA inventes artículos, apartados o causas legales que no estén en el contexto proporcionado.
3. **Conocimiento general**: Solo usa tu conocimiento propio para temas generales o conceptuales, nunca para datos específicos (artículos, plazos, mayorías, causas de cese, etc.) que deben venir de la legislación.
4. **Sé conciso**: Responde de forma directa sin rodeos
5. **Formato**: Usa markdown para estructurar la respuesta (negritas, listas, etc.)
6. **Si el usuario discrepa**: Cuando el usuario diga que una opción "dice lo mismo" o "es igual" que el artículo, compara palabra por palabra el texto exacto del artículo con la opción, usando negritas para señalar las diferencias concretas. No repitas la respuesta correcta — céntrate en demostrar la diferencia textual.`
    }

    let prompt = `Eres un asistente experto en derecho administrativo español, especializado en oposiciones, desarrollado por Vence. Si te preguntan quién eres o qué modelo usas, responde que eres el asistente de Vence entrenado para oposiciones.

Tu objetivo es responder preguntas sobre legislación de forma precisa y útil. Es preferible decir que no has encontrado el artículo concreto a inventar información legal incorrecta.

${responseGuidelines}

## Información de búsqueda:
- Método de búsqueda: ${searchResult.searchMethod}
- Artículos encontrados: ${searchResult.articles.length}
- Leyes mencionadas: ${searchResult.mentionedLaws.join(', ') || 'ninguna específica'}`

    // Añadir contexto de pregunta si existe
    if (context.questionContext) {
      const qc = context.questionContext
      prompt += `

## Contexto de pregunta de test:
- Ley: ${qc.lawName || 'No especificada'}
- Artículo: ${qc.articleNumber || 'No especificado'}`

      if (qc.questionText) {
        prompt += `
- Pregunta: ${qc.questionText}`
      }
    }

    return prompt
  }

  /**
   * Detecta si es una pregunta sobre exámenes oficiales y responde con datos de hot_articles
   * Retorna null si no es una pregunta de exámenes
   */
  private async handleExamQuery(
    context: ChatContext,
    message: string
  ): Promise<ChatResponse | null> {
    // Patrones que indican pregunta sobre exámenes oficiales
    const examPatterns = [
      /qu[eé]\s+art[ií]culos?\s+.*\b(ca[ií]do|caen|pregunt)/i,
      /art[ií]culos?\s+.*\b(ex[aá]men|examen|oficial)/i,
      /\b(ca[ií]do|caen|pregunt).*\bex[aá]men/i,
      /m[aá]s\s+preguntad[oa]s?\s+(en\s+)?ex[aá]men/i,
      /\bex[aá]men(es)?\s+oficial(es)?\b.*art[ií]culo/i,
      /art[ií]culos?\s+importantes?\s+.*ex[aá]men/i,
      /qu[eé]\s+(tipo|clase)\s+de\s+preguntas?\s+.*\bcaer?\b/i, // "qué tipo de preguntas suelen caer"
      /preguntas?\s+.*\b(suelen|pueden)\s+caer\b/i,             // "preguntas que suelen caer"
      // Recomendaciones de estudio (implica analizar exámenes oficiales)
      /qu[eé]\s+(ejercicio|tema|ley|materia)s?\s+.*\b(recomend|important|priorit|imprescindible)/i,
      /\b(recomend|important|priorit|imprescindible).*\b(ejercicio|tema|ley|materia|estudiar|preparar)/i,
      /qu[eé]\s+(debo|tengo\s+que|hay\s+que)\s+(estudiar|preparar|repasar)/i,
      /\b(m[aá]s\s+important|lo\s+esencial|lo\s+b[aá]sico).*\b(estudi|prepar|oposici)/i,
      /por\s+d[oó]nde\s+(empiezo|empezar|inicio)/i,
    ]

    const isExamQuery = examPatterns.some(p => p.test(message))
    if (!isExamQuery) {
      return null
    }

    // Si el historial reciente es una conversación de resumen/estudio,
    // NO interceptar como exam query - el usuario solo menciona "examen" como referencia
    const recentHistory = context.messages?.slice(-4) || []
    const isInStudyConversation = recentHistory.some(m =>
      m.role === 'assistant' && (
        /\bresumen\b/i.test(m.content) ||
        /\bpaso a paso\b/i.test(m.content) ||
        /\bnivel\s+(mínimo|intermedio|avanzado)\b/i.test(m.content)
      )
    )
    if (isInStudyConversation) {
      logger.info('SearchDomain: Skipping exam query - user is in study conversation', { domain: 'search' })
      return null
    }

    const startTime = Date.now()

    // Nombres legibles de oposiciones para logs y respuestas
    const oposicionNames: Record<string, string> = {
      auxiliar_administrativo_estado: 'Auxiliar Administrativo del Estado',
      tramitacion_procesal: 'Tramitación Procesal',
      auxilio_judicial: 'Auxilio Judicial',
      gestion_procesal: 'Gestión Procesal',
      cuerpo_general_administrativo: 'Cuerpo General Administrativo',
    }

    const userOposicionName = context.userDomain
      ? (oposicionNames[context.userDomain] || context.userDomain)
      : null

    logger.info(`🔥 SearchDomain: Detected exam query for ${userOposicionName || 'unknown user'}`, {
      domain: 'search',
      message: message.substring(0, 50),
      userDomain: context.userDomain,
      userOposicionName,
    })

    // Verificar que tenemos la oposición del usuario
    if (!context.userDomain) {
      logger.warn('🔥 SearchDomain: No userDomain available for exam query', { domain: 'search' })
      return new ChatResponseBuilder()
        .domain('search')
        .text('Para mostrarte los artículos más preguntados en exámenes, necesito saber tu oposición. Por favor, configúrala en tu perfil.')
        .processingTime(Date.now() - startTime)
        .build()
    }

    logger.info(`🔥 Buscando hot_articles para oposición: ${userOposicionName}, usuario: ${context.userName || 'sin nombre'}`, { domain: 'search' })

    // Detectar si hay una ley específica mencionada
    const mentionedLaws = detectMentionedLaws(message)
    let lawFilter = mentionedLaws.length > 0 ? mentionedLaws[0] : undefined

    // Detectar si hay un tema específico ("tema 15", "tema 3")
    const temaMatch = message.match(/\btema\s+(\d+)\b/i)
    let temaLaws: string[] = []
    if (temaMatch && !lawFilter && context.userDomain) {
      const temaNumber = parseInt(temaMatch[1])
      // Buscar las leyes de ese tema en topic_scope
      try {
        const { data: topics } = await getSupabaseForSearch()
          .from('topics')
          .select('id')
          .eq('position_type', context.userDomain)
          .eq('topic_number', temaNumber)
          .limit(1)

        if (topics?.length) {
          const { data: scopes } = await getSupabaseForSearch()
            .from('topic_scope')
            .select('law_id')
            .eq('topic_id', topics[0].id)

          if (scopes?.length) {
            const lawIds = scopes.map(s => s.law_id)
            const { data: laws } = await getSupabaseForSearch()
              .from('laws')
              .select('short_name')
              .in('id', lawIds)

            temaLaws = (laws || []).map(l => l.short_name).filter(Boolean)
            if (temaLaws.length === 1) {
              lawFilter = temaLaws[0]
            }
            logger.info(`🔥 Tema ${temaNumber} → ${temaLaws.length} leyes: ${temaLaws.join(', ')}`, { domain: 'search' })
          }
        }
      } catch (err) {
        logger.warn('Error buscando leyes del tema', { domain: 'search' })
      }
    }

    // Consultar hot_articles (filtrado por ley o por leyes del tema)
    let searchResult = await getHotArticlesByOposicion(context.userDomain, {
      lawShortName: lawFilter,
      limit: temaLaws.length > 1 ? 20 : 10,
    })

    // Si hay múltiples leyes del tema y no se filtró por una ley específica,
    // filtrar los resultados para incluir solo artículos de las leyes del tema
    if (temaLaws.length > 1 && !lawFilter && searchResult.articles) {
      const temaLawSet = new Set(temaLaws)
      searchResult = {
        ...searchResult,
        articles: searchResult.articles.filter(a => temaLawSet.has(a.lawName || '')).slice(0, 10),
      }
    }

    // Formatear respuesta con nombre del usuario para personalización
    const temaLabel = temaMatch ? `Tema ${temaMatch[1]}` : undefined
    const response = formatHotArticlesResponse(searchResult, context.userDomain, {
      lawName: lawFilter || (temaLaws.length > 0 ? temaLabel : undefined),
      userName: context.userName,
    })

    return new ChatResponseBuilder()
      .domain('search')
      .text(response)
      .processingTime(Date.now() - startTime)
      .build()
  }

  /**
   * Detecta si el mensaje es un follow-up y lo expande con contexto de la conversación anterior
   * También extrae la ley usada en la pregunta anterior para mantener continuidad
   *
   * Ej: "y del tribunal constitucional" -> {
   *   isFollowUp: true,
   *   expandedMessage: "¿Cuáles son los plazos del tribunal constitucional?",
   *   previousLaw: "CE"
   * }
   */
  private detectAndExpandFollowUp(context: ChatContext): {
    isFollowUp: boolean
    expandedMessage: string
    previousLaw?: string
  } {
    const msg = context.currentMessage.trim()
    const defaultResult = { isFollowUp: false, expandedMessage: msg }

    // Solo expandir mensajes cortos que parecen follow-ups
    if (msg.length > 80) return defaultResult

    // Patrones de follow-up
    const followUpPatterns = [
      /^y\s+(del?|de la|sobre|en)\s+/i,
      /^(qué|que)\s+hay\s+(del?|de la|sobre)/i,
      /^(y|también)\s+(los?|las?|el|la)\s+/i,
    ]

    const isFollowUp = followUpPatterns.some((p) => p.test(msg))
    logger.info(`🔎 Follow-up pattern matched: ${isFollowUp} for message: "${msg}"`, { domain: 'search' })
    if (!isFollowUp) return defaultResult

    // Buscar la pregunta anterior del usuario para extraer el tema
    // IMPORTANTE: context.messages INCLUYE el mensaje actual, así que necesitamos el penúltimo
    const previousUserMessages = context.messages.filter((m) => m.role === 'user')

    logger.info(`🔎 Follow-up check: messages=${context.messages.length}, userMessages=${previousUserMessages.length}`, { domain: 'search' })

    // Necesitamos al menos 2 mensajes de usuario (el actual y el anterior)
    if (previousUserMessages.length < 2) {
      logger.info(`🔎 Not enough previous user messages for follow-up expansion`, { domain: 'search' })
      return defaultResult
    }

    // Tomar el PENÚLTIMO mensaje del usuario (el anterior al actual)
    const previousMessage = previousUserMessages[previousUserMessages.length - 2]?.content || ''
    logger.info(`🔎 Previous user message for topic extraction: "${previousMessage.substring(0, 60)}..."`, { domain: 'search' })

    // Extraer el tema de la pregunta anterior (ej: "plazos", "requisitos", "competencias")
    const topicPatterns = [
      /(?:cu[aá]les?\s+(?:son\s+)?(?:los?\s+)?)(plazos?|requisitos?|competencias?|funciones?|obligaciones?|derechos?|deberes?|procedimientos?)/i,
      /(?:qu[eé]\s+)(plazos?|requisitos?|competencias?|funciones?|obligaciones?|derechos?|deberes?|procedimientos?)/i,
      /(plazos?|requisitos?|competencias?|funciones?|obligaciones?|derechos?|deberes?|procedimientos?)\s+(?:m[aá]s\s+)?importantes?/i,
    ]

    let topic = ''
    for (const pattern of topicPatterns) {
      const match = previousMessage.match(pattern)
      if (match) {
        topic = match[1]
        break
      }
    }

    if (!topic) {
      logger.info(`🔎 Could not extract topic from previous message`, { domain: 'search' })
      return defaultResult
    }

    // Extraer la ley de la pregunta anterior para mantener continuidad
    const previousLaws = detectMentionedLaws(previousMessage)
    const previousLaw = previousLaws.length > 0 ? previousLaws[0] : undefined

    // Expandir el follow-up con el tema
    // "y del tribunal constitucional" -> "¿Cuáles son los plazos del tribunal constitucional?"
    const expandedPart = msg.replace(/^y\s+/i, '').replace(/^\?+/, '')
    const expanded = `¿Cuáles son los ${topic} ${expandedPart}?`

    logger.info(`🔎 SearchDomain: Expanded follow-up: "${msg}" -> "${expanded}" (previousLaw: ${previousLaw || 'none'})`, { domain: 'search' })

    return {
      isFollowUp: true,
      expandedMessage: expanded,
      previousLaw,
    }
  }
}

// ============================================
// EXPORT SINGLETON
// ============================================

let searchDomainInstance: SearchDomain | null = null

export function getSearchDomain(): SearchDomain {
  if (!searchDomainInstance) {
    searchDomainInstance = new SearchDomain()
  }
  return searchDomainInstance
}
