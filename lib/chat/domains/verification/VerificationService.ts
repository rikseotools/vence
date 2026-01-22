// lib/chat/domains/verification/VerificationService.ts
// Servicio principal de verificación de respuestas

import { getOpenAI, CHAT_MODEL, CHAT_MODEL_PREMIUM } from '../../shared/openai'
import { logger } from '../../shared/logger'
import { searchArticles, formatArticlesForContext, detectLawsFromText, extractArticleNumbers, findArticleInLaw } from '../search'
import {
  detectErrorInResponse,
  analyzeQuestion,
  generateVerificationContext,
  formatQuestionForPrompt,
  type QuestionAnalysis,
  type ErrorDetectionResult,
} from './ErrorDetector'
import {
  createAutoDispute,
  generateDisputeConfirmationMessage,
  type DisputeResult,
} from './DisputeService'
import { getLinkedArticle, type LinkedArticle } from './queries'
import type { ChatContext, ArticleSource } from '../../core/types'

// ============================================
// LEYES VIRTUALES (INFORMÁTICA)
// Estas leyes no tienen artículos reales - son contenido técnico
// No debemos mencionar "artículo vinculado" para estas
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

/**
 * Verifica si una ley es virtual (informática/técnica)
 * Las leyes virtuales no tienen artículos legales reales
 */
function isVirtualLaw(lawName: string | undefined): boolean {
  if (!lawName) return false
  // Solo verificar si el lawName contiene el nombre de una ley virtual
  // NO al revés (ej: "Correo electrónico".includes("CE") = true, pero CE no es virtual)
  return VIRTUAL_LAWS.some(vl =>
    lawName.toLowerCase().includes(vl.toLowerCase())
  )
}

// ============================================
// TIPOS
// ============================================

export interface VerificationInput {
  questionId: string
  questionText: string
  options: string[]
  markedCorrect: number
  lawName?: string
  articleNumber?: string
  userId?: string
  // Datos adicionales de nuestra BD
  explanation?: string
}

export interface VerificationResult {
  response: string
  errorDetected: boolean
  errorDetails?: ErrorDetectionResult
  disputeCreated: boolean
  disputeResult?: DisputeResult
  sources: ArticleSource[]
  processingTime: number
}

// Tipo para artículo detectado dinámicamente en la explicación
type ArticleFromExplanation = {
  id: string
  articleNumber: string
  title: string | null
  content: string | null
  lawShortName: string
  lawName: string
} | null

// ============================================
// SERVICIO PRINCIPAL
// ============================================

/**
 * Verifica una respuesta de test contra la legislación
 */
