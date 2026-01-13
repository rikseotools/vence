import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'
// Queries tipadas con Drizzle
import {
  getTemario as getTemarioTyped,
  getOposicionInfo as getOposicionInfoTyped,
  getOposicionLawIds as getOposicionLawIdsTyped,
  getOpenAIKey as getOpenAIKeyTyped,
  getUserOposicion,
  getExamStats as getExamStatsTyped,
  getUserStats as getUserStatsTyped
} from '@/lib/api/chat/queries'
import { validateChatRequest } from '@/lib/api/chat/schemas'

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

// Cache de leyes para evitar queries repetidas (TTL: 30 días)
let lawsCache = null
let lawsCacheTime = 0
const LAWS_CACHE_TTL = 30 * 24 * 60 * 60 * 1000

// Cargar todas las leyes de la BD (con cache)
async function loadAllLaws() {
  const now = Date.now()
  if (lawsCache && (now - lawsCacheTime) < LAWS_CACHE_TTL) {
    return lawsCache
  }

  const { data } = await supabase
    .from('laws')
    .select('id, short_name, name')
    .eq('is_active', true)

  lawsCache = data || []
  lawsCacheTime = now
  console.log(`📚 Cache de leyes actualizado: ${lawsCache.length} leyes`)
  return lawsCache
}

// Alias comunes para leyes (mapeo a short_name)
// Sincronizado con lib/lawMappingUtils.ts
const LAW_ALIASES = {
  // Constitución
  'constitución': 'CE', 'constitucion': 'CE', 'c.e.': 'CE',
  // Procedimiento administrativo
  'lpac': 'Ley 39/2015', 'procedimiento administrativo': 'Ley 39/2015',
  // Régimen jurídico sector público
  'lrjsp': 'Ley 40/2015', 'régimen jurídico': 'Ley 40/2015',
  // Estatuto básico empleado público
  'trebep': 'RDL 5/2015', 'ebep': 'RDL 5/2015', 'estatuto básico': 'RDL 5/2015',
  'funcionarios': 'RDL 5/2015', 'empleados públicos': 'RDL 5/2015', 'empleado público': 'RDL 5/2015',
  'derechos funcionarios': 'RDL 5/2015', 'deberes funcionarios': 'RDL 5/2015',
  'código de conducta': 'RDL 5/2015', 'régimen funcionarios': 'RDL 5/2015',
  // Ley General Tributaria
  'lgt': 'LGT', 'ley general tributaria': 'LGT',
  // Transparencia
  'ley de transparencia': 'Ley 19/2013', 'transparencia': 'Ley 19/2013',
  // Contratos
  'lcsp': 'Ley 9/2017', 'ley de contratos': 'Ley 9/2017', 'contratos del sector público': 'Ley 9/2017',
  // Subvenciones
  'lgs': 'LGS', 'ley de subvenciones': 'Ley 38/2003',
  // RGPD
  'rgpd': 'Reglamento UE 2016/679', 'reglamento de protección de datos': 'Reglamento UE 2016/679',
  // LOPDGDD
  'lopdgdd': 'LO 3/2018', 'lopd': 'LO 3/2018', 'protección de datos': 'LO 3/2018',
  // Código Penal
  'código penal': 'CP', 'codigo penal': 'CP', 'cp': 'CP',
  // Código Civil
  'código civil': 'Código Civil', 'codigo civil': 'Código Civil',
  // Poder Judicial
  'lopj': 'LO 6/1985', 'ley orgánica del poder judicial': 'LO 6/1985', 'poder judicial': 'LO 6/1985',
  // Seguridad ciudadana
  'ley de seguridad ciudadana': 'LO 4/2015', 'ley mordaza': 'LO 4/2015', 'seguridad ciudadana': 'LO 4/2015',
  // Derecho de petición
  'derecho de petición': 'LO 4/2001', 'ley de petición': 'LO 4/2001',
  // Tribunal Constitucional
  'lotc': 'LOTC', 'tribunal constitucional': 'LOTC',
  // Electoral
  'loreg': 'LO 5/1985', 'ley electoral': 'LO 5/1985', 'régimen electoral': 'LO 5/1985',
  // Fuerzas y Cuerpos Seguridad
  'lofcs': 'LOFCS', 'fuerzas y cuerpos': 'LOFCS',
  // Defensor del Pueblo
  'defensor del pueblo': 'LO 3/1981',
  // Consejo de Estado
  'consejo de estado': 'LO 3/1980',
  // Libertad sindical
  'lols': 'LO 11/1985', 'libertad sindical': 'LO 11/1985',
  // Financiación CCAA
  'lofca': 'LO 8/1980', 'financiación autonómica': 'LO 8/1980',
  // Extranjería
  'loex': 'LO 4/2000', 'extranjería': 'LO 4/2000',
  // Educación
  'loe': 'LO 2/2006', 'lomloe': 'LOMLOE',
  // Penitenciario
  'logp': 'LOGP', 'ley penitenciaria': 'LOGP',
  // Gobierno
  'ley del gobierno': 'Ley 50/1997', 'ley 50/1997': 'Ley 50/1997',
  // Régimen local
  'lrbrl': 'Ley 7/1985', 'régimen local': 'Ley 7/1985', 'bases régimen local': 'Ley 7/1985',
  // Patrimonio AAPP
  'lpap': 'Ley 33/2003', 'patrimonio administraciones': 'Ley 33/2003',
  // Enjuiciamiento Civil
  'lec': 'Ley 1/2000', 'enjuiciamiento civil': 'Ley 1/2000',
  // Enjuiciamiento Criminal
  'lecrim': 'LECrim', 'enjuiciamiento criminal': 'LECrim',
  // Haciendas locales
  'trlrhl': 'RDL 2/2004', 'haciendas locales': 'RDL 2/2004',
  // Prevención riesgos
  'lprl': 'LPRL', 'prevención riesgos': 'LPRL', 'riesgos laborales': 'LPRL',
  // Estatuto trabajadores
  'estatuto trabajadores': 'RDL 2/2015', 'et': 'RDL 2/2015',
  // Seguridad Social
  'lgss': 'RDL 8/2015', 'seguridad social': 'RDL 8/2015',
  // Jurisdicción contencioso-administrativa
  'ljca': 'Ley 29/1998', 'contencioso administrativo': 'Ley 29/1998',
  // Ministerio Fiscal
  'eomf': 'Ley 50/1981', 'ministerio fiscal': 'Ley 50/1981',
  // Código comercio
  'ccom': 'CCom', 'código comercio': 'CCom', 'codigo comercio': 'CCom',
  // Igualdad
  'ley de igualdad': 'LO 3/2007', 'igualdad efectiva': 'LO 3/2007',
  // Dependencia
  'ley de dependencia': 'Ley 39/2006', 'dependencia': 'Ley 39/2006',
  // Violencia de género
  'ley de violencia de género': 'LO 1/2004', 'violencia de género': 'LO 1/2004',
  // Agenda 2030
  'agenda 2030': 'Agenda 2030', 'ods': 'Agenda 2030',
  // Gobierno Abierto
  'gobierno abierto': 'Gobierno Abierto',
}

