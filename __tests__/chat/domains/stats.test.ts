// __tests__/chat/domains/stats.test.js
// Tests para el dominio de estadísticas

// Mock de Supabase para evitar problemas con ESM
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => Promise.resolve({ data: [], error: null }))
      }))
    }))
  }))
}))

// Funciones de estadísticas replicadas para testing
function isExamStatsQuery(message) {
  const msgLower = message.toLowerCase()

  const patterns = [
    /art[ií]culos?.*(ca[ií]do|caen|aparec|pregunta|examen|oficial)/i,
    /examen.*oficial.*(art|pregunta)/i,
    /qu[eé].*preguntas?.*(cae|caen|aparec|suele)/i,
    /qu[eé].*(cae|caen|suele).*examen/i,
    /estad[ií]stica.*examen/i,
    /m[aá]s preguntad/i,
    /preguntas?.*caen.*examen/i,
    /(cae|caen).*en.*examen/i,
    /qu[eé]\s*(tipo|clase)\s*(de)?\s*preguntas/i,
    /preguntas?\s*suele|suele.*caer/i,
  ]

  return patterns.some(p => p.test(msgLower))
}

function isUserStatsQuery(message) {
  const msgLower = message.toLowerCase()

  const patterns = [
    /mi[s]?\s*(progreso|estad[ií]stica|resultado|fallo|error|acierto|rendimiento|punto.*d[eé]bil|[aá]rea.*d[eé]bil)/i,
    /qu[eé].*(he\s*fallado|fallo\s*m[aá]s|me\s*cuesta)/i,
    /d[oó]nde\s*(fallo|tengo.*problema)/i,
    /c[oó]mo\s*voy/i,
    /en\s*qu[eé]\s*debo\s*(mejorar|estudiar|repasar)/i,
    /qu[eé]\s*(art[ií]culos?|temas?|leyes?|partes?)\s*(deber[ií]a|tengo\s*que|necesito)\s*repasar/i,
    /(deber[ií]a|necesito|tengo\s*que)\s*repasar\s*(urgente|m[aá]s)?/i,
    /repasar\s*urgente/i,
    /test\s*(de\s*)?(mis\s*)?(fallo|error|repaso)/i,
    /practicar\s*(mis\s*)?(fallo|error)/i,
    /(fallo|error)s?\s*(de\s*)?(esta\s*semana|este\s*mes|hoy|ayer|[uú]ltimos?\s*\d+\s*d[ií]as?|desde\s*siempre|hist[oó]rico)/i,
  ]

  return patterns.some(p => p.test(msgLower))
}

function detectStatsQueryType(message) {
  if (isExamStatsQuery(message)) return 'exam'
  if (isUserStatsQuery(message)) return 'user'
  return 'none'
}

function parseTemporalPhrase(message) {
  const msgLower = message.toLowerCase()
  const now = new Date()

  if (/esta\s*semana|semana\s*actual/i.test(msgLower)) {
    const monday = new Date(now)
    const day = monday.getDay()
    const diff = day === 0 ? 6 : day - 1
    monday.setDate(monday.getDate() - diff)
    monday.setHours(0, 0, 0, 0)
    return { fromDate: monday, label: 'esta semana' }
  }

  if (/este\s*mes|mes\s*actual/i.test(msgLower)) {
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    firstOfMonth.setHours(0, 0, 0, 0)
    return { fromDate: firstOfMonth, label: 'este mes' }
  }

  const daysMatch = msgLower.match(/(?:hace|[uú]ltimos?)\s*(\d+)\s*d[ií]as?/i)
  if (daysMatch) {
    const days = parseInt(daysMatch[1])
    const fromDate = new Date(now)
    fromDate.setDate(fromDate.getDate() - days)
    fromDate.setHours(0, 0, 0, 0)
    return { fromDate, label: `últimos ${days} días` }
  }

  if (/\bayer\b/i.test(msgLower)) {
    const yesterday = new Date(now)
    yesterday.setDate(yesterday.getDate() - 1)
    yesterday.setHours(0, 0, 0, 0)
    return { fromDate: yesterday, label: 'desde ayer' }
  }

  if (/\bhoy\b/i.test(msgLower)) {
    const today = new Date(now)
    today.setHours(0, 0, 0, 0)
    return { fromDate: today, label: 'hoy' }
  }

  if (/desde\s*siempre|hist[oó]rico|todo\s*el\s*historial|todos?\s*mis\s*fallos/i.test(msgLower)) {
    return { fromDate: null, label: 'histórico' }
  }

  return { fromDate: null, label: null }
}