export async function verifyAnswer(
  input: VerificationInput,
  context: ChatContext
): Promise<VerificationResult> {
  const startTime = Date.now()

  logger.info('Starting answer verification', {
    domain: 'verification',
    questionId: input.questionId,
    lawName: input.lawName,
  })

  // 1. Analizar si tenemos suficiente información
  const questionAnalysis: QuestionAnalysis = {
    questionText: input.questionText,
    options: input.options,
    markedCorrect: input.markedCorrect,
    lawName: input.lawName,
    articleNumber: input.articleNumber,
  }

  const analysis = analyzeQuestion(questionAnalysis)
  if (!analysis.canVerify) {
    logger.warn('Insufficient information for verification', {
      domain: 'verification',
      missingFields: analysis.missingFields,
    })

    return {
      response: 'No tengo suficiente información para verificar esta pregunta.',
      errorDetected: false,
      disputeCreated: false,
      sources: [],
      processingTime: Date.now() - startTime,
    }
  }

  // 2. Obtener artículo vinculado directamente (si existe)
  const linkedArticle = input.questionId
    ? await getLinkedArticle(input.questionId)
    : null

  if (linkedArticle) {
    logger.info(`🔎 Found linked article: ${linkedArticle.lawShortName} Art. ${linkedArticle.articleNumber}`, {
      domain: 'verification',
    })
  }

  // 3. Detectar ley y artículo desde TRES fuentes posibles:
  //    a) Artículo vinculado en BD (puede estar mal)
  //    b) Artículo citado en la PREGUNTA (ej: "Según el art. 9 de la LOTC...")
  //    c) Artículo mencionado en la EXPLICACIÓN
  let effectiveLawName = input.lawName
  let effectiveArticleNumber = input.articleNumber
  let articleFromQuestion: ArticleFromExplanation = null
  let articleFromExplanation: ArticleFromExplanation = null

  // PASO 1: Detectar ley/artículo citado en la PREGUNTA (máxima prioridad)
  if (input.questionText) {
    const lawsFromQuestion = await detectLawsFromText(input.questionText)
    const articlesFromQuestion = extractArticleNumbers(input.questionText)

    if (lawsFromQuestion.length > 0 || articlesFromQuestion.length > 0) {
      const lawToSearch = lawsFromQuestion[0] || effectiveLawName || input.lawName

      if (lawToSearch && articlesFromQuestion.length > 0) {
        for (const artNum of articlesFromQuestion) {
          const found = await findArticleInLaw(lawToSearch, artNum)
          if (found) {
            articleFromQuestion = found
            logger.info(`🔎 Found article cited in QUESTION: ${found.lawShortName} art. ${found.articleNumber}`, {
              domain: 'verification',
            })
            break
          }
        }
      }

      // Si la pregunta menciona una ley diferente, usarla
      if (lawsFromQuestion.length > 0 && lawsFromQuestion[0] !== input.lawName) {
        logger.info(`🔎 Law from QUESTION: ${lawsFromQuestion[0]}`, { domain: 'verification' })
        effectiveLawName = lawsFromQuestion[0]
      }
    }
  }

  // PASO 2: Detectar ley/artículo de la EXPLICACIÓN
  if (input.explanation) {
    const detectedLaws = await detectLawsFromText(input.explanation)
    if (detectedLaws.length > 0 && detectedLaws[0] !== input.lawName) {
      logger.info(`🔎 Law from explanation: ${input.lawName} -> ${detectedLaws[0]}`, {
        domain: 'verification',
      })
      // Solo actualizar si no vino de la pregunta
      if (!articleFromQuestion) {
        effectiveLawName = detectedLaws[0]
      }
    }

    const articleNumbers = extractArticleNumbers(input.explanation)
    if (articleNumbers.length > 0) {
      logger.info(`🔎 Article numbers in explanation: ${articleNumbers.join(', ')}`, {
        domain: 'verification',
      })

      const lawToSearch = detectedLaws[0] || effectiveLawName || input.lawName
      if (lawToSearch) {
        for (const artNum of articleNumbers) {
          const found = await findArticleInLaw(lawToSearch, artNum)
          if (found) {
            articleFromExplanation = found
            effectiveArticleNumber = found.articleNumber
            logger.info(`🔎 Found article from explanation: ${found.lawShortName} art. ${found.articleNumber}`, {
              domain: 'verification',
            })
            break
          }
        }
      }
    }
  }

  // Usar el texto de la pregunta del test como query de búsqueda
  const searchQuery = effectiveArticleNumber
    ? `Artículo ${effectiveArticleNumber} ${effectiveLawName || ''} ${input.questionText}`
    : input.questionText

  const searchResult = await searchArticles(context, {
    contextLawName: effectiveLawName,
    searchQuery,
    limit: 8,
  })

  // Incluir TODOS los artículos relevantes para que GPT pueda compararlos:
  // 1. Artículo citado en la PREGUNTA (máxima prioridad)
  // 2. Artículo vinculado en BD
  // 3. Artículo detectado en EXPLICACIÓN
  let allArticles = searchResult.articles

  // Helper para añadir artículo si no existe
  const addArticleIfNotExists = (article: NonNullable<ArticleFromExplanation>) => {
    const alreadyIncluded = allArticles.some(
      a => a.articleNumber === article.articleNumber && a.lawShortName === article.lawShortName
    )
    if (!alreadyIncluded) {
      allArticles = [{
        id: article.id,
        lawId: '',
        lawName: article.lawName,
        lawShortName: article.lawShortName,
        articleNumber: article.articleNumber,
        title: article.title,
        content: article.content,
        similarity: 1.0,
      }, ...allArticles]
    }
  }

  // 1. Añadir artículo citado en la pregunta (máxima prioridad - va primero)
  if (articleFromQuestion) {
    addArticleIfNotExists(articleFromQuestion)
  }

  // 2. Añadir artículo vinculado original
  if (linkedArticle) {
    const alreadyIncluded = allArticles.some(
      a => a.articleNumber === linkedArticle.articleNumber && a.lawShortName === linkedArticle.lawShortName
    )
    if (!alreadyIncluded) {
      allArticles = [{
        id: linkedArticle.id,
        lawId: '',
        lawName: linkedArticle.lawName,
        lawShortName: linkedArticle.lawShortName,
        articleNumber: linkedArticle.articleNumber,
        title: linkedArticle.title,
        content: linkedArticle.content,
        similarity: 1.0,
      }, ...allArticles]
    }
  }

  // 3. Añadir artículo detectado en explicación
  if (articleFromExplanation) {
    addArticleIfNotExists(articleFromExplanation)
  }

  const sources: ArticleSource[] = allArticles.map(a => ({
    lawName: a.lawShortName,
    articleNumber: a.articleNumber,
    title: a.title || undefined,
    relevance: a.similarity,
  }))

  // 4. Actualizar questionAnalysis con los valores DETECTADOS (no el artículo vinculado que es interno)
  // Esto es importante porque el prompt usará estos valores para mostrar "Ley relacionada: X"
  const questionForPrompt: QuestionAnalysis = {
    ...questionAnalysis,
    lawName: effectiveLawName,           // Usar ley detectada (LOTC), no vinculada (CE)
    articleNumber: effectiveArticleNumber, // Usar artículo detectado, no vinculado
  }

  // 5. Generar respuesta con verificación (pasando TODO el contexto)
  // Pasar LOS TRES artículos posibles para que GPT pueda comparar
  const response = await generateVerificationResponse(
    questionForPrompt,
    allArticles,
    context.isPremium,
    input.explanation,
    linkedArticle, // Artículo vinculado en BD
    articleFromExplanation, // Artículo detectado en explicación
    articleFromQuestion // Artículo citado en la pregunta
  )

  // 4. Detectar si hay error
  const errorResult = detectErrorInResponse(response)

  // 5. Crear disputa automática si se detectó error
  let disputeCreated = false
  let disputeResult: DisputeResult | undefined

  if (errorResult.hasError && input.questionId) {
    disputeResult = await createAutoDispute(
      input.questionId,
      response,
      input.userId
    )
    disputeCreated = disputeResult.success && !disputeResult.alreadyExists
  }

  // 6. Construir respuesta final
  let finalResponse = response
  if (disputeCreated) {
    finalResponse += generateDisputeConfirmationMessage(true)
  }

  logger.info('Verification completed', {
    domain: 'verification',
    errorDetected: errorResult.hasError,
    disputeCreated,
    processingTime: Date.now() - startTime,
  })

  return {
    response: finalResponse,
    errorDetected: errorResult.hasError,
    errorDetails: errorResult.hasError ? errorResult : undefined,
    disputeCreated,
    disputeResult,
    sources,
    processingTime: Date.now() - startTime,
  }
}