// 🚨 LEYES DEROGADAS - Advertir al usuario cuando pregunte por ellas
const REPEALED_LAWS = {
  'ley 30/1984': {
    name: 'Ley 30/1984, de 2 de agosto, de medidas para la reforma de la Función Pública',
    replacement: 'RDL 5/2015 (TREBEP)',
    replacementName: 'Real Decreto Legislativo 5/2015, de 30 de octubre, del Estatuto Básico del Empleado Público',
    repealedBy: 'Disposición derogatoria única del TREBEP'
  },
  'ley 7/2007': {
    name: 'Ley 7/2007, de 12 de abril, del Estatuto Básico del Empleado Público (EBEP original)',
    replacement: 'RDL 5/2015 (TREBEP)',
    replacementName: 'Real Decreto Legislativo 5/2015, texto refundido',
    repealedBy: 'Refundición en RDL 5/2015'
  },
  'ley 30/1992': {
    name: 'Ley 30/1992, de 26 de noviembre, de Régimen Jurídico de las Administraciones Públicas y del Procedimiento Administrativo Común (LRJPAC)',
    replacement: 'Ley 39/2015 (procedimiento) y Ley 40/2015 (régimen jurídico)',
    replacementName: 'Ley 39/2015 del Procedimiento Administrativo Común y Ley 40/2015 del Régimen Jurídico del Sector Público',
    repealedBy: 'Disposición derogatoria de las Leyes 39/2015 y 40/2015'
  },
  'ley 6/1997': {
    name: 'Ley 6/1997, de 14 de abril, de Organización y Funcionamiento de la Administración General del Estado (LOFAGE)',
    replacement: 'Ley 40/2015',
    replacementName: 'Ley 40/2015, de 1 de octubre, de Régimen Jurídico del Sector Público',
    repealedBy: 'Disposición derogatoria de la Ley 40/2015'
  },
  'ley 11/2007': {
    name: 'Ley 11/2007, de 22 de junio, de acceso electrónico de los ciudadanos a los Servicios Públicos',
    replacement: 'Ley 39/2015',
    replacementName: 'Ley 39/2015, de 1 de octubre, del Procedimiento Administrativo Común',
    repealedBy: 'Disposición derogatoria de la Ley 39/2015'
  },
  'rd 2169/1984': {
    name: 'RD 2169/1984, sobre provisión de puestos de trabajo',
    replacement: 'RDL 5/2015 (TREBEP)',
    replacementName: 'Normativa vigente del TREBEP',
    repealedBy: 'Derogaciones sucesivas'
  },
  'lrjpac': {
    name: 'Ley 30/1992 (LRJPAC)',
    replacement: 'Ley 39/2015 y Ley 40/2015',
    replacementName: 'Leyes 39 y 40 de 2015',
    repealedBy: 'Disposición derogatoria de las Leyes 39/2015 y 40/2015'
  },
  'lofage': {
    name: 'Ley 6/1997 (LOFAGE)',
    replacement: 'Ley 40/2015',
    replacementName: 'Ley 40/2015, de Régimen Jurídico del Sector Público',
    repealedBy: 'Disposición derogatoria de la Ley 40/2015'
  }
}

// Función para detectar si el usuario pregunta por una ley derogada
function detectRepealedLaw(message) {
  const msgLower = message.toLowerCase()

  for (const [key, info] of Object.entries(REPEALED_LAWS)) {
    if (msgLower.includes(key)) {
      return { key, ...info }
    }
  }
  return null
}

// Detectar menciones de leyes en el mensaje (versión mejorada con detección dinámica)
function detectMentionedLaws(message) {
  const msgLower = message.toLowerCase()
  const mentionedLaws = new Set()

  // 1. Buscar alias conocidos
  for (const [alias, shortName] of Object.entries(LAW_ALIASES)) {
    // Crear regex con word boundaries para evitar falsos positivos
    const aliasRegex = new RegExp(`\\b${alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i')
    if (aliasRegex.test(msgLower)) {
      mentionedLaws.add(shortName)
    }
  }

  // 2. Detectar patrones genéricos de leyes españolas
  const lawPatterns = [
    // LO X/YYYY - Ley Orgánica
    { regex: /\b(?:ley\s+org[aá]nica|l\.?o\.?)\s*(\d+)\/(\d{4})\b/gi, prefix: 'LO' },
    // Ley X/YYYY - Ley ordinaria
    { regex: /\bley\s+(\d+)\/(\d{4})\b/gi, prefix: 'Ley' },
    // RD X/YYYY - Real Decreto
    { regex: /\b(?:real\s+decreto|r\.?d\.?)\s*(\d+)\/(\d{4})\b/gi, prefix: 'RD' },
    // RDL X/YYYY - Real Decreto Legislativo / Real Decreto-ley
    { regex: /\b(?:real\s+decreto[- ]?(?:legislativo|ley)|r\.?d\.?l\.?)\s*(\d+)\/(\d{4})\b/gi, prefix: 'RDL' },
    // Orden XXX/YYYY
    { regex: /\border\s+([A-Z]{2,5})\/(\d+)\/(\d{4})\b/gi, prefix: 'Orden', isOrder: true },
  ]

  for (const { regex, prefix, isOrder } of lawPatterns) {
    let match
    while ((match = regex.exec(message)) !== null) {
      if (isOrder) {
        // Formato: Orden HAP/1949/2014
        mentionedLaws.add(`Orden ${match[1].toUpperCase()}/${match[2]}/${match[3]}`)
      } else {
        // Formato: LO 4/2001, Ley 39/2015, etc.
        mentionedLaws.add(`${prefix} ${match[1]}/${match[2]}`)
      }
    }
  }

  // 3. Detectar referencias coloquiales "la 39", "la 40", etc. (solo para leyes comunes)
  const coloquialMatches = msgLower.match(/\bla\s+(\d{2})\b/g)
  if (coloquialMatches) {
    for (const match of coloquialMatches) {
      const num = match.match(/\d+/)[0]
      if (num === '39') mentionedLaws.add('Ley 39/2015')
      if (num === '40') mentionedLaws.add('Ley 40/2015')
    }
  }

  return Array.from(mentionedLaws)
}

// Validar y normalizar leyes detectadas contra la BD
async function validateAndNormalizeLaws(detectedLaws) {
  if (!detectedLaws || detectedLaws.length === 0) return []

  const allLaws = await loadAllLaws()
  const validatedLaws = []

  for (const detected of detectedLaws) {
    // Buscar coincidencia exacta por short_name
    const exactMatch = allLaws.find(law =>
      law.short_name.toLowerCase() === detected.toLowerCase()
    )

    if (exactMatch) {
      validatedLaws.push(exactMatch.short_name)
      continue
    }

    // Buscar coincidencia parcial en el nombre completo
    const partialMatch = allLaws.find(law =>
      law.name?.toLowerCase().includes(detected.toLowerCase()) ||
      law.short_name.toLowerCase().includes(detected.toLowerCase())
    )

    if (partialMatch) {
      validatedLaws.push(partialMatch.short_name)
      console.log(`🔄 Ley normalizada: "${detected}" → "${partialMatch.short_name}"`)
    } else {
      console.log(`⚠️ Ley no encontrada en BD: "${detected}"`)
    }
  }

  return [...new Set(validatedLaws)] // Eliminar duplicados
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
  // - "qué preguntas suelen caer" (sin mencionar examen explícitamente)
  // - "qué tipo de preguntas caen/suelen"
  // - "qué suele caer de la ley X"
  return /art[ií]culos?.*(ca[ií]do|caen|aparec|pregunta|examen|oficial)|examen.*oficial.*(art|pregunta)|qu[eé].*preguntas?.*(cae|caen|aparec|suele)/i.test(msgLower) ||
    /qu[eé].*(cae|caen|suele).*examen|estad[ií]stica.*examen|m[aá]s preguntad|preguntas?.*caen.*examen|(cae|caen).*en.*examen/i.test(msgLower) ||
    /qu[eé]\s*(tipo|clase)\s*(de)?\s*preguntas/i.test(msgLower) ||
    /preguntas?\s*suele|suele.*caer/i.test(msgLower)
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
  // Patrones que indican pregunta sobre progreso personal:
  // - "mis fallos/errores/áreas débiles"
  // - "qué he fallado / dónde fallo"
  // - "cómo voy"
  // - "en qué debo mejorar/estudiar/repasar"
  // - "qué artículos/temas debería repasar"
  // - "debería repasar urgentemente"
  // - "necesito mejorar/repasar"
  return /mi[s]?\s*(progreso|estad[ií]stica|resultado|fallo|error|acierto|rendimiento|punto.*d[eé]bil|[aá]rea.*d[eé]bil)|qu[eé].*(he\s*fallado|fallo\s*m[aá]s|me\s*cuesta)|d[oó]nde\s*(fallo|tengo.*problema)|c[oó]mo\s*voy|en\s*qu[eé]\s*debo\s*(mejorar|estudiar|repasar)|qu[eé]\s*(art[ií]culos?|temas?|leyes?|partes?)\s*(deber[ií]a|tengo\s*que|necesito)\s*repasar|(deber[ií]a|necesito|tengo\s*que)\s*repasar\s*(urgente|m[aá]s)?|repasar\s*urgente/i.test(msgLower)
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
async function getTemario(userOposicion, limit = 50) {
  if (!userOposicion) return null

  try {
    const positionType = OPOSICION_TO_POSITION_TYPE[userOposicion]
    if (!positionType) return null

    const { data: topics, error } = await supabase
      .from('topics')
      .select('topic_number, title, description')
      .eq('position_type', positionType)
      .eq('is_active', true)
      .order('topic_number', { ascending: true })
      .limit(limit)

    if (error) {
      console.error('Error obteniendo temario:', error)
      return []
    }

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

// 🆕 Obtener ejemplos de preguntas oficiales reales de una ley
async function getOfficialQuestionExamples(lawShortName, limit = 8, examPosition = null) {
  try {
    // Buscar preguntas oficiales de esta ley (join a través de articles)
    let query = supabase
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
        exam_date,
        exam_position,
        article:articles!primary_article_id(
          article_number,
          law:laws!law_id(short_name)
        )
      `)
      .eq('is_active', true)
      .eq('is_official_exam', true)
      .eq('article.law.short_name', lawShortName)
      .not('question_text', 'is', null)
      .limit(limit * 3) // Pedir más para variedad

    // Filtrar por oposición si se especifica
    if (examPosition) {
      query = query.eq('exam_position', examPosition)
    }

    const { data: questions, error } = await query

    if (error || !questions?.length) {
      console.log(`No se encontraron preguntas oficiales para ${lawShortName}:`, error?.message)
      return []
    }

    // Filtrar las que realmente tienen el artículo de la ley correcta
    const filteredQuestions = questions.filter(q =>
      q.article?.law?.short_name === lawShortName
    )

    if (filteredQuestions.length === 0) {
      console.log(`No hay preguntas oficiales con artículo para ${lawShortName}`)
      return []
    }

    // Seleccionar una muestra variada (por diferentes artículos si es posible)
    const byArticle = {}
    filteredQuestions.forEach(q => {
      const art = q.article?.article_number || 'general'
      if (!byArticle[art]) byArticle[art] = []
      byArticle[art].push({
        ...q,
        article_number: q.article?.article_number,
        correct_answer: ['A', 'B', 'C', 'D'][q.correct_option] || q.correct_option,
        exam_year: q.exam_date ? new Date(q.exam_date).getFullYear() : null
      })
    })

    // Tomar una pregunta de cada artículo primero, luego completar si hace falta
    const selected = []
    const articles = Object.keys(byArticle).sort(() => Math.random() - 0.5)

    for (const art of articles) {
      if (selected.length >= limit) break
      const randomQ = byArticle[art][Math.floor(Math.random() * byArticle[art].length)]
      selected.push(randomQ)
    }

    console.log(`📝 Encontradas ${selected.length} preguntas oficiales de ejemplo para ${lawShortName}`)
    return selected

  } catch (err) {
    console.error('Error obteniendo ejemplos de preguntas oficiales:', err)
    return []
  }
}