function extractLawFromMessage(message) {
  const msgLower = message.toLowerCase()

  const lawPatterns = [
    { pattern: /ley\s*39\/2015/i, law: 'Ley 39/2015' },
    { pattern: /ley\s*40\/2015/i, law: 'Ley 40/2015' },
    { pattern: /constituci[oó]n/i, law: 'CE' },
    { pattern: /lpac|procedimiento\s*administrativo\s*com[uú]n/i, law: 'Ley 39/2015' },
    { pattern: /lrjsp|r[eé]gimen\s*jur[ií]dico/i, law: 'Ley 40/2015' },
  ]

  for (const { pattern, law } of lawPatterns) {
    if (pattern.test(msgLower)) {
      return law
    }
  }

  return null
}

function formatExamStatsResponse(stats) {
  let response = `📊 **Estadísticas de Exámenes Oficiales**\n\n`

  if (stats.lawFilter) {
    response += `📋 *Filtro: ${stats.lawFilter}*\n\n`
  }

  response += `Se analizaron **${stats.totalOfficialQuestions} preguntas** de exámenes oficiales.\n\n`
  response += `**🎯 Artículos más preguntados:**\n\n`

  stats.topArticles.forEach((art, i) => {
    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`
    response += `${medal} **${art.law} ${art.article}** - ${art.count} veces\n`
  })

  return response
}

function formatUserStatsResponse(stats, temporalLabel) {
  let response = `📊 **Tu Progreso de Estudio**`

  if (temporalLabel) {
    response += ` (${temporalLabel})`
  }

  response += `\n\n`

  response += `📈 **Resumen:**\n`
  response += `- Total de preguntas: **${stats.totalAnswers}**\n`
  response += `- Correctas: **${stats.totalCorrect}** ✅\n`
  response += `- Falladas: **${stats.totalFailed}** ❌\n`
  response += `- Porcentaje de acierto: **${stats.overallAccuracy}%**\n\n`

  if (stats.mostFailed.length > 0) {
    response += `**❌ Artículos donde más fallas:**\n\n`

    stats.mostFailed.slice(0, 5).forEach((art, i) => {
      response += `${i + 1}. **${art.law} ${art.article}** - ${art.failed} fallos (${art.accuracy}% acierto)\n`
    })
  }

  return response
}

describe('Stats Domain', () => {

  // ============================================
  // DETECCIÓN DE CONSULTAS DE EXAMEN
  // ============================================
  describe('isExamStatsQuery', () => {

    test('debe detectar "qué artículos caen en el examen"', () => {
      expect(isExamStatsQuery('¿Qué artículos caen en el examen?')).toBe(true)
    })

    test('debe detectar "artículos más preguntados"', () => {
      expect(isExamStatsQuery('¿Cuáles son los artículos más preguntados?')).toBe(true)
    })

    test('debe detectar "qué suele caer"', () => {
      expect(isExamStatsQuery('¿Qué suele caer de la Ley 39/2015?')).toBe(true)
    })

    test('debe detectar "estadísticas de examen"', () => {
      expect(isExamStatsQuery('Dame estadísticas del examen')).toBe(true)
    })

    test('debe detectar "preguntas que caen"', () => {
      expect(isExamStatsQuery('¿Qué tipo de preguntas caen?')).toBe(true)
    })

    test('debe detectar "qué preguntas suelen caer"', () => {
      expect(isExamStatsQuery('¿Qué preguntas suelen caer en el examen oficial?')).toBe(true)
    })

    test('NO debe detectar preguntas genéricas', () => {
      expect(isExamStatsQuery('¿Qué dice el artículo 21?')).toBe(false)
    })

    test('NO debe detectar preguntas de usuario', () => {
      expect(isExamStatsQuery('¿Dónde fallo más?')).toBe(false)
    })
  })

  // ============================================
  // DETECCIÓN DE CONSULTAS DE USUARIO
  // ============================================
  describe('isUserStatsQuery', () => {

    test('debe detectar "mis fallos"', () => {
      expect(isUserStatsQuery('¿Cuáles son mis fallos?')).toBe(true)
    })

    test('debe detectar "dónde fallo"', () => {
      expect(isUserStatsQuery('¿Dónde fallo más?')).toBe(true)
    })

    test('debe detectar "cómo voy"', () => {
      expect(isUserStatsQuery('¿Cómo voy con el estudio?')).toBe(true)
    })

    test('debe detectar "qué debería repasar"', () => {
      expect(isUserStatsQuery('¿Qué artículos debería repasar?')).toBe(true)
    })

    test('debe detectar "mis áreas débiles"', () => {
      expect(isUserStatsQuery('¿Cuáles son mis áreas débiles?')).toBe(true)
    })

    test('debe detectar "mi progreso"', () => {
      expect(isUserStatsQuery('¿Cuál es mi progreso?')).toBe(true)
    })

    test('debe detectar "mis errores esta semana"', () => {
      expect(isUserStatsQuery('¿Cuáles son mis errores esta semana?')).toBe(true)
    })

    test('debe detectar "test de fallos"', () => {
      expect(isUserStatsQuery('Quiero hacer un test de mis fallos')).toBe(true)
    })

    test('debe detectar "necesito repasar"', () => {
      expect(isUserStatsQuery('¿Qué necesito repasar urgentemente?')).toBe(true)
    })

    test('NO debe detectar preguntas de examen', () => {
      expect(isUserStatsQuery('¿Qué cae en el examen?')).toBe(false)
    })

    test('NO debe detectar preguntas genéricas', () => {
      expect(isUserStatsQuery('¿Qué dice el artículo 21?')).toBe(false)
    })
  })

  // ============================================
  // TIPO DE CONSULTA
  // ============================================
  describe('detectStatsQueryType', () => {

    test('debe devolver "exam" para consultas de examen', () => {
      expect(detectStatsQueryType('¿Qué artículos caen?')).toBe('exam')
    })

    test('debe devolver "user" para consultas de usuario', () => {
      expect(detectStatsQueryType('¿Dónde fallo?')).toBe('user')
    })

    test('debe devolver "none" para consultas generales', () => {
      expect(detectStatsQueryType('Hola, ¿qué tal?')).toBe('none')
    })
  })

  // ============================================
  // PARSEO TEMPORAL
  // ============================================
  describe('parseTemporalPhrase', () => {

    test('debe parsear "esta semana"', () => {
      const result = parseTemporalPhrase('Mis fallos esta semana')
      expect(result.label).toBe('esta semana')
      expect(result.fromDate).toBeInstanceOf(Date)
      // Debe ser un lunes
      expect(result.fromDate.getDay()).toBe(1)
    })

    test('debe parsear "este mes"', () => {
      const result = parseTemporalPhrase('¿Cómo voy este mes?')
      expect(result.label).toBe('este mes')
      expect(result.fromDate).toBeInstanceOf(Date)
      // Debe ser el día 1
      expect(result.fromDate.getDate()).toBe(1)
    })

    test('debe parsear "últimos 7 días"', () => {
      const result = parseTemporalPhrase('Mis errores de los últimos 7 días')
      expect(result.label).toBe('últimos 7 días')
      expect(result.fromDate).toBeInstanceOf(Date)
    })

    test('debe parsear "hace 30 días"', () => {
      const result = parseTemporalPhrase('Estadísticas de hace 30 días')
      expect(result.label).toBe('últimos 30 días')
      expect(result.fromDate).toBeInstanceOf(Date)
    })

    test('debe parsear "ayer"', () => {
      const result = parseTemporalPhrase('¿Qué fallé ayer?')
      expect(result.label).toBe('desde ayer')
      expect(result.fromDate).toBeInstanceOf(Date)
    })

    test('debe parsear "hoy"', () => {
      const result = parseTemporalPhrase('Mis fallos de hoy')
      expect(result.label).toBe('hoy')
      expect(result.fromDate).toBeInstanceOf(Date)
    })

    test('debe parsear "histórico"', () => {
      const result = parseTemporalPhrase('Todos mis fallos históricos')
      expect(result.label).toBe('histórico')
      expect(result.fromDate).toBeNull()
    })

    test('debe parsear "desde siempre"', () => {
      const result = parseTemporalPhrase('Mis estadísticas desde siempre')
      expect(result.label).toBe('histórico')
      expect(result.fromDate).toBeNull()
    })

    test('debe devolver null para mensaje sin filtro temporal', () => {
      const result = parseTemporalPhrase('¿Dónde fallo?')
      expect(result.label).toBeNull()
      expect(result.fromDate).toBeNull()
    })
  })

  // ============================================
  // EXTRACCIÓN DE LEY
  // ============================================
  describe('extractLawFromMessage', () => {

    test('debe extraer "Ley 39/2015"', () => {
      expect(extractLawFromMessage('¿Qué cae de la Ley 39/2015?')).toBe('Ley 39/2015')
    })

    test('debe extraer "Ley 40/2015"', () => {
      expect(extractLawFromMessage('Estadísticas de Ley 40/2015')).toBe('Ley 40/2015')
    })

    test('debe detectar "Constitución"', () => {
      expect(extractLawFromMessage('¿Qué cae de la Constitución?')).toBe('CE')
    })

    test('debe detectar "LPAC"', () => {
      expect(extractLawFromMessage('Artículos más preguntados de LPAC')).toBe('Ley 39/2015')
    })

    test('debe detectar "LRJSP"', () => {
      expect(extractLawFromMessage('Estadísticas de LRJSP')).toBe('Ley 40/2015')
    })

    test('debe detectar "procedimiento administrativo común"', () => {
      expect(extractLawFromMessage('¿Qué cae del procedimiento administrativo común?')).toBe('Ley 39/2015')
    })

    test('debe devolver null si no hay ley', () => {
      expect(extractLawFromMessage('¿Qué artículos caen más?')).toBeNull()
    })
  })

  // ============================================
  // FORMATO DE RESPUESTAS EXAMEN
  // ============================================
  describe('formatExamStatsResponse', () => {

    test('debe formatear estadísticas de examen', () => {
      const stats = {
        totalOfficialQuestions: 100,
        topArticles: [
          { law: 'Ley 39/2015', article: '21', count: 15, byPosition: {} },
          { law: 'Ley 39/2015', article: '53', count: 10, byPosition: {} },
        ],
        lawFilter: null,
        positionFilter: null,
      }

      const response = formatExamStatsResponse(stats)

      expect(response).toContain('Estadísticas de Exámenes Oficiales')
      expect(response).toContain('100 preguntas')
      expect(response).toContain('21')
      expect(response).toContain('15 veces')
    })

    test('debe incluir medallas', () => {
      const stats = {
        totalOfficialQuestions: 50,
        topArticles: [
          { law: 'Ley 39/2015', article: '21', count: 10, byPosition: {} },
          { law: 'Ley 39/2015', article: '22', count: 8, byPosition: {} },
          { law: 'Ley 39/2015', article: '23', count: 6, byPosition: {} },
        ],
        lawFilter: null,
        positionFilter: null,
      }

      const response = formatExamStatsResponse(stats)

      expect(response).toContain('🥇')
      expect(response).toContain('🥈')
      expect(response).toContain('🥉')
    })

    test('debe incluir filtro de ley si existe', () => {
      const stats = {
        totalOfficialQuestions: 30,
        topArticles: [],
        lawFilter: 'Ley 39/2015',
        positionFilter: null,
      }

      const response = formatExamStatsResponse(stats)

      expect(response).toContain('Ley 39/2015')
    })
  })

  // ============================================
  // FORMATO DE RESPUESTAS USUARIO
  // ============================================
  describe('formatUserStatsResponse', () => {

    test('debe formatear estadísticas de usuario', () => {
      const stats = {
        totalAnswers: 100,
        totalCorrect: 75,
        totalFailed: 25,
        overallAccuracy: 75,
        mostFailed: [
          { law: 'Ley 39/2015', article: 'Art. 21', total: 10, correct: 3, failed: 7, accuracy: 30 },
        ],
        worstAccuracy: [],
        lawFilter: null,
      }

      const response = formatUserStatsResponse(stats, null)

      expect(response).toContain('Tu Progreso de Estudio')
      expect(response).toContain('100')
      expect(response).toContain('75')
      expect(response).toContain('75%')
    })

    test('debe incluir filtro temporal si existe', () => {
      const stats = {
        totalAnswers: 50,
        totalCorrect: 40,
        totalFailed: 10,
        overallAccuracy: 80,
        mostFailed: [],
        worstAccuracy: [],
        lawFilter: null,
      }

      const response = formatUserStatsResponse(stats, 'esta semana')

      expect(response).toContain('esta semana')
    })

    test('debe mostrar artículos más fallados', () => {
      const stats = {
        totalAnswers: 100,
        totalCorrect: 60,
        totalFailed: 40,
        overallAccuracy: 60,
        mostFailed: [
          { law: 'Ley 39/2015', article: 'Art. 21', total: 15, correct: 5, failed: 10, accuracy: 33 },
          { law: 'Ley 40/2015', article: 'Art. 5', total: 12, correct: 4, failed: 8, accuracy: 33 },
        ],
        worstAccuracy: [],
        lawFilter: null,
      }

      const response = formatUserStatsResponse(stats, null)

      expect(response).toContain('donde más fallas')
      expect(response).toContain('Art. 21')
      expect(response).toContain('10 fallos')
    })
  })

})