/**
 * Genera la respuesta de verificación usando OpenAI
 * Recibe hasta 3 artículos de diferentes fuentes para comparar
 */
async function generateVerificationResponse(
  question: QuestionAnalysis,
  articles: Array<{ lawShortName: string; articleNumber: string; title: string | null; content: string | null }>,
  isPremium: boolean,
  ourExplanation?: string,
  linkedArticle?: LinkedArticle | null,
  articleFromExplanation?: ArticleFromExplanation,
  articleFromQuestion?: ArticleFromExplanation
): Promise<string> {
  const openai = await getOpenAI()
  const model = isPremium ? CHAT_MODEL_PREMIUM : CHAT_MODEL

  // Construir el contexto de artículos por embedding
  const articlesContext = articles.length > 0
    ? formatArticlesForContext(articles.map(a => ({
        id: '',
        lawId: '',
        lawName: a.lawShortName,
        lawShortName: a.lawShortName,
        articleNumber: a.articleNumber,
        title: a.title,
        content: a.content,
      })))
    : 'No se encontraron artículos relevantes en la base de datos.'

  // 1. Artículo citado en la PREGUNTA (máxima prioridad)
  let articleFromQuestionSection = ''
  if (articleFromQuestion) {
    articleFromQuestionSection = `
---
🎯 ARTÍCULO CITADO EN LA PREGUNTA (máxima prioridad):
[${articleFromQuestion.lawShortName}] Artículo ${articleFromQuestion.articleNumber}
${articleFromQuestion.title ? `Título: ${articleFromQuestion.title}` : ''}
${articleFromQuestion.content || 'Sin contenido disponible'}
`
  }

  // 2. Artículo vinculado en BD (solo para leyes reales, NO virtuales/informática)
  let linkedArticleSection = ''
  const isVirtual = linkedArticle && isVirtualLaw(linkedArticle.lawShortName)

  if (linkedArticle && !isVirtual) {
    linkedArticleSection = `
---
📌 ARTÍCULO VINCULADO EN BASE DE DATOS:
[${linkedArticle.lawShortName}] Artículo ${linkedArticle.articleNumber}
${linkedArticle.title ? `Título: ${linkedArticle.title}` : ''}
${linkedArticle.content || 'Sin contenido disponible'}
`
  } else if (linkedArticle && isVirtual) {
    // Para leyes virtuales (informática), solo incluir el contenido técnico sin llamarlo "artículo"
    linkedArticleSection = `
---
📚 CONTENIDO TÉCNICO DE REFERENCIA:
[${linkedArticle.lawShortName}] ${linkedArticle.title || `Sección ${linkedArticle.articleNumber}`}
${linkedArticle.content || 'Sin contenido disponible'}
`
    logger.info(`📱 Ley virtual detectada: ${linkedArticle.lawShortName}`, { domain: 'verification' })
  }

  // 3. Artículo detectado en la explicación
  let articleFromExplanationSection = ''
  if (articleFromExplanation) {
    // Solo mostrar si es diferente al vinculado Y diferente al de la pregunta
    const isDifferentFromLinked = !linkedArticle ||
      linkedArticle.articleNumber !== articleFromExplanation.articleNumber ||
      linkedArticle.lawShortName !== articleFromExplanation.lawShortName
    const isDifferentFromQuestion = !articleFromQuestion ||
      articleFromQuestion.articleNumber !== articleFromExplanation.articleNumber ||
      articleFromQuestion.lawShortName !== articleFromExplanation.lawShortName

    if (isDifferentFromLinked && isDifferentFromQuestion) {
      articleFromExplanationSection = `
---
🔍 ARTÍCULO DETECTADO EN LA EXPLICACIÓN:
[${articleFromExplanation.lawShortName}] Artículo ${articleFromExplanation.articleNumber}
${articleFromExplanation.title ? `Título: ${articleFromExplanation.title}` : ''}
${articleFromExplanation.content || 'Sin contenido disponible'}
`
    }
  }

  // Sección de nuestra explicación
  let ourExplanationSection = ''
  if (ourExplanation) {
    ourExplanationSection = `
---
📝 EXPLICACIÓN GUARDADA EN NUESTRA BASE DE DATOS:
${ourExplanation}
`
  }

  // Construir el system prompt (diferente para informática vs derecho)
  const systemPrompt = buildVerificationSystemPrompt(isVirtual)

  // Construir el mensaje del usuario con contexto
  // NOTA: 'question' ya viene con los valores detectados (effectiveLawName, effectiveArticleNumber)
  // desde verifyAnswer(), no los del artículo vinculado
  const questionContext = formatQuestionForPrompt(question)
  const verificationInstructions = generateVerificationContext(question)

  // Determinar instrucciones según el caso
  let analysisInstructions = ''

  // CASO 1: La pregunta cita explícitamente un artículo
  if (articleFromQuestion) {
    // Sub-caso 1a: Pregunta y explicación citan artículos DIFERENTES (posible inconsistencia visible para el usuario)
    // Excepción: si una ley desarrolla a otra (CE→LOTC, Ley→Reglamento) no es inconsistencia
    const hasExplanationArticle = articleFromExplanation && (
      articleFromQuestion.lawShortName !== articleFromExplanation.lawShortName ||
      articleFromQuestion.articleNumber !== articleFromExplanation.articleNumber
    )

    // Leyes que se desarrollan mutuamente (una remite a la otra)
    const RELATED_LAWS: Record<string, string[]> = {
      'CE': ['LOTC', 'LOPJ', 'LOREG', 'LOIEMH'],  // CE remite a estas leyes orgánicas
      'LOTC': ['CE'],
      'LOPJ': ['CE', 'LOPJ'],
      'LOIEMH': ['CE'],
      'LOREG': ['CE'],
    }

    const areLawsRelated = hasExplanationArticle && articleFromExplanation && (
      RELATED_LAWS[articleFromQuestion.lawShortName]?.includes(articleFromExplanation.lawShortName) ||
      RELATED_LAWS[articleFromExplanation.lawShortName]?.includes(articleFromQuestion.lawShortName)
    )

    if (hasExplanationArticle && articleFromExplanation && !areLawsRelated) {
      // Inconsistencia real visible para el usuario
      analysisInstructions = `
---
⚠️ POSIBLE INCONSISTENCIA (pregunta vs explicación):
- PREGUNTA cita: ${articleFromQuestion.lawShortName} art. ${articleFromQuestion.articleNumber}
- EXPLICACIÓN cita: ${articleFromExplanation.lawShortName} art. ${articleFromExplanation.articleNumber}

INSTRUCCIONES:
1. La PREGUNTA tiene prioridad - usa su artículo como referencia principal
2. Verifica si la explicación es correcta o hay error
3. Si la explicación cita un artículo incorrecto, señálalo`
    } else {
      // Pregunta cita artículo, sin inconsistencia o leyes relacionadas
      analysisInstructions = `
---
🎯 ARTÍCULO CITADO EN LA PREGUNTA:
La pregunta menciona explícitamente ${articleFromQuestion.lawShortName} art. ${articleFromQuestion.articleNumber}.
Este es el artículo CORRECTO que debes usar como referencia principal.

INSTRUCCIONES:
1. Usa el ARTÍCULO CITADO EN LA PREGUNTA como fuente principal
2. Basa tu explicación en el contenido de este artículo`
    }
  }
  // CASO 2: Hay artículo en la explicación (puede diferir del vinculado, pero eso es un problema interno)
  // NOTA: El artículo vinculado es para uso INTERNO (categorización/búsqueda). El usuario NUNCA lo ve.
  // Solo le mostramos la explicación, así que usamos el artículo de la explicación sin mencionar discrepancias.
  else if (articleFromExplanation) {
    analysisInstructions = `
---
📚 ARTÍCULO DE REFERENCIA:
${articleFromExplanation.lawShortName} art. ${articleFromExplanation.articleNumber}

INSTRUCCIONES:
1. Usa este artículo como referencia para verificar la respuesta
2. Verifica que la respuesta marcada sea correcta según este artículo
3. Si la respuesta ES correcta, explícala claramente
4. Si la respuesta NO es correcta según el artículo, indica el error`
  }
  // CASO 3: Solo hay artículo vinculado (o contenido técnico para informática)
  else if (linkedArticle) {
    if (isVirtual) {
      // Para leyes virtuales (informática), no mencionar "artículos" legales
      analysisInstructions = `
---
INSTRUCCIONES DE ANÁLISIS:
1. Esta es una pregunta de INFORMÁTICA/TECNOLOGÍA, no de derecho
2. El CONTENIDO TÉCNICO proporcionado es la referencia principal
3. Explica el concepto técnico de forma clara y didáctica
4. NO menciones "artículos" ni "legislación" - esto es contenido técnico`
    } else {
      analysisInstructions = `
---
INSTRUCCIONES DE ANÁLISIS:
1. El ARTÍCULO VINCULADO es la fuente principal
2. Compara la explicación con el artículo
3. Si hay inconsistencias, señálalas`
    }
  }
  // CASO 4: Solo hay artículo detectado en explicación
  else if (articleFromExplanation) {
    analysisInstructions = `
---
INSTRUCCIONES DE ANÁLISIS:
1. Usa el ARTÍCULO DE LA EXPLICACIÓN como referencia
2. Verifica que sea coherente con la pregunta`
  }
  // CASO 5: No hay artículo específico
  else {
    analysisInstructions = `
---
INSTRUCCIONES DE ANÁLISIS:
1. No hay artículo específico vinculado
2. Usa los artículos encontrados por similitud
3. Si falta información, usa tu conocimiento pero acláralo`
  }

  const userMessage = `${questionContext}
${articleFromQuestionSection}
${linkedArticleSection}
${articleFromExplanationSection}
${ourExplanationSection}
${verificationInstructions}

---
ARTÍCULOS ADICIONALES ENCONTRADOS POR SIMILITUD:
${articlesContext}
${analysisInstructions}`

  try {
    const completion = await openai.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      temperature: 0.3,
      max_tokens: 1500,
    })

    return completion.choices[0]?.message?.content || 'No pude generar una verificación.'
  } catch (error) {
    logger.error('Error generating verification response', error, { domain: 'verification' })
    return 'Hubo un error al verificar la respuesta. Por favor, intenta de nuevo.'
  }
}

