import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const EMBEDDING_MODEL = 'text-embedding-3-small'
const FREE_USER_DAILY_LIMIT = 5 // Límite de mensajes diarios para usuarios free

// Contar mensajes del usuario en el día actual
async function getUserDailyMessageCount(userId) {
  if (!userId) return 0

  try {
    // Obtener inicio del día en UTC
    const today = new Date()
    today.setUTCHours(0, 0, 0, 0)

    const { count, error } = await supabase
      .from('ai_chat_logs')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', today.toISOString())
      .eq('had_error', false) // Solo contar mensajes exitosos

    if (error) {
      console.error('Error contando mensajes diarios:', error)
      return 0
    }

    return count || 0
  } catch (err) {
    console.error('Error en getUserDailyMessageCount:', err)
    return 0
  }
}

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

  // Ley 39/2015, LPAC - incluye formas coloquiales como "la 39"
  if (/ley\s*39|39\/2015|lpac|\bla\s+39\b/.test(msgLower)) {
    mentionedLaws.push('Ley 39/2015')
  }

  // Ley 40/2015, LRJSP - incluye formas coloquiales como "la 40"
  if (/ley\s*40|40\/2015|lrjsp|\bla\s+40\b/.test(msgLower)) {
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

// 🆕 Detectar leyes mencionadas en el historial reciente (para mantener contexto)
function detectMentionedLawsFromHistory(history, currentLaws) {
  // Si el mensaje actual ya tiene leyes, usarlas
  if (currentLaws.length > 0) return currentLaws

  // Buscar en los últimos 4 mensajes del historial (2 intercambios)
  const recentHistory = history.slice(-4)

  for (const msg of recentHistory) {
    if (msg.role === 'user') {
      const lawsInMsg = detectMentionedLaws(msg.content)
      if (lawsInMsg.length > 0) {
        console.log(`🔄 Ley detectada en historial: ${lawsInMsg.join(', ')}`)
        return lawsInMsg
      }
    }
  }

  return []
}

// Detectar si el usuario pregunta por estadísticas de exámenes oficiales
function isExamStatsQuery(message) {
  const msgLower = message.toLowerCase()
  // Patrones que indican pregunta sobre qué cae en exámenes:
  // - "artículos que caen/han caído/aparecen en examen"
  // - "examen oficial" + artículos/preguntas
  // - "qué cae/preguntas caen/aparece en examen"
  // - "estadísticas de examen"
  // - "más preguntado"
  // - "que preguntas caen en el examen" (nuevo patrón)
  // - "que cae en el examen"
  return /art[ií]culos?.*(ca[ií]do|caen|aparec|pregunta|examen|oficial)|examen.*oficial.*(art|pregunta)|qu[eé].*preguntas?.*(cae|caen|aparec).*examen|qu[eé].*(cae|caen).*examen|estad[ií]stica.*examen|m[aá]s preguntad|preguntas?.*caen.*examen|(cae|caen).*en.*examen/i.test(msgLower)
}

// Detectar si el usuario menciona "examen" de forma ambigua (sin contexto claro)
function isAmbiguousExamQuery(message) {
  const msgLower = message.toLowerCase()
  // Contiene "examen" pero NO es claramente sobre estadísticas ni preguntas específicas
  const hasExamen = /examen|oposici[oó]n/i.test(msgLower)
  const isExamStats = isExamStatsQuery(message)
  const isSpecificQuestion = /art[ií]culo\s*\d+|pregunta.*\d+/i.test(msgLower)
  const isOposicionInfo = isOposicionInfoQuery(message)

  // Es ambiguo si menciona "examen" pero no encaja en categorías claras
  return hasExamen && !isExamStats && !isSpecificQuestion && !isOposicionInfo
}

// Detectar si el usuario pregunta por su propio progreso/estadísticas
function isUserStatsQuery(message) {
  const msgLower = message.toLowerCase()
  return /mi[s]?\s*(progreso|estad[ií]stica|resultado|fallo|error|acierto|rendimiento|punto.*d[eé]bil|[aá]rea.*d[eé]bil)|qu[eé].*(he\s*fallado|fallo\s*m[aá]s|me\s*cuesta)|d[oó]nde\s*(fallo|tengo.*problema)|c[oó]mo\s*voy|en\s*qu[eé]\s*debo\s*(mejorar|estudiar|repasar)/i.test(msgLower)
}

// Detectar si pregunta por información de la oposición (plazas, fechas, temario, etc.)
function isOposicionInfoQuery(message) {
  const msgLower = message.toLowerCase()
  // Detecta: "cuando es el examen", "examen cuando es", "fecha examen", etc.
  return /cu[aá]ntas?\s*plazas|n[uú]mero.*plazas|plazas\s*(hay|son|convoca)|cu[aá]ndo.*examen|examen.*cu[aá]ndo|fecha.*examen|examen.*fecha|cu[aá]ndo.*inscri|plazo.*inscri|requisitos|t[ií]tulo.*necesit|qu[eé].*necesito|temario|cu[aá]ntos?\s*temas|qu[eé]\s*temas|bloques|sueldo|salario|cu[aá]nto\s*(pagan|gana|cobr)|convocatoria/i.test(msgLower)
}

// Obtener información de la oposición del usuario
async function getOposicionInfo(userOposicion) {
  if (!userOposicion) return null

  try {
    // Mapear userOposicion a nombre en tabla oposiciones
    const oposicionMap = {
      'auxiliar_administrativo_estado': 'Auxiliar Administrativo del Estado',
      'administrativo_estado': 'Cuerpo General Administrativo de la Administración del Estado'
    }

    const oposicionNombre = oposicionMap[userOposicion]
    if (!oposicionNombre) return null

    // Buscar en tabla oposiciones
    const { data: oposicion } = await supabase
      .from('oposiciones')
      .select('*')
      .ilike('nombre', `%${oposicionNombre.split(' ')[0]}%`)
      .eq('is_active', true)
      .limit(1)
      .single()

    if (!oposicion) {
      // Buscar de forma más flexible
      const searchTerm = userOposicion.includes('auxiliar') ? 'Auxiliar' : 'Administrativo'
      const { data: oposicionAlt } = await supabase
        .from('oposiciones')
        .select('*')
        .ilike('nombre', `%${searchTerm}%`)
        .eq('is_active', true)
        .limit(1)
        .single()

      return oposicionAlt
    }

    return oposicion
  } catch (err) {
    console.error('Error obteniendo info de oposición:', err)
    return null
  }
}

// Obtener temario de la oposición
async function getTemario(userOposicion, limit = 30) {
  if (!userOposicion) return null

  try {
    const positionType = OPOSICION_TO_POSITION_TYPE[userOposicion]
    if (!positionType) return null

    const { data: topics } = await supabase
      .from('topics')
      .select('id, name, description, bloque, order_index')
      .eq('position_type', positionType)
      .order('bloque', { ascending: true })
      .order('order_index', { ascending: true })
      .limit(limit)

    return topics || []
  } catch (err) {
    console.error('Error obteniendo temario:', err)
    return []
  }
}

// Detectar mención de oposición en el mensaje
function detectOposicion(message) {
  const msgLower = message.toLowerCase()

  // Auxiliar administrativo (C2)
  if (/auxiliar|c2\b/i.test(msgLower)) {
    return 'auxiliar_administrativo'
  }

  // Administrativo (C1)
  if (/\badministrativo\b(?!.*auxiliar)|c1\b/i.test(msgLower)) {
    return 'administrativo'
  }

  return null
}

// Obtener estadísticas de artículos más preguntados en exámenes oficiales
// Puede filtrar por ley (lawShortName) o por oposición (examPosition)
// Relación: questions -> articles (via primary_article_id) -> laws (via law_id)
async function getExamStats(lawShortName = null, limit = 15, examPosition = null) {
  try {
    // Buscar preguntas de exámenes oficiales con join a través de articles
    let query = supabase
      .from('questions')
      .select(`
        id,
        exam_position,
        article:articles!primary_article_id(
          id,
          article_number,
          law:laws!inner(id, short_name, name)
        )
      `)
      .eq('is_active', true)
      .eq('is_official_exam', true)
      .not('primary_article_id', 'is', null)

    // Filtrar por oposición si se especifica
    if (examPosition) {
      query = query.eq('exam_position', examPosition)
    }

    const { data: questions, error } = await query

    if (error || !questions?.length) {
      console.log('No se encontraron preguntas de exámenes oficiales:', error?.message)
      return null
    }

    // Filtrar por ley si se especifica (después del query porque el filtro nested es complejo)
    let filteredQuestions = questions
    if (lawShortName) {
      filteredQuestions = questions.filter(q =>
        q.article?.law?.short_name === lawShortName
      )
    }

    if (filteredQuestions.length === 0) {
      console.log('No hay preguntas para el filtro especificado')
      return null
    }

    // Contar apariciones por artículo, incluyendo desglose por oposición
    const articleCounts = {}
    filteredQuestions.forEach(q => {
      const law = q.article?.law?.short_name || q.article?.law?.name || 'Ley'
      const artNum = q.article?.article_number
      if (!artNum) return

      const key = `${law} Art. ${artNum}`
      if (!articleCounts[key]) {
        articleCounts[key] = {
          law,
          article: artNum,
          count: 0,
          byPosition: {} // Desglose por oposición
        }
      }
      articleCounts[key].count++

      // Registrar por oposición
      const pos = q.exam_position || 'sin_especificar'
      if (!articleCounts[key].byPosition[pos]) {
        articleCounts[key].byPosition[pos] = 0
      }
      articleCounts[key].byPosition[pos]++
    })

    // Ordenar por frecuencia y devolver top
    const sorted = Object.values(articleCounts)
      .sort((a, b) => b.count - a.count)
      .slice(0, limit)

    return {
      totalOfficialQuestions: filteredQuestions.length,
      topArticles: sorted,
      lawFilter: lawShortName,
      positionFilter: examPosition
    }
  } catch (err) {
    console.error('Error obteniendo estadísticas de exámenes:', err)
    return null
  }
}

// Obtener estadísticas del usuario (artículos fallados, áreas débiles)
async function getUserStats(userId, lawShortName = null, limit = 10) {
  if (!userId) return null

  try {
    // Obtener respuestas del usuario con info de pregunta y ley
    let query = supabase
      .from('detailed_answers')
      .select(`
        is_correct,
        question:questions!inner(
          id,
          article_number,
          law:laws(id, short_name, name)
        )
      `)
      .eq('user_id', userId)
      .not('question.article_number', 'is', null)

    const { data: answers, error } = await query

    if (error || !answers?.length) {
      console.log('No se encontraron respuestas del usuario:', error?.message)
      return null
    }

    // Filtrar por ley si se especifica
    let filteredAnswers = answers
    if (lawShortName) {
      filteredAnswers = answers.filter(a =>
        a.question?.law?.short_name === lawShortName
      )
    }

    // Agrupar por artículo
    const articleStats = {}
    filteredAnswers.forEach(a => {
      const law = a.question?.law?.short_name || a.question?.law?.name || 'Ley'
      const article = a.question?.article_number
      if (!article) return

      const key = `${law} Art. ${article}`
      if (!articleStats[key]) {
        articleStats[key] = {
          law,
          article,
          total: 0,
          correct: 0,
          failed: 0
        }
      }
      articleStats[key].total++
      if (a.is_correct) {
        articleStats[key].correct++
      } else {
        articleStats[key].failed++
      }
    })

    // Calcular porcentaje de acierto y ordenar por más fallados
    const withPercentage = Object.values(articleStats).map(s => ({
      ...s,
      accuracy: s.total > 0 ? Math.round((s.correct / s.total) * 100) : 0
    }))

    // Artículos más fallados (ordenados por número de fallos)
    const mostFailed = [...withPercentage]
      .filter(s => s.failed > 0)
      .sort((a, b) => b.failed - a.failed)
      .slice(0, limit)

    // Artículos con peor porcentaje (mínimo 2 intentos)
    const worstAccuracy = [...withPercentage]
      .filter(s => s.total >= 2)
      .sort((a, b) => a.accuracy - b.accuracy)
      .slice(0, limit)

    // Estadísticas generales
    const totalAnswers = filteredAnswers.length
    const totalCorrect = filteredAnswers.filter(a => a.is_correct).length
    const overallAccuracy = totalAnswers > 0 ? Math.round((totalCorrect / totalAnswers) * 100) : 0

    return {
      totalAnswers,
      totalCorrect,
      totalFailed: totalAnswers - totalCorrect,
      overallAccuracy,
      mostFailed,
      worstAccuracy,
      lawFilter: lawShortName
    }
  } catch (err) {
    console.error('Error obteniendo estadísticas del usuario:', err)
    return null
  }
}

// 🆕 Buscar artículos DIRECTAMENTE de una ley específica (con filtro opcional por keywords)
// searchTerms: palabras clave para buscar dentro del contenido (opcional)
async function searchArticlesByLawDirect(lawShortName, limit = 15, searchTerms = null) {
  // Primero buscar el ID de la ley
  const { data: law, error: lawError } = await supabase
    .from('laws')
    .select('id, short_name, name, is_derogated')
    .eq('short_name', lawShortName)
    .single()

  if (lawError || !law) {
    console.log(`⚠️ Ley no encontrada: ${lawShortName}`)
    return []
  }

  if (law.is_derogated) {
    console.log(`🚫 Ley derogada: ${lawShortName}`)
    return []
  }

  let query = supabase
    .from('articles')
    .select('id, law_id, article_number, title, content')
    .eq('law_id', law.id)
    .eq('is_active', true)

  // Si hay términos de búsqueda, filtrar por ellos
  if (searchTerms && searchTerms.length > 0) {
    // Buscar artículos que contengan ALGUNO de los términos en título o contenido
    const orConditions = searchTerms.map(term =>
      `title.ilike.%${term}%,content.ilike.%${term}%`
    ).join(',')
    query = query.or(orConditions)
    console.log(`🔍 Buscando en ${lawShortName} con términos: ${searchTerms.join(', ')}`)
  }

  const { data: articles, error } = await query
    .order('article_number', { ascending: true })
    .limit(limit)

  if (error || !articles) {
    console.error('Error buscando artículos directamente:', error)
    return []
  }

  console.log(`📚 Búsqueda directa: ${articles.length} artículos de ${lawShortName}`)

  // Formatear como los resultados de la búsqueda semántica
  return articles.map(a => ({
    ...a,
    law_short_name: law.short_name,
    law_name: law.name,
    law: { short_name: law.short_name, name: law.name }, // Para compatibilidad
    similarity: 1.0 // Máxima relevancia porque es exactamente lo que pidió
  }))
}

// Extraer términos de búsqueda relevantes del mensaje del usuario
function extractSearchTerms(message) {
  const msgLower = message.toLowerCase()

  // Palabras clave legales que buscar
  const legalKeywords = [
    'plazo', 'plazos', 'término', 'termino', 'días', 'dias',
    'silencio', 'administrativo', 'positivo', 'negativo',
    'recurso', 'recursos', 'alzada', 'reposición', 'reposicion',
    'notificación', 'notificacion', 'notificar',
    'procedimiento', 'procedimientos',
    'delegación', 'delegacion', 'competencia', 'competencias', 'avocación', 'avocacion',
    'órgano', 'organo', 'colegiado', 'colegiados',
    'convenio', 'convenios', 'acuerdo', 'acuerdos',
    'responsabilidad', 'patrimonial',
    'sanción', 'sancion', 'sanciones', 'sancionador',
    'interesado', 'interesados',
    'resolución', 'resolucion', 'resolver',
    'subsanación', 'subsanacion', 'subsanar',
    'alegación', 'alegacion', 'alegaciones',
    'audiencia', 'trámite', 'tramite',
    'caducidad', 'prescripción', 'prescripcion',
    'nulidad', 'anulabilidad', 'revisión', 'revision',
    'ejecución', 'ejecutivo', 'ejecutiva'
  ]

  // Encontrar qué keywords aparecen en el mensaje
  const foundTerms = legalKeywords.filter(keyword => msgLower.includes(keyword))

  // Si no encontró keywords específicos, devolver null para no filtrar
  if (foundTerms.length === 0) {
    return null
  }

  // Devolver los términos únicos encontrados (máximo 5)
  return [...new Set(foundTerms)].slice(0, 5)
}

// Detectar si es una consulta genérica sobre una ley (sin pregunta específica)
// Una consulta es genérica si SOLO menciona la ley sin especificar qué aspecto
// lawFromHistory: true si la ley se detectó del historial (respuesta de seguimiento)
function isGenericLawQuery(message, mentionedLaws, lawFromHistory = false) {
  if (mentionedLaws.length === 0) return false

  // 🆕 Si la ley viene del historial (es una respuesta de seguimiento como "plazos"),
  // NO es genérica - el usuario está respondiendo a nuestra pregunta
  if (lawFromHistory) {
    console.log('📋 Ley del historial - tratando como consulta específica de seguimiento')
    return false
  }

  const msgLower = message.toLowerCase().trim()

  // Si el mensaje es largo (>30 chars), probablemente tiene contexto específico
  if (message.length > 30) {
    const wordsWithoutLaw = msgLower
      .replace(/ley\s*\d+\/?\d*/g, '')
      .replace(/\bla\s+\d+\b/g, '')
      .trim()
      .split(/\s+/)
      .filter(w => w.length > 2)

    if (wordsWithoutLaw.length >= 2) {
      return false
    }
  }

  // Solo es genérica si el mensaje ES la mención de la ley sin nada más
  // Ej: "Ley 40/2015" (13 chars), "la 40" (5 chars)
  if (message.length < 18) return true

  // Patrones de consultas verdaderamente genéricas
  const genericPatterns = [
    /^(que|qué|cual|cuál)\s+(es|son)\s+(la|el)?\s*(ley|l)\s*\d/i,
    /^(explica|explícame|explicame)\s+(la|el)?\s*(ley|l)\s*\d/i,
    /^resumen\s+(de)?\s*(la|el)?\s*(ley|l)\s*\d/i,
    /^info(rmación)?\s*(de|sobre)?\s*(la|el)?\s*(ley|l)\s*\d/i
  ]

  return genericPatterns.some(p => p.test(message))
}

// Buscar artículos por similitud semántica (solo leyes vigentes)
// priorityLawIds: IDs de leyes de la oposición del usuario para priorizar
// mentionedLawNames: nombres de leyes mencionadas explícitamente en la pregunta (filtro estricto)
// contextLawName: ley del contexto de pregunta (prioriza pero NO filtra)
async function searchArticlesBySimilarity(embedding, limit = 10, priorityLawIds = [], mentionedLawNames = [], contextLawName = null) {
  // 🆕 Si hay leyes mencionadas, pedir MUCHOS más resultados porque filtraremos después
  // El problema: si el usuario pregunta "plazos de la 40", el embedding puede ser más similar
  // a artículos de otras leyes, así que necesitamos más resultados antes de filtrar
  const multiplier = mentionedLawNames.length > 0 ? 15 : 4

  const { data: articles, error } = await supabase.rpc('match_articles', {
    query_embedding: embedding,
    match_threshold: 0.2, // 🆕 Threshold más bajo para capturar más artículos relevantes
    match_count: limit * multiplier // Más resultados cuando hay ley específica
  })

  console.log(`🔍 match_articles: threshold=0.2, count=${limit * multiplier}, results=${articles?.length || 0}`)

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
      // 🆕 FIX: Si no encontró artículos de la ley mencionada, devolver vacío
      // (NO devolver artículos de otras leyes porque confunde al usuario)
      console.log(`⚠️ No se encontraron artículos de las leyes mencionadas: ${mentionedLawNames.join(', ')} - devolviendo vacío`)
      return [] // Forzar búsqueda directa como fallback
    }
  }

  // 🎯 Si hay ley del contexto de pregunta, PRIORIZAR (no filtrar) sus artículos
  let finalArticles = validArticles
  if (contextLawName && mentionedLawNames.length === 0) {
    const contextArticles = validArticles.filter(a => {
      const law = lawMap[a.law_id]
      return law?.short_name === contextLawName
    })
    const otherArticles = validArticles.filter(a => {
      const law = lawMap[a.law_id]
      return law?.short_name !== contextLawName
    })

    // Priorizar artículos de la ley del contexto (70%) pero incluir otros (30%)
    const numContext = Math.min(contextArticles.length, Math.ceil(limit * 0.7))
    const numOther = limit - numContext

    finalArticles = [
      ...contextArticles.slice(0, numContext),
      ...otherArticles.slice(0, numOther)
    ]

    if (contextArticles.length > 0) {
      console.log(`📋 Priorizando ${numContext} artículos de ${contextLawName} (ley del contexto)`)
    }
  }
  // Si hay leyes prioritarias (de la oposición) y no hay contexto de ley, reordenar
  else if (priorityLawIds.length > 0 && mentionedLawNames.length === 0) {
    const prioritySet = new Set(priorityLawIds)
    const priorityArticles = validArticles.filter(a => prioritySet.has(a.law_id))
    const otherArticles = validArticles.filter(a => !prioritySet.has(a.law_id))

    const numPriority = Math.min(priorityArticles.length, Math.ceil(limit * 0.7))
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

// Generar system prompt para psicotécnicos
function generatePsicotecnicoSystemPrompt(questionContextText) {
  return `Eres Nila AI, la asistente de inteligencia artificial de Vence, una plataforma de preparación para oposiciones en España.

SOBRE TI:
- Te llamas Nila AI y eres la asistente de IA de Vence
- Eres una tutora especializada en tests psicotécnicos para oposiciones
- Ayudas a los usuarios a resolver y entender ejercicios de razonamiento lógico, series numéricas, gráficos, tablas, etc.

ESTILO DE INTERACCIÓN:
- Sé claro y didáctico al explicar la lógica detrás de cada ejercicio
- Usa ejemplos paso a paso cuando sea necesario
- Si hay datos numéricos o gráficos, analízalos con precisión
- Explica los patrones y estrategias para resolver este tipo de ejercicios

INSTRUCCIONES:
- Responde de forma concisa pero completa
- Basa tus respuestas en los datos proporcionados en el contexto de la pregunta
- Si hay valores numéricos (gráficos, tablas, series), utilízalos para dar respuestas precisas
- NO inventes datos que no estén en el contexto
- Muestra el razonamiento paso a paso para que el usuario aprenda
- NO generes nuevas preguntas de test. Si el usuario pide más ejercicios, dile que puede usar el botón de "Siguiente pregunta" en el test
${questionContextText}`
}

// Generar el system prompt
function generateSystemPrompt(context, questionContextText, userOposicion) {
  const oposicionInfo = userOposicion
    ? `El usuario está preparando la oposición de ${userOposicion.replace(/_/g, ' ')}.`
    : ''

  return `Eres Nila AI, la asistente de inteligencia artificial de Vence, una plataforma de preparación para oposiciones en España.

SOBRE TI:
- Te llamas Nila AI y eres la asistente de IA de Vence
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

INSTRUCCIONES CRÍTICAS:
- USA TODOS los artículos del CONTEXTO de abajo para elaborar tu respuesta
- Tienes acceso a múltiples artículos relevantes - úsalos TODOS, no solo 2-3
- NUNCA inventes números de artículos ni cites artículos que no estén en el contexto
- Cita los artículos así: "Según el Art. X de [Ley]..."
- Si el contexto tiene muchos artículos, organízalos por tema y explica cada uno brevemente
- NO uses tu conocimiento general de leyes españolas - SOLO el contexto proporcionado
- Si preguntan sobre ti, explica que eres el asistente de Vence con acceso a 176 leyes españolas
- Si la pregunta no está relacionada con oposiciones o legislación, indica educadamente que solo puedes ayudar con esos temas
- NUNCA generes tests ni cuestionarios. Si piden un test, dile que use el botón "¿Te preparo un test?"
${questionContextText}
CONTEXTO (artículos relevantes encontrados en la base de datos):
${context}`
}

// Generar sugerencias de seguimiento basadas en la respuesta
function generateFollowUpSuggestions(sources, response, questionContext, queryType = null, mentionedLaw = null) {
  // Obtener las leyes únicas con su nombre completo
  const lawMap = {}
  sources.forEach(s => {
    if (s.law && !lawMap[s.law]) {
      lawMap[s.law] = {
        shortName: s.law,
        name: s.lawName || s.law // Nombre completo o fallback al short
      }
    }
  })
  const lawsInSources = Object.values(lawMap)

  // No mostrar sugerencias cuando se pide clarificación (consulta ambigua o genérica sobre leyes)
  if (queryType === 'ambiguous_exam' || queryType === 'oposicion_info' || queryType === 'generic_law_query') {
    return {
      offerTest: false,
      laws: [],
      followUpQuestions: []
    }
  }

  // Sugerencias específicas para consultas de exámenes
  if (queryType === 'exam_stats') {
    return {
      offerTest: false,
      laws: lawsInSources,
      followUpQuestions: [
        {
          text: '¿Cómo voy yo en esos artículos?',
          label: 'mi_progreso_articulos'
        },
        {
          text: '¿Cuáles de esos debería repasar?',
          label: 'que_repasar_examen'
        },
        {
          text: mentionedLaw ? `Prepárame un test de ${mentionedLaw}` : 'Prepárame un test con esos artículos',
          label: 'test_articulos_examen'
        }
      ]
    }
  }

  // Sugerencias específicas para consultas de progreso del usuario
  if (queryType === 'user_stats') {
    return {
      offerTest: false,
      laws: lawsInSources,
      followUpQuestions: [
        {
          text: '¿Qué artículos caen más en examen de esas leyes?',
          label: 'articulos_examen_debiles'
        },
        {
          text: 'Dame un plan de estudio para mejorar',
          label: 'plan_estudio'
        },
        {
          text: 'Prepárame un test con mis puntos débiles',
          label: 'test_puntos_debiles'
        }
      ]
    }
  }

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
      suggestionUsed = null,
      isPremium = false
    } = await request.json()

    if (!message || typeof message !== 'string') {
      return Response.json({
        success: false,
        error: 'Se requiere un mensaje'
      }, { status: 400 })
    }

    // 🔒 Verificar límite diario para usuarios free
    if (!isPremium && userId) {
      const dailyCount = await getUserDailyMessageCount(userId)
      console.log(`📊 Usuario ${userId}: ${dailyCount}/${FREE_USER_DAILY_LIMIT} mensajes hoy (isPremium: ${isPremium})`)

      if (dailyCount >= FREE_USER_DAILY_LIMIT) {
        return Response.json({
          success: false,
          error: 'daily_limit_reached',
          limitReached: true,
          dailyCount,
          limit: FREE_USER_DAILY_LIMIT,
          message: `Has alcanzado el límite de ${FREE_USER_DAILY_LIMIT} consultas diarias del chat de IA.`
        }, { status: 429 })
      }
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

    // 🎯 Detectar si es una pregunta de psicotécnico (no necesita búsqueda de artículos)
    const isPsicotecnico = questionContext?.isPsicotecnico === true

    // 🎯 Detectar menciones de leyes específicas en el mensaje
    // 🆕 Si no hay en el mensaje actual, buscar en el historial reciente (mantener contexto)
    let mentionedLaws = isPsicotecnico ? [] : detectMentionedLaws(message)
    let lawFromHistory = false // 🆕 Flag para saber si la ley vino del historial

    if (mentionedLaws.length === 0 && !isPsicotecnico) {
      mentionedLaws = detectMentionedLawsFromHistory(history, mentionedLaws)
      if (mentionedLaws.length > 0) {
        lawFromHistory = true // La ley se detectó del historial, es una respuesta de seguimiento
        console.log(`📋 Ley del historial: ${mentionedLaws.join(', ')}`)
      }
    }

    // 🎯 Si hay contexto de pregunta con ley, guardarla para priorizar (NO filtrar)
    let contextLawName = null
    if (questionContext?.lawName && !isPsicotecnico) {
      const contextLaw = questionContext.lawName
      // Mapear nombres comunes a short_name de la BD
      const lawMapping = {
        'Constitución Española': 'CE',
        'CE': 'CE',
        'Ley 39/2015': 'Ley 39/2015',
        'LPAC': 'Ley 39/2015',
        'Ley 40/2015': 'Ley 40/2015',
        'LRJSP': 'Ley 40/2015',
        'TREBEP': 'TREBEP',
        'EBEP': 'TREBEP'
      }
      contextLawName = lawMapping[contextLaw] || contextLaw
      console.log(`📋 Ley del contexto de pregunta: ${contextLawName} (para priorizar, no filtrar)`)
    }

    if (mentionedLaws.length > 0) {
      console.log(`🔍 Leyes mencionadas explícitamente: ${mentionedLaws.join(', ')}`)
    }

    // 📊 Detectar si pregunta por estadísticas de exámenes oficiales
    let examStatsContext = ''
    let queryType = null // Para sugerencias de seguimiento
    let queryLaw = null // Ley mencionada para sugerencias

    if (isExamStatsQuery(message) && !isPsicotecnico) {
      console.log('📊 Detectada pregunta sobre estadísticas de exámenes')
      const lawForStats = mentionedLaws.length > 0 ? mentionedLaws[0] : null
      // Detectar oposición del mensaje, o usar la del perfil del usuario como fallback
      let oposicionForStats = detectOposicion(message)

      // Si no especificó oposición en el mensaje pero tiene una en su perfil, usarla
      if (!oposicionForStats && userOposicion) {
        // Mapear el formato de userOposicion al formato de exam_position
        const oposicionMap = {
          'auxiliar_administrativo_estado': 'auxiliar_administrativo',
          'administrativo_estado': 'administrativo'
        }
        oposicionForStats = oposicionMap[userOposicion] || null
        if (oposicionForStats) {
          console.log(`📊 Usando oposición del perfil del usuario: ${userOposicion} -> ${oposicionForStats}`)
        }
      }

      queryType = 'exam_stats'
      queryLaw = lawForStats

      // Si NO especifica ley Y NO tiene oposición (ni en mensaje ni en perfil), preguntar
      if (!lawForStats && !oposicionForStats) {
        console.log('📊 No se especificó ley ni oposición y usuario sin perfil - pidiendo clarificación')
        examStatsContext = `

PREGUNTA SOBRE EXÁMENES OFICIALES SIN ESPECIFICAR:
El usuario quiere saber qué cae en el examen pero no ha especificado de qué ley o qué oposición.
NOTA: Este usuario NO tiene oposición configurada en su perfil.

DEBES PREGUNTAR para poder dar información precisa. Responde así:

"¡Claro! Tengo acceso a las preguntas de exámenes oficiales reales. Para darte la información más útil, ¿de qué te gustaría ver las estadísticas?

**Por oposición:**
• Auxiliar Administrativo (C2)
• Administrativo del Estado (C1)

**Por ley específica:**
• Constitución Española (CE)
• Ley 39/2015 (LPAC)
• Ley 40/2015 (LRJSP)
• TREBEP

Dime cuál prefieres y te muestro los artículos más preguntados."

NO inventes datos. PREGUNTA PRIMERO qué quiere el usuario.
`
      } else {
        // Tiene filtro, buscar datos
        const stats = await getExamStats(lawForStats, 15, oposicionForStats)

        if (stats && stats.topArticles.length > 0) {
          // Determinar si la oposición vino del perfil o del mensaje
          const oposicionFromProfile = !detectOposicion(message) && userOposicion
          const oposicionName = oposicionForStats === 'auxiliar_administrativo'
            ? 'Auxiliar Administrativo (C2)'
            : 'Administrativo del Estado (C1)'

          const filterText = lawForStats
            ? `Ley: ${lawForStats}`
            : oposicionForStats
              ? `Oposición: ${oposicionName}${oposicionFromProfile ? ' (detectada de tu perfil)' : ''}`
              : 'Todas las leyes'

          // Formatear artículos con desglose por oposición
          const formatArticle = (a, i) => {
            let line = `${i + 1}. ${a.law} Art. ${a.article} - ${a.count} apariciones`
            // Añadir desglose si hay múltiples oposiciones
            if (a.byPosition && Object.keys(a.byPosition).length > 0) {
              const posNames = {
                'auxiliar_administrativo': 'Aux.C2',
                'administrativo': 'Admin.C1',
                'sin_especificar': 'otro'
              }
              const breakdown = Object.entries(a.byPosition)
                .filter(([k, v]) => v > 0)
                .map(([k, v]) => `${posNames[k] || k}: ${v}`)
                .join(', ')
              if (breakdown) line += ` (${breakdown})`
            }
            return line
          }

          // Instrucción especial si usamos oposición del perfil
          const profileInstruction = oposicionFromProfile
            ? `
IMPORTANTE - PERSONALIZACIÓN:
El usuario tiene configurado en su perfil que está preparando "${oposicionName}".
DEBES mencionar esto al principio de tu respuesta para demostrar que conoces su perfil.
Ejemplo: "Como estás preparando ${oposicionName}, te muestro los artículos más preguntados en esos exámenes oficiales..."
`
            : ''

          examStatsContext = `

DATOS DE EXÁMENES OFICIALES EN LA BASE DE DATOS:
${filterText}
Total de preguntas de exámenes oficiales: ${stats.totalOfficialQuestions}

ARTÍCULOS MÁS PREGUNTADOS EN EXÁMENES OFICIALES:
${stats.topArticles.map(formatArticle).join('\n')}
${profileInstruction}
IMPORTANTE: Estos datos son REALES de nuestra base de datos de preguntas de exámenes oficiales.
- "Aux.C2" = Auxiliar Administrativo del Estado (C2)
- "Admin.C1" = Administrativo del Estado (C1)
Responde con esta información de forma clara y útil. Puedes sugerir que el usuario pregunte sobre su progreso personal en estos artículos o que prepare un test con estos temas.
`
          console.log(`📊 Encontradas ${stats.totalOfficialQuestions} preguntas oficiales, top ${stats.topArticles.length} artículos`)
        }
      }
    }

    // ❓ Detectar consulta ambigua sobre "examen" (necesita clarificación)
    let ambiguousExamContext = ''
    if (isAmbiguousExamQuery(message) && !isPsicotecnico && !examStatsContext) {
      console.log('❓ Detectada consulta ambigua sobre examen - la IA pedirá clarificación')
      queryType = 'ambiguous_exam' // Para no mostrar sugerencias de seguimiento
      ambiguousExamContext = `

CONSULTA AMBIGUA SOBRE EXAMEN:
El usuario ha mencionado "examen" pero no está claro qué necesita.
DEBES PREGUNTAR para clarificar qué necesita. Usa esta estructura:

"¿A qué te refieres exactamente? Puedo ayudarte con:
• **Qué cae en el examen** - Te muestro los artículos más preguntados en exámenes oficiales de oposiciones
• **Tu progreso personal** - Cómo vas tú en esos temas según tus tests
• **Explicación de un tema** - Resolver dudas sobre legislación específica

¿Cuál de estas opciones te interesa?"

NO respondas con información genérica sobre exámenes. PREGUNTA PRIMERO.
`
    }

    // 👤 Detectar si pregunta por su propio progreso/estadísticas
    let userStatsContext = ''
    if (isUserStatsQuery(message) && userId && !isPsicotecnico) {
      console.log('👤 Detectada pregunta sobre progreso del usuario')
      const lawForStats = mentionedLaws.length > 0 ? mentionedLaws[0] : null
      queryType = 'user_stats'
      queryLaw = lawForStats
      const userStats = await getUserStats(userId, lawForStats, 10)

      if (userStats) {
        userStatsContext = `

ESTADÍSTICAS PERSONALES DEL USUARIO:
${lawForStats ? `Filtrando por: ${lawForStats}` : 'Todas las leyes'}
- Total de preguntas respondidas: ${userStats.totalAnswers}
- Respuestas correctas: ${userStats.totalCorrect}
- Respuestas falladas: ${userStats.totalFailed}
- Porcentaje de acierto general: ${userStats.overallAccuracy}%

${userStats.mostFailed.length > 0 ? `ARTÍCULOS MÁS FALLADOS (donde más necesita mejorar):
${userStats.mostFailed.map((a, i) => `${i + 1}. ${a.law} Art. ${a.article} - ${a.failed} fallos de ${a.total} intentos (${a.accuracy}% acierto)`).join('\n')}` : 'No hay artículos con fallos registrados.'}

${userStats.worstAccuracy.length > 0 ? `ARTÍCULOS CON PEOR PORCENTAJE DE ACIERTO:
${userStats.worstAccuracy.map((a, i) => `${i + 1}. ${a.law} Art. ${a.article} - ${a.accuracy}% acierto (${a.correct}/${a.total})`).join('\n')}` : ''}

IMPORTANTE: Estos son los datos REALES del usuario. Personaliza tu respuesta con estos datos.
Da recomendaciones específicas basadas en sus puntos débiles.
`
        console.log(`👤 Usuario tiene ${userStats.totalAnswers} respuestas, ${userStats.mostFailed.length} artículos fallados`)
      }
    }

    // 📋 Detectar si pregunta por información de la oposición (plazas, fechas, temario, etc.)
    let oposicionInfoContext = ''
    if (isOposicionInfoQuery(message) && !isPsicotecnico) {
      console.log('📋 Detectada pregunta sobre información de la oposición')
      queryType = 'oposicion_info' // Siempre setear para evitar sugerencias de test

      if (userOposicion) {
        // Usuario tiene oposición en su perfil - dar info directamente
        const oposicionInfo = await getOposicionInfo(userOposicion)
        const temario = await getTemario(userOposicion, 30)

        // Formatear nombre de oposición para mostrar
        const oposicionNombre = userOposicion === 'auxiliar_administrativo_estado'
          ? 'Auxiliar Administrativo del Estado (C2)'
          : 'Administrativo del Estado (C1)'

        let infoText = `\n\nINFORMACIÓN DE LA OPOSICIÓN DEL USUARIO: ${oposicionNombre}\n`

        if (oposicionInfo) {
          infoText += `\nDATOS DE LA CONVOCATORIA:`
          if (oposicionInfo.plazas_libres) infoText += `\n- Plazas (acceso libre): ${oposicionInfo.plazas_libres}`
          if (oposicionInfo.plazas_promocion_interna) infoText += `\n- Plazas (promoción interna): ${oposicionInfo.plazas_promocion_interna}`
          if (oposicionInfo.plazas_discapacidad) infoText += `\n- Plazas (discapacidad): ${oposicionInfo.plazas_discapacidad}`
          if (oposicionInfo.exam_date) infoText += `\n- Fecha de examen: ${oposicionInfo.exam_date}`
          if (oposicionInfo.inscription_start) infoText += `\n- Inicio inscripción: ${oposicionInfo.inscription_start}`
          if (oposicionInfo.inscription_deadline) infoText += `\n- Fin inscripción: ${oposicionInfo.inscription_deadline}`
          if (oposicionInfo.titulo_requerido) infoText += `\n- Titulación requerida: ${oposicionInfo.titulo_requerido}`
          if (oposicionInfo.salario_min || oposicionInfo.salario_max) {
            infoText += `\n- Salario aproximado: ${oposicionInfo.salario_min || '?'}€ - ${oposicionInfo.salario_max || '?'}€ brutos/año`
          }
          if (oposicionInfo.is_convocatoria_activa) {
            infoText += `\n- Estado: CONVOCATORIA ACTIVA`
          }
          if (oposicionInfo.boe_reference) infoText += `\n- Referencia BOE: ${oposicionInfo.boe_reference}`
        }

        if (temario && temario.length > 0) {
          infoText += `\n\nTEMARIO (${temario.length} temas):`
          // Agrupar por bloque
          const byBloque = {}
          temario.forEach(t => {
            const bloque = t.bloque || 'General'
            if (!byBloque[bloque]) byBloque[bloque] = []
            byBloque[bloque].push(t)
          })
          Object.entries(byBloque).forEach(([bloque, temas]) => {
            infoText += `\n\nBloque ${bloque}:`
            temas.forEach(t => {
              infoText += `\n  - ${t.name}`
            })
          })
        }

        infoText += `\n\nIMPORTANTE: Esta información es de nuestra base de datos. Si algún dato no está disponible, indica que el usuario puede consultar el BOE oficial para información actualizada.`

        oposicionInfoContext = infoText
        console.log('📋 Información de oposición cargada')
      } else {
        // Usuario SIN oposición en su perfil - pedir que especifique
        oposicionInfoContext = `

CONSULTA SOBRE INFORMACIÓN DE OPOSICIÓN (sin perfil configurado):
El usuario pregunta sobre fechas, plazas o información de una oposición pero NO tiene configurada su oposición en su perfil.
Responde amablemente preguntando qué oposición le interesa. Por ejemplo:
"Para darte información precisa sobre fechas y plazas, ¿me puedes decir qué oposición te interesa? Por ejemplo: Auxiliar Administrativo del Estado (C2) o Administrativo del Estado (C1)."
NO inventes fechas ni datos. Solo pregunta cuál oposición.
`
        console.log('📋 Usuario sin oposición configurada - pidiendo clarificación')
      }
    }

    // Intentar búsqueda semántica con embeddings
    // ⚠️ SALTAR para psicotécnicos y consultas de info de oposición - no tiene sentido buscar leyes
    let articles = []
    let searchMethod = 'none'
    const skipArticleSearch = isPsicotecnico || queryType === 'oposicion_info' || queryType === 'ambiguous_exam'

    // 🆕 Variable para manejar consultas genéricas sobre leyes
    let genericLawQueryContext = ''

    if (!skipArticleSearch) {
      // 🆕 PRIMERO: Si es una consulta genérica sobre una ley, pedir que concrete
      // Pasar lawFromHistory para que respuestas de seguimiento no se consideren genéricas
      const isGenericQuery = isGenericLawQuery(message, mentionedLaws, lawFromHistory)

      if (isGenericQuery && mentionedLaws.length > 0 && !lawFromHistory) {
        // Solo preguntar si la ley se mencionó en ESTE mensaje (no del historial)
        console.log(`📚 Consulta genérica sobre ley detectada: ${mentionedLaws.join(', ')} - pidiendo concreción`)
        queryType = 'generic_law_query' // Para evitar sugerencias de test

        // Generar contexto para que el AI pida concreción
        const lawName = mentionedLaws[0]
        genericLawQueryContext = `
IMPORTANTE: El usuario ha preguntado sobre "${lawName}" de forma muy genérica.
Esta ley tiene muchos artículos y temas. Para dar una respuesta precisa y no inventar:

Responde de forma amable preguntando qué aspecto específico le interesa. Sugiere opciones como:
- Plazos y términos
- Órganos administrativos (colegiados, Gobierno, Ministros)
- Delegación de competencias
- Convenios y acuerdos
- Responsabilidad patrimonial
- Potestad sancionadora
- Etc.

Ejemplo: "La ${lawName} es muy amplia. ¿Qué aspecto te interesa en particular? Por ejemplo: plazos, órganos colegiados, delegación de competencias, convenios..."
NO inventes contenido. Solo pregunta para concretar.
`
        // No buscar artículos para consultas genéricas
      } else {
        // 🆕 Construir búsqueda inteligente combinando contexto
        let searchText = message

        // Si la ley viene del historial, combinar para búsqueda completa
        if (lawFromHistory && mentionedLaws.length > 0) {
          searchText = `${message} ${mentionedLaws[0]}`
          console.log(`🔍 Búsqueda enriquecida: "${searchText}"`)
        } else if (questionContext?.questionText) {
          searchText = `${questionContext.questionText} ${message}`
        }

        try {
          const embedding = await generateEmbedding(openai, searchText)
          articles = await searchArticlesBySimilarity(embedding, 10, priorityLawIds, mentionedLaws, contextLawName)

          if (articles.length > 0) {
            searchMethod = 'semantic'
          }
        } catch (embeddingError) {
          console.log('Embeddings no disponibles, usando keywords:', embeddingError.message)
        }

        // 🆕 Fallback a búsqueda DIRECTA por ley si semántica no encontró artículos de esa ley
        if (articles.length === 0 && mentionedLaws.length > 0) {
          console.log(`🔄 Búsqueda semántica vacía para ${mentionedLaws.join(', ')} - intentando búsqueda directa`)

          // Extraer términos de búsqueda del mensaje (palabras clave relevantes)
          const searchTerms = extractSearchTerms(message)

          for (const lawName of mentionedLaws) {
            const directArticles = await searchArticlesByLawDirect(lawName, 15, searchTerms)
            articles = [...articles, ...directArticles]
          }
          if (articles.length > 0) {
            searchMethod = 'direct'
            console.log(`✅ Búsqueda directa: ${articles.length} artículos encontrados`)
          }
        }

        // Fallback a keywords si no hay resultados con embeddings ni directa
        if (articles.length === 0) {
          articles = await searchArticlesByKeywords(message)
          searchMethod = 'keywords'
        }
      }
    } else {
      console.log(`🧠 Saltando búsqueda de artículos (psicotecnico: ${isPsicotecnico}, queryType: ${queryType})`)
    }

    const context = isPsicotecnico ? '' : formatContext(articles) + examStatsContext + userStatsContext + ambiguousExamContext + oposicionInfoContext + genericLawQueryContext

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

      // Formatear diferente para psicotécnicos vs tests de leyes
      if (isPsicotecnico) {
        // Para psicotécnicos: incluir datos del contenido (gráficos, series, etc.)
        let contentDataText = ''
        if (questionContext.contentData) {
          const cd = questionContext.contentData
          const subtype = questionContext.questionSubtype

          if (subtype === 'line_chart' || subtype === 'bar_chart' || subtype === 'mixed_chart') {
            if (cd.chart_title) contentDataText += `\nTítulo del gráfico: ${cd.chart_title}`
            if (cd.categories && cd.age_groups) {
              contentDataText += `\nEje X (categorías): ${cd.categories.join(', ')}`
              contentDataText += '\nDatos por serie:'
              cd.age_groups.forEach(group => {
                contentDataText += `\n  - ${group.label}: ${group.values.join(', ')}`
              })
            }
            if (cd.chart_data) {
              contentDataText += '\nDatos del gráfico:'
              cd.chart_data.forEach(item => {
                contentDataText += `\n  - ${item.label || item.category}: ${item.value}`
              })
            }
          } else if (subtype === 'pie_chart') {
            if (cd.chart_title) contentDataText += `\nTítulo: ${cd.chart_title}`
            if (cd.total_value) contentDataText += `\nTotal: ${cd.total_value}`
            if (cd.chart_data) {
              contentDataText += '\nSectores:'
              cd.chart_data.forEach(item => {
                contentDataText += `\n  - ${item.label}: ${item.value}${item.percentage ? ` (${item.percentage}%)` : ''}`
              })
            }
          } else if (subtype === 'data_tables') {
            if (cd.table_title) contentDataText += `\nTítulo de la tabla: ${cd.table_title}`
            if (cd.headers) contentDataText += `\nColumnas: ${cd.headers.join(' | ')}`
            if (cd.table_data || cd.rows) {
              contentDataText += '\nDatos:'
              const rows = cd.table_data || cd.rows
              rows.forEach((row, i) => {
                if (Array.isArray(row)) {
                  contentDataText += `\n  Fila ${i + 1}: ${row.join(' | ')}`
                } else if (typeof row === 'object') {
                  contentDataText += `\n  Fila ${i + 1}: ${Object.values(row).join(' | ')}`
                }
              })
            }
          } else if (subtype === 'sequence_numeric' || subtype === 'sequence_letter') {
            if (cd.sequence) contentDataText += `\nSerie: ${cd.sequence.join(', ')}`
            if (cd.pattern_type) contentDataText += `\nTipo de patrón: ${cd.pattern_type}`
          }
        }

        questionContextText = `

PREGUNTA DE PSICOTÉCNICO:
Tipo: ${questionContext.questionTypeName || questionContext.questionSubtype || 'General'}
Categoría: ${questionContext.categoria || 'Psicotécnicos'}

Pregunta: ${questionContext.questionText || 'Sin texto'}
${contentDataText}

Opciones:
A) ${options?.a || 'Sin opción'}
B) ${options?.b || 'Sin opción'}
C) ${options?.c || 'Sin opción'}
D) ${options?.d || 'Sin opción'}

⭐ RESPUESTA CORRECTA: ${correctLetter}) ${correctText}
${questionContext.explanation ? `Explicación: ${questionContext.explanation}` : ''}

INSTRUCCIONES PARA PSICOTÉCNICOS:
- La respuesta correcta es "${correctLetter}" (${correctText}). NO cambies esta respuesta.
- Explica el RAZONAMIENTO paso a paso para llegar a la respuesta
- Si hay datos numéricos (gráficos, tablas, series), úsalos para demostrar cómo se obtiene la respuesta
- Enseña la ESTRATEGIA o PATRÓN para resolver este tipo de ejercicios
`
      } else {
        // Para tests de leyes: formato original con referencia a legislación
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
    }

    // Preparar mensajes para OpenAI - usar prompt específico para psicotécnicos
    const systemPrompt = isPsicotecnico
      ? generatePsicotecnicoSystemPrompt(questionContextText)
      : generateSystemPrompt(context, questionContextText, userOposicion)

    const messages = [
      { role: 'system', content: systemPrompt },
      ...history.slice(-6).map(h => ({
        role: h.role,
        content: h.content
      })),
      { role: 'user', content: message }
    ]

    // Preparar sources para enviar (vacío para psicotécnicos)
    const sources = isPsicotecnico ? [] : articles.map(a => ({
      law: a.law?.short_name || a.law?.name,
      lawName: a.law?.name || a.law_name || null, // Nombre completo para mostrar al usuario
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
            const suggestions = generateFollowUpSuggestions(sources, fullResponse, questionContext, queryType, queryLaw)

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
    const suggestions = generateFollowUpSuggestions(sources, response, questionContext, queryType, queryLaw)

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