// 🆕 Obtener contenido de artículos específicos (para explicar de qué tratan)
async function getArticleContents(lawShortName, articleNumbers, limit = 10) {
  if (!lawShortName || !articleNumbers?.length) return []

  try {
    // Primero obtener el ID de la ley
    const { data: law } = await supabase
      .from('laws')
      .select('id')
      .eq('short_name', lawShortName)
      .single()

    if (!law) return []

    // Buscar los artículos
    const { data: articles, error } = await supabase
      .from('articles')
      .select('article_number, title, content')
      .eq('law_id', law.id)
      .eq('is_active', true)
      .in('article_number', articleNumbers.slice(0, limit))

    if (error || !articles) return []

    console.log(`📖 Obtenido contenido de ${articles.length} artículos de ${lawShortName}`)
    return articles

  } catch (err) {
    console.error('Error obteniendo contenido de artículos:', err)
    return []
  }
}

// ============================================================================
// 🎯 SISTEMA DE PATTERN MATCHING PARA QUERIES FRECUENTES
// ============================================================================

// Definición de patrones frecuentes y sus búsquedas específicas
const QUERY_PATTERNS = {
  // Patrón: Plazos (ej: "plazos de la Ley 40", "plazo para recurso de alzada")
  plazos: {
    name: 'plazos',
    detect: (msg) => /plazos?|t[eé]rminos?|d[ií]as?\s*(h[aá]biles?|naturales?)|\bcu[aá]nto\s*tiempo\b|\bcu[aá]ntos?\s*d[ií]as?\b/i.test(msg),
    keywords: ['plazo', 'plazos', 'término', 'términos', 'días', 'hábiles', 'naturales', 'tiempo', 'máximo'],
    description: 'Consulta sobre plazos y términos legales'
  },

  // Patrón: Definiciones (ej: "qué es silencio administrativo", "define recurso")
  definiciones: {
    name: 'definiciones',
    detect: (msg) => /\bqu[eé]\s+(es|son|significa)\b|\bdefin[ei]|concepto\s+de|\bexplica\s+(qu[eé]\s+es|el|la)\b/i.test(msg),
    keywords: ['definición', 'concepto', 'significa', 'entiende'],
    description: 'Consulta sobre definiciones y conceptos'
  },

  // Patrón: Órganos (ej: "órganos colegiados", "qué órganos tiene la Ley 40")
  organos: {
    name: 'organos',
    detect: (msg) => /[oó]rganos?\s*(colegiados?|administrativos?|competentes?)|\bconsejo\s+de\s+ministros\b|\bgobierno\b|\bministros?\b|\bsecretar[ií]os?\b|\bsubsecretar[ií]os?\b|\bdirectores?\s+generales?\b/i.test(msg),
    keywords: ['órgano', 'órganos', 'colegiado', 'colegiados', 'consejo', 'ministro', 'gobierno', 'secretario', 'director'],
    description: 'Consulta sobre órganos administrativos'
  },

  // Patrón: Recursos (ej: "recurso de alzada", "cómo recurrir")
  recursos: {
    name: 'recursos',
    detect: (msg) => /recursos?\s*(de)?\s*(alzada|reposici[oó]n|extraordinario|contencioso|administrativo)|\bc[oó]mo\s+recurr|\bimpugnar\b/i.test(msg),
    keywords: ['recurso', 'recursos', 'alzada', 'reposición', 'impugnar', 'impugnación', 'recurrente'],
    description: 'Consulta sobre recursos administrativos'
  },

  // Patrón: Silencio administrativo (muy frecuente)
  silencio: {
    name: 'silencio',
    detect: (msg) => /silencio\s*(administrativo|positivo|negativo)|\bfalta\s+de\s+resoluci[oó]n\b/i.test(msg),
    keywords: ['silencio', 'administrativo', 'positivo', 'negativo', 'desestimatorio', 'estimatorio'],
    description: 'Consulta sobre silencio administrativo'
  },

  // Patrón: Notificaciones
  notificaciones: {
    name: 'notificaciones',
    detect: (msg) => /notificaci[oó]n|notificar|notificaciones|\bc[oó]mo\s+se\s+notifica\b|\bd[oó]nde\s+se\s+notifica\b/i.test(msg),
    keywords: ['notificación', 'notificaciones', 'notificar', 'publicación', 'edicto', 'electrónica'],
    description: 'Consulta sobre notificaciones administrativas'
  },

  // Patrón: Delegación de competencias
  delegacion: {
    name: 'delegacion',
    detect: (msg) => /delegaci[oó]n|delegar|\bavocaci[oó]n\b|\bencomienda\s+de\s+gesti[oó]n\b|\bsuplencia\b|\bsustituc/i.test(msg),
    keywords: ['delegación', 'delegar', 'avocación', 'encomienda', 'suplencia', 'sustitución', 'competencia'],
    description: 'Consulta sobre delegación de competencias'
  },

  // Patrón: Responsabilidad patrimonial
  responsabilidad: {
    name: 'responsabilidad',
    detect: (msg) => /responsabilidad\s*(patrimonial|del\s+estado|administraci[oó]n)|\bindemnizaci[oó]n|\bda[ñn]os?\s*(y\s*perjuicios)?/i.test(msg),
    keywords: ['responsabilidad', 'patrimonial', 'indemnización', 'daños', 'perjuicios', 'lesión'],
    description: 'Consulta sobre responsabilidad patrimonial'
  },

  // Patrón: Nulidad y anulabilidad
  nulidad: {
    name: 'nulidad',
    detect: (msg) => /nulidad|anulabilidad|nulos?\s+de\s+pleno|anulable|vicios?|revisi[oó]n\s+de\s+oficio/i.test(msg),
    keywords: ['nulidad', 'anulabilidad', 'nulo', 'anulable', 'vicio', 'revisión', 'oficio'],
    description: 'Consulta sobre nulidad y anulabilidad de actos'
  },

  // Patrón: Procedimiento sancionador
  sancionador: {
    name: 'sancionador',
    detect: (msg) => /procedimiento\s+sancionador|potestad\s+sancionadora|sanci[oó]n|sanciones|infracci[oó]n|multa/i.test(msg),
    keywords: ['sanción', 'sanciones', 'sancionador', 'infracción', 'multa', 'potestad', 'expediente'],
    description: 'Consulta sobre procedimiento sancionador'
  },

  // Patrón: Interesados
  interesados: {
    name: 'interesados',
    detect: (msg) => /\binteresados?\b.*procedimiento|\bqui[eé]n\s+(puede|es)\s+interesado|\bcapacidad\s+de\s+obrar\b|\blegitimaci[oó]n\b/i.test(msg),
    keywords: ['interesado', 'interesados', 'capacidad', 'legitimación', 'representación'],
    description: 'Consulta sobre interesados en el procedimiento'
  },

  // Patrón: Convenios
  convenios: {
    name: 'convenios',
    detect: (msg) => /convenios?\s*(administrativos?|colaboraci[oó]n)?|\bacuerdos?\s+de\s+colaboraci[oó]n\b/i.test(msg),
    keywords: ['convenio', 'convenios', 'acuerdo', 'colaboración', 'coordinación'],
    description: 'Consulta sobre convenios administrativos'
  }
}