/**
 * Construye el system prompt para verificación
 * @param isVirtualLaw - Si es true, genera un prompt para informática/tecnología en vez de derecho
 */
function buildVerificationSystemPrompt(isVirtualLaw: boolean = false): string {
  if (isVirtualLaw) {
    // Prompt especial para preguntas de INFORMÁTICA
    return `Eres un tutor experto en informática y tecnología para oposiciones. Tu rol es explicar las respuestas de forma clara, didáctica y amigable.

## 🎯 TU OBJETIVO
Explicar por qué la respuesta correcta es correcta, ayudando al opositor a entender el concepto técnico.

## 📝 FORMATO DE RESPUESTA
Usa formato rico para que sea fácil de leer:
- **Negritas** para conceptos clave y términos técnicos
- Emojis relevantes (✅ ❌ 💻 💡 🖥️ 📊 🎯) para hacer la lectura más amena
- Párrafos cortos y claros
- Listas cuando sea apropiado

## 📋 ESTRUCTURA DE TU RESPUESTA

1. **Respuesta correcta** - Confirma cuál es y por qué
2. **Explicación técnica** - Explica el concepto de forma clara
3. **Consejo práctico** - Si aplica, da un tip para recordarlo
4. **Por qué las otras opciones son incorrectas** (brevemente, opcional)

## ⚠️ SI DETECTAS UN ERROR
Si la respuesta marcada como correcta parece incorrecta:
- Empieza con "⚠️ **Posible error detectado**"
- Explica cuál debería ser la respuesta correcta y por qué
- Sé claro pero respetuoso

## 🎨 EJEMPLO DE FORMATO
✅ **La respuesta correcta es la C**

💻 **Explicación**: La función BUSCARV en Excel busca un valor en la primera columna de una tabla y devuelve el valor de una columna especificada en la misma fila...

💡 **Consejo**: Recuerda que BUSCARV siempre busca de izquierda a derecha, por eso la columna de búsqueda debe estar a la izquierda.

❌ Las otras opciones son incorrectas porque...

## REGLAS IMPORTANTES
- Sé conciso pero completo
- Usa lenguaje cercano y motivador
- NO menciones "artículos" ni "legislación" - esto es contenido TÉCNICO de informática
- NO incluyas sección de "Fuentes" al final
- Enfócate en explicar el concepto técnico de forma práctica`
  }

  // Prompt estándar para preguntas de DERECHO
  return `Eres un tutor experto de oposiciones de derecho administrativo español. Tu rol es explicar las respuestas de forma clara, didáctica y amigable.

## 🎯 TU OBJETIVO
Explicar por qué la respuesta correcta es correcta, de forma que el opositor aprenda y entienda el concepto.

## 📝 FORMATO DE RESPUESTA (MUY IMPORTANTE)
Usa formato rico para que sea fácil de leer:
- **Negritas** para conceptos clave y artículos
- Emojis relevantes (✅ ❌ 📌 💡 ⚖️ 📖 🎯) para hacer la lectura más amena
- Párrafos cortos y claros
- Listas cuando sea apropiado

## 📋 ESTRUCTURA DE TU RESPUESTA

1. **Respuesta correcta** - Confirma cuál es y por qué
2. **Fundamento legal** - Cita el artículo exacto con su contenido relevante
3. **Explicación didáctica** - Explica el concepto de forma sencilla
4. **Por qué las otras opciones son incorrectas** (brevemente, opcional)

## ⚠️ SI DETECTAS UN ERROR
Si la respuesta marcada como correcta NO coincide con la legislación:
- Empieza con "⚠️ **Posible error detectado**"
- Explica qué dice la ley realmente
- Sé claro pero respetuoso

## 🎨 EJEMPLO DE FORMATO
✅ **La respuesta correcta es la B**

📖 Según el **artículo 54 de la Constitución Española**:
> "El Defensor del Pueblo es el alto comisionado de las Cortes Generales..."

💡 **Explicación**: El Defensor del Pueblo actúa como garante de los derechos fundamentales...

❌ Las otras opciones son incorrectas porque...

## REGLAS
- Sé conciso pero completo
- Usa lenguaje cercano y motivador
- NO incluyas sección de "Fuentes" al final (ya se muestran aparte)
- Si no tienes el artículo exacto, usa tu conocimiento pero acláralo`
}

// ============================================
// HELPERS PÚBLICOS
// ============================================

/**
 * Determina si un mensaje del usuario es una solicitud de verificación
 */
export function isVerificationRequest(message: string): boolean {
  const patterns = [
    /está.*(bien|mal|correcto|incorrecto)/i,
    /es.*(correcta?|incorrecta?)/i,
    /verifica/i,
    /comprueba/i,
    /seguro\s+que/i,
    /error\s+en\s+(la\s+)?(pregunta|respuesta)/i,
    /por\s+qu[eé]\s+es/i,
    /explica.*respuesta/i,
    // Mensajes de seguimiento/confirmación
    /(est[aá]s?|estas)\s+segur[oa]/i,  // "estas seguro?", "estás segura?"
    /\bseguro\??$/i,                    // "seguro?"
    /\bde\s+verdad\??/i,                // "de verdad?"
    /\ben\s*serio\??/i,                 // "enserio?", "en serio?"
    /\bes\s+as[ií]\??/i,                // "es así?"
    /\bconfirma/i,                      // "confirma", "confírmame"
    /\bno\s+me\s+lo\s+creo/i,           // "no me lo creo"
    // Mensajes después de responder (usuario quiere explicación)
    /ya\s+(he\s+)?respond/i,            // "ya he respondido", "ya respondí"
    /ahora\s+s[ií]/i,                   // "ahora sí", "ahora si"
    /listo/i,                           // "listo"
    /ya\s+est[aá]/i,                    // "ya está", "ya esta"
    /explic[aá](me|lo)/i,               // "explícame", "explicalo"
    /d[ií]me/i,                         // "dime"
  ]

  return patterns.some(p => p.test(message))
}