// Detectar qué patrón coincide con el mensaje
function detectQueryPattern(message) {
  const msgLower = message.toLowerCase()

  for (const [patternId, pattern] of Object.entries(QUERY_PATTERNS)) {
    if (pattern.detect(msgLower)) {
      console.log(`🎯 Patrón detectado: ${pattern.name} - "${pattern.description}"`)
      return { id: patternId, ...pattern }
    }
  }

  return null
}

// Buscar artículos específicos para un patrón
async function searchArticlesForPattern(pattern, lawShortName = null, limit = 15) {
  try {
    // Si hay ley específica, buscar solo en esa ley
    let lawId = null
    let lawInfo = null
    if (lawShortName) {
      const { data: law } = await supabase
        .from('laws')
        .select('id, short_name, name')
        .eq('short_name', lawShortName)
        .single()

      if (law) {
        lawId = law.id
        lawInfo = law
      } else {
        console.log(`⚠️ Ley no encontrada para patrón: ${lawShortName}`)
      }
    }

    // Construir búsqueda con keywords del patrón
    const keywords = pattern.keywords
    const orConditions = keywords.flatMap(term => [
      `title.ilike.%${term}%`,
      `content.ilike.%${term}%`
    ]).join(',')

    let query = supabase
      .from('articles')
      .select(`
        id,
        article_number,
        title,
        content,
        law_id,
        law:laws!inner(id, short_name, name, is_derogated)
      `)
      .eq('is_active', true)
      .eq('law.is_derogated', false)
      .or(orConditions)

    // Filtrar por ley si se especificó
    if (lawId) {
      query = query.eq('law_id', lawId)
    }

    const { data: articles, error } = await query
      .order('article_number', { ascending: true })
      .limit(limit * 2) // Pedir más para filtrar

    if (error) {
      console.error(`Error buscando artículos para patrón ${pattern.name}:`, error)
      return []
    }

    if (!articles || articles.length === 0) {
      console.log(`📭 No se encontraron artículos para patrón ${pattern.name}${lawShortName ? ` en ${lawShortName}` : ''}`)
      return []
    }

    // Rankear por relevancia (cuántos keywords contiene)
    const rankedArticles = articles.map(art => {
      const text = `${art.title || ''} ${art.content || ''}`.toLowerCase()
      let score = 0
      keywords.forEach(kw => {
        const regex = new RegExp(kw, 'gi')
        const matches = text.match(regex)
        if (matches) score += matches.length
      })
      return { ...art, relevanceScore: score }
    })

    // Ordenar por relevancia y limitar
    const sortedArticles = rankedArticles
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, limit)

    console.log(`🎯 Patrón "${pattern.name}": ${sortedArticles.length} artículos encontrados${lawShortName ? ` en ${lawShortName}` : ''}`)

    return sortedArticles.map(a => ({
      ...a,
      law: a.law,
      similarity: Math.min(1, a.relevanceScore / 10) // Convertir score a "similarity"
    }))

  } catch (err) {
    console.error(`Error en searchArticlesForPattern:`, err)
    return []
  }
}

// Extraer datos específicos de los artículos según el patrón
function extractPatternData(pattern, articles) {
  if (!articles || articles.length === 0) return null

  const extractedData = {
    patternName: pattern.name,
    patternDescription: pattern.description,
    articlesFound: articles.length,
    details: []
  }

  // Extraer información específica según el patrón
  switch (pattern.name) {
    case 'plazos':
      // Buscar plazos específicos en el contenido
      articles.forEach(art => {
        const content = art.content || ''
        // Regex para encontrar plazos
        const plazoRegex = /(\d+)\s*(d[ií]as?|meses?|a[ñn]os?)\s*(h[aá]biles?|naturales?)?/gi
        const plazos = content.match(plazoRegex) || []
        if (plazos.length > 0 || content.toLowerCase().includes('plazo')) {
          extractedData.details.push({
            article: art.article_number,
            law: art.law?.short_name,
            title: art.title,
            plazos: [...new Set(plazos)].slice(0, 5),
            snippet: content.substring(0, 300)
          })
        }
      })
      break

    case 'silencio':
      articles.forEach(art => {
        const content = (art.content || '').toLowerCase()
        const tipoSilencio = content.includes('positivo') ? 'positivo' :
                           content.includes('negativo') ? 'negativo' : 'general'
        extractedData.details.push({
          article: art.article_number,
          law: art.law?.short_name,
          title: art.title,
          tipoSilencio,
          snippet: art.content?.substring(0, 400)
        })
      })
      break

    case 'recursos':
      articles.forEach(art => {
        const content = (art.content || '').toLowerCase()
        const tipoRecurso = content.includes('alzada') ? 'alzada' :
                          content.includes('reposición') ? 'reposición' :
                          content.includes('extraordinario') ? 'extraordinario' : 'general'
        extractedData.details.push({
          article: art.article_number,
          law: art.law?.short_name,
          title: art.title,
          tipoRecurso,
          snippet: art.content?.substring(0, 400)
        })
      })
      break

    default:
      // Extracción genérica
      articles.forEach(art => {
        extractedData.details.push({
          article: art.article_number,
          law: art.law?.short_name,
          title: art.title,
          snippet: art.content?.substring(0, 400)
        })
      })
  }

  return extractedData
}