/**
 * Normaliza una respuesta a número (0-3)
 * Acepta: número 0-3, string 'A'-'D', string '0'-'3'
 */
function normalizeAnswer(answer: number | string | null | undefined): number | null {
  if (answer === null || answer === undefined) return null

  // Si ya es número válido
  if (typeof answer === 'number' && answer >= 0 && answer <= 3) {
    return answer
  }

  // Si es string letra (A-D)
  if (typeof answer === 'string') {
    const letterMap: Record<string, number> = { 'A': 0, 'B': 1, 'C': 2, 'D': 3 }
    const upper = answer.toUpperCase()
    if (letterMap[upper] !== undefined) {
      return letterMap[upper]
    }

    // Si es string numérico
    const num = parseInt(answer, 10)
    if (!isNaN(num) && num >= 0 && num <= 3) {
      return num
    }
  }

  return null
}

/**
 * Determina si el contexto tiene información de pregunta para verificar
 * NOTA: Ahora también devuelve true si hay pregunta pero no correctAnswer,
 * para poder mostrar un mensaje amigable pidiendo que responda primero
 */
export function hasQuestionToVerify(context: ChatContext): boolean {
  const qc = context.questionContext
  if (!qc) return false

  // Si hay texto de pregunta, podemos manejar la solicitud
  // (aunque sea para decir "responde primero")
  return !!qc.questionText
}