// Formatear contexto específico para un patrón
function formatPatternContext(pattern, patternData, lawShortName = null) {
  if (!patternData || patternData.details.length === 0) {
    return ''
  }

  let context = `\n\n🎯 DATOS ESPECÍFICOS ENCONTRADOS PARA: ${pattern.description.toUpperCase()}\n`
  if (lawShortName) {
    context += `Ley filtrada: ${lawShortName}\n`
  }
  context += `Artículos relevantes encontrados: ${patternData.articlesFound}\n\n`

  // Formatear según el tipo de patrón
  switch (pattern.name) {
    case 'plazos':
      context += `PLAZOS ENCONTRADOS EN LA LEGISLACIÓN:\n`
      patternData.details.forEach((d, i) => {
        context += `\n${i + 1}. ${d.law} Art. ${d.article}${d.title ? ` - ${d.title}` : ''}\n`
        if (d.plazos && d.plazos.length > 0) {
          context += `   Plazos mencionados: ${d.plazos.join(', ')}\n`
        }
        context += `   Contenido: ${d.snippet}...\n`
      })
      context += `\nINSTRUCCIONES: Lista TODOS los plazos encontrados con sus artículos exactos. NO inventes plazos.`
      break

    case 'silencio':
      context += `REGULACIÓN DEL SILENCIO ADMINISTRATIVO:\n`
      patternData.details.forEach((d, i) => {
        context += `\n${i + 1}. ${d.law} Art. ${d.article}${d.title ? ` - ${d.title}` : ''}\n`
        context += `   Tipo de silencio: ${d.tipoSilencio}\n`
        context += `   Contenido: ${d.snippet}...\n`
      })
      context += `\nINSTRUCCIONES: Explica cuándo aplica silencio positivo vs negativo según los artículos.`
      break

    case 'recursos':
      context += `INFORMACIÓN SOBRE RECURSOS ADMINISTRATIVOS:\n`
      patternData.details.forEach((d, i) => {
        context += `\n${i + 1}. ${d.law} Art. ${d.article}${d.title ? ` - ${d.title}` : ''}\n`
        context += `   Tipo de recurso: ${d.tipoRecurso}\n`
        context += `   Contenido: ${d.snippet}...\n`
      })
      context += `\nINSTRUCCIONES: Explica plazos, órgano ante el que se interpone, y efectos de cada recurso.`
      break

    default:
      context += `ARTÍCULOS RELEVANTES:\n`
      patternData.details.forEach((d, i) => {
        context += `\n${i + 1}. ${d.law} Art. ${d.article}${d.title ? ` - ${d.title}` : ''}\n`
        context += `   ${d.snippet}...\n`
      })
  }

  context += `\n\nTODOS LOS DATOS ANTERIORES SON REALES de nuestra base de datos de legislación.`

  return context
}