/**
 * Verifica si tenemos la respuesta correcta disponible
 */
export function hasCorrectAnswer(context: ChatContext): boolean {
  const qc = context.questionContext
  if (!qc) return false
  return normalizeAnswer(qc.correctAnswer) !== null
}

/**
 * Extrae los datos de verificación del contexto
 */
export function extractVerificationInput(context: ChatContext): VerificationInput | null {
  const qc = context.questionContext
  if (!qc || !hasQuestionToVerify(context)) {
    return null
  }

  const normalizedCorrect = normalizeAnswer(qc.correctAnswer)
  if (normalizedCorrect === null) {
    return null
  }

  // Normalizar options a array de strings
  let optionsArray: string[] = []
  if (Array.isArray(qc.options)) {
    optionsArray = qc.options
  } else if (qc.options && typeof qc.options === 'object') {
    // Options puede venir como objeto {a, b, c, d} desde el frontend
    const opts = qc.options as { a?: string; b?: string; c?: string; d?: string }
    optionsArray = [opts.a || '', opts.b || '', opts.c || '', opts.d || '']
  }

  return {
    questionId: qc.questionId || qc.id || '',
    questionText: qc.questionText || '',
    options: optionsArray,
    markedCorrect: normalizedCorrect,
    lawName: qc.lawName ?? undefined,
    articleNumber: qc.articleNumber ?? undefined,
    userId: context.userId !== 'anonymous' ? context.userId : undefined,
    explanation: qc.explanation ?? undefined,
  }
}