// Obtener estadísticas del usuario (artículos fallados, áreas débiles)
async function getUserStats(userId, lawShortName = null, limit = 10) {
  if (!userId) return null

  try {
    // Obtener historial de respuestas del usuario con info de pregunta, artículo y ley
    // Usamos user_question_history que tiene agregados por pregunta
    const { data: history, error } = await supabase
      .from('user_question_history')
      .select(`
        id,
        question_id,
        total_attempts,
        correct_attempts,
        success_rate,
        question:questions!question_id(
          id,
          primary_article_id,
          article:articles!primary_article_id(
            article_number,
            law:laws!law_id(short_name, name)
          )
        )
      `)
      .eq('user_id', userId)
      .gt('total_attempts', 0)

    if (error || !history?.length) {
      console.log('No se encontraron respuestas del usuario:', error?.message)
      return null
    }

    // Filtrar solo los que tienen artículo asociado
    let filteredHistory = history.filter(h =>
      h.question?.article?.article_number != null
    )

    // Filtrar por ley si se especifica
    if (lawShortName) {
      filteredHistory = filteredHistory.filter(h =>
        h.question?.article?.law?.short_name === lawShortName
      )
    }

    if (filteredHistory.length === 0) {
      console.log('No hay historial con artículos para este filtro')
      return null
    }

    // Agrupar por artículo
    const articleStats = {}
    filteredHistory.forEach(h => {
      const law = h.question?.article?.law?.short_name || h.question?.article?.law?.name || 'Ley'
      const article = h.question?.article?.article_number
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
      articleStats[key].total += h.total_attempts || 0
      articleStats[key].correct += h.correct_attempts || 0
      articleStats[key].failed += (h.total_attempts || 0) - (h.correct_attempts || 0)
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

    // Estadísticas generales (sumando todos los intentos)
    const totalAnswers = filteredHistory.reduce((sum, h) => sum + (h.total_attempts || 0), 0)
    const totalCorrect = filteredHistory.reduce((sum, h) => sum + (h.correct_attempts || 0), 0)
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

// 🆕 Buscar en la base de conocimiento (FAQs, planes, plataforma)
// Devuelve info sobre la plataforma si la pregunta es sobre planes, funcionalidades, etc.
async function searchKnowledgeBase(embedding, threshold = 0.40, limit = 3) {
  try {
    const { data, error } = await supabase.rpc('match_knowledge_base', {
      query_embedding: embedding,
      match_threshold: threshold,
      match_count: limit,
      filter_category: null // Buscar en todas las categorías
    })

    if (error) {
      console.error('Error en match_knowledge_base:', error)
      return []
    }

    if (data && data.length > 0) {
      console.log(`💡 Knowledge base: ${data.length} resultados (mejor: ${(data[0].similarity * 100).toFixed(1)}%)`)
    }

    return data || []
  } catch (err) {
    console.error('Error en searchKnowledgeBase:', err)
    return []
  }
}

// Formatear contexto de knowledge base para el system prompt
function formatKnowledgeBaseContext(kbResults) {
  if (!kbResults || kbResults.length === 0) return ''

  let context = '\n\n📋 INFORMACIÓN DE LA PLATAFORMA VENCE:\n'
  context += 'El usuario está preguntando sobre la plataforma. Usa esta información para responder:\n\n'

  kbResults.forEach((kb, i) => {
    context += `--- ${kb.title} ---\n`
    context += `${kb.content}\n\n`
  })

  context += 'IMPORTANTE: Responde de forma natural y amigable usando esta información. '
  context += 'No digas "según la base de conocimiento" ni cites la fuente, simplemente responde como si lo supieras.\n'

  return context
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
  return `Eres Vence AI, la asistente de inteligencia artificial de Vence, una plataforma de preparación para oposiciones en España.

SOBRE TI:
- Te llamas Vence AI y eres la asistente de IA de Vence
- Eres una tutora especializada en tests psicotécnicos para oposiciones
- Ayudas a los usuarios a resolver y entender ejercicios de razonamiento lógico, series numéricas, gráficos, tablas, etc.

ESTILO DE INTERACCIÓN:
- Sé claro y didáctico al explicar la lógica detrás de cada ejercicio
- Usa ejemplos paso a paso cuando sea necesario
- Si hay datos numéricos o gráficos, analízalos con precisión
- Explica los patrones y estrategias para resolver este tipo de ejercicios

FORMATO DE RESPUESTA (muy importante):
- Usa emojis para hacer las respuestas visuales: 🔢 📊 💡 ✅ 🎯 📈 🧮 ⚡ 🔍
- Usa **negritas** para destacar números clave y resultados
- Muestra los cálculos paso a paso con listas numeradas (1. 2. 3.)
- Destaca el resultado final: **🎯 Respuesta: X**
- Para series numéricas: muestra el patrón con → (ej: 2 → 4 → 8)

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

  return `Eres Vence AI, la asistente de inteligencia artificial de Vence, una plataforma de preparación para oposiciones en España.

SOBRE TI:
- Te llamas Vence AI y eres la asistente de IA de Vence
- Tienes acceso a una base de datos con 176 leyes y 21.000+ artículos de legislación española actualizada
- Tu conocimiento proviene de esta base de datos, NO de un entrenamiento genérico
- Cuando el usuario pregunta, buscas en la base de datos los artículos más relevantes
${oposicionInfo}

IMPORTANTE - OPOSICIONES AGE (son DIFERENTES, no confundirlas):
- Auxiliar Administrativo del Estado (C2): Grupo C2, requiere ESO/Bachiller, funciones administrativas básicas
- Administrativo del Estado (C1): Grupo C1, requiere FP Grado Superior/Bachiller, funciones de mayor responsabilidad
- Son DOS oposiciones distintas con temarios diferentes, aunque pueden celebrarse el mismo día
- NUNCA digas que son "el mismo puesto" o "la misma oposición"

ESTILO DE INTERACCIÓN:
- Sé conversacional y cercano, como un tutor de oposiciones
- Si la pregunta es ambigua o muy general, PREGUNTA para clarificar antes de responder
  Ejemplo: "¿Te refieres a los plazos de cómputo (días hábiles/naturales), los plazos máximos para resolver, o el silencio administrativo?"
- Si hay varios temas relacionados, ofrece opciones al usuario
- No des respuestas largas si el usuario no ha especificado qué necesita exactamente

FORMATO DE RESPUESTA (muy importante):
- Usa emojis para hacer las respuestas más visuales y atractivas: 📚 📌 ⚖️ ✅ ⏰ 📝 💡 ⚠️ 🔍 📋
- Usa **negritas** para destacar conceptos clave, plazos y artículos importantes
- Usa listas numeradas (1. 2. 3.) para pasos o procedimientos
- Usa listas con viñetas (- ) para enumerar elementos
- Estructura las respuestas con títulos si hay varios temas (### Título)
- Destaca los plazos importantes con formato: **⏰ Plazo: X días**
- Cuando cites artículos: **📌 Art. X de [Ley]**

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

// Validar que una ley tiene preguntas disponibles
async function validateLawHasQuestions(lawShortName) {
  try {
    const { count, error } = await supabase
      .from('questions')
      .select('id, articles!inner(laws!inner(short_name))', { count: 'exact', head: true })
      .eq('is_active', true)
      .eq('articles.laws.short_name', lawShortName)

    if (error) {
      console.warn(`⚠️ Error validando ley ${lawShortName}:`, error.message)
      return false
    }

    return (count || 0) > 0
  } catch (error) {
    console.warn(`⚠️ Error en validateLawHasQuestions para ${lawShortName}:`, error.message)
    return false
  }
}

// Generar sugerencias de seguimiento basadas en la respuesta
async function generateFollowUpSuggestions(sources, response, questionContext, queryType = null, mentionedLaw = null) {
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

  // Validar que las leyes tienen preguntas antes de ofrecerlas
  const validatedLaws = []
  for (const law of lawsInSources) {
    const hasQuestions = await validateLawHasQuestions(law.shortName)
    if (hasQuestions) {
      validatedLaws.push(law)
    } else {
      console.log(`🚫 Ley ${law.shortName} excluida de oferta de test: sin preguntas`)
    }
  }

  // Sugerencias específicas para consultas de exámenes (solo si hay ley mencionada)
  if (queryType === 'exam_stats' && mentionedLaw) {
    // Verificar si la ley mencionada tiene preguntas
    const mentionedLawHasQuestions = await validateLawHasQuestions(mentionedLaw)
    return {
      offerTest: false,
      laws: validatedLaws,
      followUpQuestions: [
        {
          text: `¿Cómo voy yo en ${mentionedLaw}?`,
          label: 'mi_progreso_articulos'
        },
        {
          text: `¿Qué artículos de ${mentionedLaw} debería repasar?`,
          label: 'que_repasar_examen'
        },
        // Solo ofrecer test si la ley tiene preguntas
        ...(mentionedLawHasQuestions ? [{
          text: `Prepárame un test de ${mentionedLaw}`,
          label: 'test_articulos_examen'
        }] : [])
      ]
    }
  }

  // Sugerencias específicas para consultas de progreso del usuario
  // Solo ofrecer botón de test si hay leyes validadas con preguntas
  if (queryType === 'user_stats') {
    return {
      offerTest: validatedLaws.length > 0,
      laws: validatedLaws
    }
  }

  // Si hay leyes validadas, ofrecer preparar test
  if (validatedLaws.length > 0) {
    return {
      offerTest: true,
      laws: validatedLaws
    }
  }

  return { offerTest: false, laws: [] }
}

export async function POST(request) {
  const startTime = Date.now()
  console.log('🚀 [CHAT API] Iniciando request...')

  try {
    console.log('🚀 [CHAT API] Parseando JSON...')
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
    console.log('🚀 [CHAT API] JSON parseado, mensaje:', message?.substring(0, 50))

    if (!message || typeof message !== 'string') {
      return Response.json({
        success: false,
        error: 'Se requiere un mensaje'
      }, { status: 400 })
    }

    // 🚨 VERIFICAR SI EL USUARIO PREGUNTA POR UNA LEY DEROGADA
    const repealedLaw = detectRepealedLaw(message)
    if (repealedLaw) {
      console.log(`⚠️ Usuario preguntó por ley derogada: ${repealedLaw.name}`)

      const warningResponse = `⚠️ **AVISO IMPORTANTE: Ley Derogada**

La **${repealedLaw.name}** está **DEROGADA** y ya no está en vigor.

📌 **Derogada por:** ${repealedLaw.repealedBy}

✅ **Normativa vigente:** ${repealedLaw.replacement}
*${repealedLaw.replacementName}*

---

💡 **Recomendación:** Para tu preparación de oposiciones, debes estudiar la normativa vigente. ¿Quieres que te explique la **${repealedLaw.replacement}** en su lugar?

Si necesitas información histórica sobre la ley derogada por motivos académicos, indícamelo expresamente.`

      // Guardar log de la advertencia
      if (userId) {
        await saveAIChatLog({
          userId,
          message,
          responsePreview: warningResponse.substring(0, 200),
          fullResponse: warningResponse,
          sourcesUsed: [],
          questionContextId: questionContext?.questionId || null,
          questionContextLaw: null,
          suggestionUsed,
          responseTimeMs: Date.now() - startTime,
          tokensUsed: 0,
          hadError: false,
          userOposicion: userOposicion,
          detectedLaws: [repealedLaw.key]
        })
      }

      return Response.json({
        success: true,
        response: warningResponse,
        sources: [],
        isRepealedLawWarning: true,
        repealedLaw: repealedLaw.key,
        replacement: repealedLaw.replacement
      })
    }

    // 🔄 Si no recibimos oposición del frontend pero tenemos userId, obtenerla de la BD (query tipada con Drizzle)
    let resolvedOposicion = userOposicion
    if (!userOposicion && userId) {
      const oposicionFromDb = await getUserOposicion(userId)
      if (oposicionFromDb) {
        resolvedOposicion = oposicionFromDb
        console.log(`🔄 Oposición obtenida de BD (Drizzle): ${resolvedOposicion}`)
      }
    }

    // Usar la oposición resuelta en lugar de la del frontend
    const userOposicionFinal = resolvedOposicion

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
    console.log('🚀 [CHAT API] Obteniendo API key...')
    const apiKey = await getOpenAIKeyTyped()
    console.log('🚀 [CHAT API] API key obtenida:', apiKey ? 'OK' : 'NULL')
    if (!apiKey) {
      return Response.json({
        success: false,
        error: 'La IA no está configurada. Un administrador debe configurar la API key de OpenAI en /admin/ai'
      }, { status: 503 })
    }

    console.log('🚀 [CHAT API] Creando cliente OpenAI...')
    const openai = new OpenAI({ apiKey })
    console.log('🚀 [CHAT API] Cliente OpenAI creado')

    // Obtener leyes prioritarias de la oposición del usuario
    const priorityLawIds = await getOposicionLawIdsTyped(userOposicionFinal)
    if (priorityLawIds.length > 0) {
      console.log(`📚 Usuario con oposición ${userOposicionFinal}: ${priorityLawIds.length} leyes prioritarias`)
    } else if (userOposicionFinal) {
      console.log(`⚠️ Usuario con oposición ${userOposicionFinal} pero sin leyes prioritarias configuradas`)
    } else {
      console.log(`👤 Usuario sin oposición configurada`)
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

    // 🆕 Validar y normalizar leyes detectadas contra la BD
    if (mentionedLaws.length > 0) {
      const validatedLaws = await validateAndNormalizeLaws(mentionedLaws)
      if (validatedLaws.length > 0) {
        console.log(`✅ Leyes validadas: ${validatedLaws.join(', ')}`)
        mentionedLaws = validatedLaws
      } else {
        console.log(`⚠️ Ninguna ley validada de: ${mentionedLaws.join(', ')}`)
      }
    }

    // 🎯 Si hay contexto de pregunta con ley, guardarla para priorizar (NO filtrar)
    let contextLawName = null
    if (questionContext?.lawName && !isPsicotecnico) {
      const contextLaw = questionContext.lawName
      // 🆕 Usar validación dinámica para el contexto de ley
      const validatedContext = await validateAndNormalizeLaws([contextLaw])
      contextLawName = validatedContext.length > 0 ? validatedContext[0] : contextLaw
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
      if (!oposicionForStats && userOposicionFinal) {
        // Mapear el formato de userOposicion al formato de exam_position
        const oposicionMap = {
          'auxiliar_administrativo_estado': 'auxiliar_administrativo',
          'administrativo_estado': 'administrativo'
        }
        oposicionForStats = oposicionMap[userOposicionFinal] || null
        if (oposicionForStats) {
          console.log(`📊 Usando oposición del perfil del usuario: ${userOposicionFinal} -> ${oposicionForStats}`)
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

        // 🆕 Obtener ejemplos de preguntas oficiales REALES si hay ley específica
        let questionExamples = []
        if (lawForStats) {
          questionExamples = await getOfficialQuestionExamples(lawForStats, 6, oposicionForStats)
        }

        // 🆕 Obtener contenido de los artículos más preguntados
        let articleContents = []
        if (lawForStats && stats?.topArticles?.length > 0) {
          const topArticleNumbers = stats.topArticles.slice(0, 8).map(a => a.article)
          articleContents = await getArticleContents(lawForStats, topArticleNumbers, 8)
        }

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
            : !userOposicionFinal && lawForStats
              ? `
NOTA: El usuario NO tiene oposición configurada en su perfil.
Si muestras datos, menciona que los datos son GENERALES de todos los exámenes.
Si hay datos por oposición (Aux.C2, Admin.C1), explica las diferencias.
Al final, sugiere: "Para datos más personalizados, puedes indicarme si preparas Auxiliar (C2) o Administrativo (C1)."
`
              : ''

          // 🆕 Formatear ejemplos de preguntas reales
          let questionExamplesText = ''
          if (questionExamples.length > 0) {
            const formatQuestion = (q, i) => {
              let text = `\n--- EJEMPLO ${i + 1} ---`
              if (q.article_number) text += ` (Art. ${q.article_number})`
              if (q.exam_year) text += ` [Examen ${q.exam_year}]`
              text += `\nPregunta: ${q.question_text?.substring(0, 200)}${q.question_text?.length > 200 ? '...' : ''}`
              text += `\nOpciones: A) ${q.option_a?.substring(0, 50)}... B) ${q.option_b?.substring(0, 50)}...`
              text += `\nRespuesta correcta: ${q.correct_answer}`
              return text
            }

            questionExamplesText = `

EJEMPLOS DE PREGUNTAS OFICIALES REALES DE ${lawForStats}:
(Estas son preguntas que han caído en exámenes oficiales anteriores)
${questionExamples.map(formatQuestion).join('\n')}
`
          }

          // 🆕 Formatear contenido de artículos top
          let articleContentsText = ''
          if (articleContents.length > 0) {
            const formatArticleContent = (art) => {
              const title = art.title ? ` - ${art.title}` : ''
              const content = art.content?.substring(0, 300) || 'Sin contenido'
              return `• Art. ${art.article_number}${title}: ${content}${art.content?.length > 300 ? '...' : ''}`
            }
            articleContentsText = `

CONTENIDO DE LOS ARTÍCULOS MÁS PREGUNTADOS (de qué tratan):
${articleContents.map(formatArticleContent).join('\n\n')}
`
          }

          examStatsContext = `

DATOS DE EXÁMENES OFICIALES EN LA BASE DE DATOS:
${filterText}
Total de preguntas de exámenes oficiales: ${stats.totalOfficialQuestions}

ARTÍCULOS MÁS PREGUNTADOS EN EXÁMENES OFICIALES (con frecuencia real):
${stats.topArticles.map(formatArticle).join('\n')}
${articleContentsText}
${questionExamplesText}
${profileInstruction}
TODOS ESTOS DATOS SON REALES de nuestra base de datos.
- "Aux.C2" = Auxiliar Administrativo del Estado (C2)
- "Admin.C1" = Administrativo del Estado (C1)

CÓMO RESPONDER:
1. Di que has consultado la base de datos de exámenes oficiales reales
2. Menciona el total de preguntas oficiales encontradas
3. Lista los artículos MÁS PREGUNTADOS con su frecuencia EXACTA (copia los números del contexto arriba)
4. Explica brevemente DE QUÉ TRATA cada artículo top (usa el contenido que te he dado)
5. Analiza qué TIPO de conceptos preguntan basándote en los ejemplos reales
6. Sugiere preparar un test con esos artículos
`
          console.log(`📊 Encontradas ${stats.totalOfficialQuestions} preguntas oficiales, top ${stats.topArticles.length} artículos, ${questionExamples.length} ejemplos`)
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
    // También detectar si el mensaje menciona una oposición específica (ej: "auxiliar administrativo")
    let oposicionInfoContext = ''
    const oposicionMencionada = detectOposicion(message)
    const isOposicionQuery = isOposicionInfoQuery(message) || oposicionMencionada

    if (isOposicionQuery && !isPsicotecnico) {
      console.log('📋 Detectada pregunta sobre información de la oposición', { oposicionMencionada, userOposicionFinal })
      queryType = 'oposicion_info' // Siempre setear para evitar sugerencias de test

      // Usar oposición mencionada en mensaje, o la del perfil como fallback
      const oposicionToUse = oposicionMencionada
        ? (oposicionMencionada === 'auxiliar_administrativo' ? 'auxiliar_administrativo_estado' : 'administrativo_estado')
        : userOposicionFinal

      if (oposicionToUse) {
        // Tenemos oposición (del mensaje o del perfil) - dar info directamente
        const oposicionInfo = await getOposicionInfoTyped(oposicionToUse)
        const temario = await getTemarioTyped(oposicionToUse, 50)

        // Formatear nombre de oposición para mostrar
        const oposicionNombre = oposicionToUse === 'auxiliar_administrativo_estado'
          ? 'Auxiliar Administrativo del Estado (C2)'
          : 'Administrativo del Estado (C1)'

        let infoText = `\n\nINFORMACIÓN DE LA OPOSICIÓN: ${oposicionNombre}\n`

        if (oposicionInfo) {
          infoText += `\nDATOS DE LA CONVOCATORIA:`
          if (oposicionInfo.plazasLibres) infoText += `\n- Plazas (acceso libre): ${oposicionInfo.plazasLibres}`
          if (oposicionInfo.plazasPromocionInterna) infoText += `\n- Plazas (promoción interna): ${oposicionInfo.plazasPromocionInterna}`
          if (oposicionInfo.plazasDiscapacidad) infoText += `\n- Plazas (discapacidad): ${oposicionInfo.plazasDiscapacidad}`
          if (oposicionInfo.examDate) infoText += `\n- Fecha de examen: ${oposicionInfo.examDate}`
          if (oposicionInfo.inscriptionStart) infoText += `\n- Inicio inscripción: ${oposicionInfo.inscriptionStart}`
          if (oposicionInfo.inscriptionDeadline) infoText += `\n- Fin inscripción: ${oposicionInfo.inscriptionDeadline}`
          if (oposicionInfo.tituloRequerido) infoText += `\n- Titulación requerida: ${oposicionInfo.tituloRequerido}`
          if (oposicionInfo.salarioMin || oposicionInfo.salarioMax) {
            infoText += `\n- Salario aproximado: ${oposicionInfo.salarioMin || '?'}€ - ${oposicionInfo.salarioMax || '?'}€ brutos/año`
          }
          if (oposicionInfo.isConvocatoriaActiva) {
            infoText += `\n- Estado: CONVOCATORIA ACTIVA`
          }
          if (oposicionInfo.boeReference) infoText += `\n- Referencia BOE: ${oposicionInfo.boeReference}`
        }

        if (temario && temario.length > 0) {
          infoText += `\n\nTEMARIO OFICIAL (${temario.length} temas):`
          // Agrupar por bloque según número de tema (camelCase desde Drizzle)
          const byBloque = {}
          temario.forEach(t => {
            let bloque
            if (t.topicNumber <= 16) bloque = 'I - Organización del Estado'
            else if (t.topicNumber >= 201 && t.topicNumber <= 207) bloque = 'II - Derecho Administrativo'
            else if (t.topicNumber >= 301 && t.topicNumber <= 307) bloque = 'III - Gestión de Personal'
            else if (t.topicNumber >= 401 && t.topicNumber <= 409) bloque = 'IV - Gestión Financiera'
            else if (t.topicNumber >= 501 && t.topicNumber <= 506) bloque = 'V - Informática'
            else if (t.topicNumber >= 601 && t.topicNumber <= 608) bloque = 'VI - Informática (Ofimática)'
            else bloque = 'General'
            if (!byBloque[bloque]) byBloque[bloque] = []
            byBloque[bloque].push(t)
          })
          Object.entries(byBloque).forEach(([bloque, temas]) => {
            infoText += `\n\nBloque ${bloque}:`
            temas.forEach(t => {
              infoText += `\n  - Tema ${t.topicNumber}: ${t.title}`
              if (t.description) infoText += `\n    Epígrafe: ${t.description}`
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

    // 🎯 Variable para contexto de pattern matching
    let patternContext = ''
    let detectedPattern = null

    // 💡 Variable para contexto de knowledge base (FAQs, planes, plataforma)
    let knowledgeBaseContext = ''

    // 💡 PASO 0: Buscar primero en knowledge base (preguntas sobre la plataforma/planes)
    // Solo si NO es pregunta sobre leyes específicas (mentionedLaws vacío)
    if (!isPsicotecnico && mentionedLaws.length === 0 && !questionContext) {
      try {
        const kbEmbedding = await generateEmbedding(openai, message)
        const kbResults = await searchKnowledgeBase(kbEmbedding, 0.40, 2)

        if (kbResults.length > 0 && kbResults[0].similarity > 0.45) {
          // Match de alta confianza en knowledge base
          knowledgeBaseContext = formatKnowledgeBaseContext(kbResults)
          console.log(`💡 Knowledge base match: "${kbResults[0].title}" (${(kbResults[0].similarity * 100).toFixed(1)}%)`)

          // Si el match es muy alto (>60%), es una pregunta puramente sobre la plataforma
          // No buscar artículos de leyes
          if (kbResults[0].similarity > 0.55) {
            searchMethod = 'knowledge_base'
            console.log(`💡 Pregunta sobre plataforma detectada - saltando búsqueda de artículos`)
          }
        }
      } catch (kbError) {
        console.log('Knowledge base search skipped:', kbError.message)
      }
    }

    if (!skipArticleSearch && searchMethod !== 'knowledge_base') {
      // 🎯 PASO 1: Detectar si hay un patrón conocido en la consulta
      detectedPattern = detectQueryPattern(message)

      if (detectedPattern) {
        // Pattern matching detectado - usar búsqueda específica
        console.log(`🎯 Usando PATTERN MATCHING: ${detectedPattern.name}`)
        const lawForPattern = mentionedLaws.length > 0 ? mentionedLaws[0] : null

        // Buscar artículos específicos para este patrón
        const patternArticles = await searchArticlesForPattern(detectedPattern, lawForPattern, 12)

        if (patternArticles.length > 0) {
          articles = patternArticles
          searchMethod = 'pattern'

          // Extraer datos específicos y formatear contexto
          const patternData = extractPatternData(detectedPattern, patternArticles)
          patternContext = formatPatternContext(detectedPattern, patternData, lawForPattern)

          console.log(`✅ Pattern matching exitoso: ${articles.length} artículos relevantes para "${detectedPattern.name}"`)
        } else {
          console.log(`⚠️ Pattern matching sin resultados para "${detectedPattern.name}" - fallback a búsqueda normal`)
          detectedPattern = null // Reset para usar búsqueda normal
        }
      }

      // 🆕 PASO 2: Si NO hubo pattern matching, verificar si es consulta genérica
      if (!detectedPattern) {
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
        } else if (articles.length === 0) {
          // 🆕 PASO 3: Búsqueda semántica/directa/keywords (fallback normal)
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
      }
    } else {
      console.log(`🧠 Saltando búsqueda de artículos (psicotecnico: ${isPsicotecnico}, queryType: ${queryType})`)
    }

    // 🎯 Incluir contexto de pattern matching y knowledge base si existen
    const context = isPsicotecnico ? '' : formatContext(articles) + patternContext + examStatsContext + userStatsContext + ambiguousExamContext + oposicionInfoContext + genericLawQueryContext + knowledgeBaseContext

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
            if (Array.isArray(cd.categories) && Array.isArray(cd.age_groups)) {
              contentDataText += `\nEje X (categorías): ${cd.categories.join(', ')}`
              contentDataText += '\nDatos por serie:'
              cd.age_groups.forEach(group => {
                contentDataText += `\n  - ${group.label}: ${Array.isArray(group.values) ? group.values.join(', ') : group.values}`
              })
            }
            if (cd.chart_data && Array.isArray(cd.chart_data)) {
              contentDataText += '\nDatos del gráfico:'
              cd.chart_data.forEach(item => {
                contentDataText += `\n  - ${item.label || item.category}: ${item.value}`
              })
            }
          } else if (subtype === 'pie_chart') {
            if (cd.chart_title) contentDataText += `\nTítulo: ${cd.chart_title}`
            if (cd.total_value) contentDataText += `\nTotal: ${cd.total_value}`
            if (cd.chart_data && Array.isArray(cd.chart_data)) {
              contentDataText += '\nSectores:'
              cd.chart_data.forEach(item => {
                contentDataText += `\n  - ${item.label}: ${item.value}${item.percentage ? ` (${item.percentage}%)` : ''}`
              })
            }
          } else if (subtype === 'data_tables') {
            if (cd.table_title) contentDataText += `\nTítulo de la tabla: ${cd.table_title}`
            if (Array.isArray(cd.headers)) contentDataText += `\nColumnas: ${cd.headers.join(' | ')}`
            const rows = cd.table_data || cd.rows
            if (Array.isArray(rows)) {
              contentDataText += '\nDatos:'
              rows.forEach((row, i) => {
                if (Array.isArray(row)) {
                  contentDataText += `\n  Fila ${i + 1}: ${row.join(' | ')}`
                } else if (typeof row === 'object') {
                  contentDataText += `\n  Fila ${i + 1}: ${Object.values(row).join(' | ')}`
                }
              })
            }
          } else if (subtype === 'sequence_numeric' || subtype === 'sequence_letter') {
            if (Array.isArray(cd.sequence)) contentDataText += `\nSerie: ${cd.sequence.join(', ')}`
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
      : generateSystemPrompt(context, questionContextText, userOposicionFinal)

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
            // Enviar metadata primero (incluir patrón detectado)
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({
              type: 'meta',
              sources,
              searchMethod,
              patternDetected: detectedPattern ? detectedPattern.name : null
            })}\n\n`))

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
            const suggestions = await generateFollowUpSuggestions(sources, fullResponse, questionContext, queryType, queryLaw)

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
              userOposicion: userOposicionFinal,
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
              userOposicion: userOposicionFinal,
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
    const suggestions = await generateFollowUpSuggestions(sources, response, questionContext, queryType, queryLaw)

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
      userOposicion: userOposicionFinal,
      detectedLaws: mentionedLaws
    })

    // Retornar respuesta con artículos citados
    return Response.json({
      success: true,
      response,
      searchMethod,
      patternDetected: detectedPattern ? detectedPattern.name : null, // 🎯 Info de pattern matching
      hasQuestionContext: !!questionContext,
      potentialErrorDetected,
      questionId: questionContext?.id || null,
      sources,
      suggestions
    })

  } catch (error) {
    console.error('❌ [CHAT API] Error en chat IA:', error)
    console.error('❌ [CHAT API] Stack:', error.stack)
    console.error('❌ [CHAT API] Message:', error.message)

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
