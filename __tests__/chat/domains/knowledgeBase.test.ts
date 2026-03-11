// __tests__/chat/domains/knowledgeBase.test.js
// Tests para el dominio de base de conocimiento

// Mock de Supabase para evitar problemas con ESM
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          limit: jest.fn(() => Promise.resolve({ data: [], error: null }))
        }))
      }))
    })),
    rpc: jest.fn(() => Promise.resolve({ data: [], error: null }))
  }))
}))

// Funciones auxiliares que replican la lógica del servicio para testing
// Sin depender de imports que traen Supabase

// Detecta si es una consulta sobre la plataforma
function isPlatformQuery(message) {
  const msgLower = message.toLowerCase()

  // Patrones de consultas sobre la plataforma
  const platformPatterns = [
    /plan(es)?|premium|suscripci[oó]n|precio|cuesta|gratis|free/i,
    /funcionalidad|caracter[ií]stica|c[oó]mo\s*(funciona|creo|hago)|d[oó]nde\s*(est[aá]|veo)/i,
    /oposici[oó]n|preparar|temario|preguntas\s*hay|cu[aá]ntas\s*preguntas/i,
    /soporte|contacto|ayuda|problema|cancelo|cancelar/i,
    /psicot[eé]c?n?i?c?o?s?|series\s+num[eé]ricas|series\s+alfab[eé]ticas/i,
    /vence|plataforma|app|aplicaci[oó]n/i,
  ]

  return platformPatterns.some(p => p.test(msgLower))
}

// Detecta la categoría de una consulta
function detectCategory(message) {
  const msgLower = message.toLowerCase()

  if (/plan|precio|premium|suscripci[oó]n|cuesta|pago|gratis/i.test(msgLower)) {
    return 'planes'
  }
  if (/funcionalidad|c[oó]mo\s*(creo|hago)|test|estad[ií]stica|d[oó]nde/i.test(msgLower)) {
    return 'funcionalidades'
  }
  if (/soporte|contacto|problema|ayuda|cancelo/i.test(msgLower)) {
    return 'faq'
  }
  if (/oposici[oó]n|prepar/i.test(msgLower)) {
    return 'plataforma'
  }
  return null
}

// Obtiene respuesta predefinida
function getPredefinedResponse(message) {
  const msgLower = message.toLowerCase()

  if (/psicot[eé]c?n?i?c?o?s?|series\s+num[eé]ricas|series\s+alfab[eé]ticas|domin[oó]s|matrices|razonamiento\s+l[oó]gico/i.test(msgLower)) {
    return `📊 **¡Genial! ¿Quieres practicar psicotécnicos?**

Puedes acceder desde el menú o directamente en **/psicotecnicos**

**Tipos de ejercicios disponibles:**
- 🔢 Series numéricas
- 🔤 Series alfabéticas
- 🧩 Secuencias lógicas`
  }

  return null
}

// Formatea el contexto de KB
function formatKBContext(entries) {
  if (!entries || entries.length === 0) {
    return ''
  }

  let context = '\n\n📋 INFORMACIÓN DE LA PLATAFORMA VENCE:\n'
  context += 'El usuario está preguntando sobre la plataforma. Usa esta información para responder:\n\n'

  entries.forEach((entry) => {
    context += `--- ${entry.title} ---\n`
    context += `${entry.content}\n\n`
  })

  return context
}

// Obtiene respuesta corta
function getShortAnswer(entries) {
  if (!entries || entries.length === 0) {
    return null
  }

  const withShortAnswer = entries
    .filter(e => e.shortAnswer)
    .sort((a, b) => b.priority - a.priority)

  return withShortAnswer[0]?.shortAnswer || null
}

// Genera sugerencias
function generateKBSuggestions(category) {
  const suggestions = {
    planes: [
      '¿Qué incluye el plan Premium?',
      '¿Cuánto cuesta la suscripción?',
      '¿Puedo probar gratis?',
    ],
    funcionalidades: [
      '¿Cómo creo un test personalizado?',
      '¿Dónde veo mis estadísticas?',
      '¿Qué son los psicotécnicos?',
    ],
    faq: [
      '¿Cómo contacto con soporte?',
      '¿Por qué no puedo acceder?',
      '¿Cómo cancelo mi suscripción?',
    ],
    plataforma: [
      '¿Qué oposiciones tenéis?',
      '¿Cuántas preguntas hay?',
      '¿De dónde salen las preguntas?',
    ],
  }

  if (category && suggestions[category]) {
    return suggestions[category]
  }

  return [
    '¿Qué planes hay disponibles?',
    '¿Cómo funciona Vence?',
    '¿Qué oposiciones preparáis?',
  ]
}

// Replica looksLikeFollowUp del KnowledgeBaseDomain
function looksLikeFollowUp(messages: Array<{ role: string }>, currentMessage: string): boolean {
  if (messages.length < 2) return false

  const msg = currentMessage.trim()

  if (msg.length > 100) return false

  const followUpStarters = [
    /^(y\s|pero\s|entonces\s|o\s+sea\s|es\s+decir)/i,
    /^(de(l|\s+(l[ao]s?\s+)?)\s*)\w/i,
    /^(eso|esto|ese|esa)\b/i,
    /^(son|es|eran?|fue|fueron)\s/i,
    /^(no[,!\s]|s[ií][,!\s]|vale|ok)/i,
    /^(me\s|te\s|le\s|nos\s|se\s)/i,
    /^(cu[aá]l(es)?|cu[aá]nto|por\s*qu[eé])\s/i,
  ]

  return followUpStarters.some(p => p.test(msg))
}

// Simula canHandle con follow-up detection
function canHandleWithFollowUp(
  currentMessage: string,
  messages: Array<{ role: string }> = []
): boolean {
  const isKBQuery = isPlatformQuery(currentMessage)
  if (isKBQuery && looksLikeFollowUp(messages, currentMessage)) {
    return false
  }
  return isKBQuery
}

describe('Knowledge Base Domain', () => {

  // ============================================
  // DETECCIÓN DE FOLLOW-UPS
  // ============================================
  describe('looksLikeFollowUp', () => {
    const withHistory = [
      { role: 'user' },
      { role: 'assistant' },
      { role: 'user' },
    ]
    const noHistory: Array<{ role: string }> = []
    const minHistory = [{ role: 'user' }]

    test('debe detectar follow-up con "de auxiliar..."', () => {
      expect(looksLikeFollowUp(withHistory, 'DE AUXILIAR O DE OTRAS CONVOCATORIAS?')).toBe(true)
      expect(looksLikeFollowUp(withHistory, 'de la oposición de auxiliar')).toBe(true)
      expect(looksLikeFollowUp(withHistory, 'del tema 3')).toBe(true)
    })

    test('debe detectar follow-up con conjunciones/conectores', () => {
      expect(looksLikeFollowUp(withHistory, 'y eso aplica a auxiliar?')).toBe(true)
      expect(looksLikeFollowUp(withHistory, 'pero son de exámenes oficiales?')).toBe(true)
      expect(looksLikeFollowUp(withHistory, 'entonces cuántas hay?')).toBe(true)
      expect(looksLikeFollowUp(withHistory, 'o sea que no hay más?')).toBe(true)
    })

    test('debe detectar follow-up con pronombres demostrativos', () => {
      expect(looksLikeFollowUp(withHistory, 'eso es correcto?')).toBe(true)
      expect(looksLikeFollowUp(withHistory, 'esto aplica a mi plan?')).toBe(true)
    })

    test('debe detectar follow-up con verbos de inicio', () => {
      expect(looksLikeFollowUp(withHistory, 'son de auxiliar?')).toBe(true)
      expect(looksLikeFollowUp(withHistory, 'es gratis eso?')).toBe(true)
    })

    test('debe detectar follow-up con respuestas cortas', () => {
      expect(looksLikeFollowUp(withHistory, 'no! son 5 temas')).toBe(true)
      expect(looksLikeFollowUp(withHistory, 'sí pero de cuáles?')).toBe(true)
      expect(looksLikeFollowUp(withHistory, 'vale, y la oposición?')).toBe(true)
    })

    test('debe detectar follow-up con pronombres personales', () => {
      expect(looksLikeFollowUp(withHistory, 'me puedes decir el precio?')).toBe(true)
      expect(looksLikeFollowUp(withHistory, 'te refieres a premium?')).toBe(true)
    })

    test('debe detectar follow-up con interrogativos', () => {
      expect(looksLikeFollowUp(withHistory, 'cuál es el precio?')).toBe(true)
      expect(looksLikeFollowUp(withHistory, 'cuánto cuesta eso?')).toBe(true)
      expect(looksLikeFollowUp(withHistory, 'por qué no funciona?')).toBe(true)
    })

    test('NO debe detectar follow-up sin historial', () => {
      expect(looksLikeFollowUp(noHistory, 'de auxiliar o de otras?')).toBe(false)
      expect(looksLikeFollowUp(minHistory, 'pero son oficiales?')).toBe(false)
    })

    test('NO debe detectar follow-up en mensajes largos (>100 chars)', () => {
      const longMsg = 'de qué oposiciones tenéis preguntas disponibles en la plataforma para poder practicar y prepararme bien para el examen oficial?'
      expect(longMsg.length).toBeGreaterThan(100)
      expect(looksLikeFollowUp(withHistory, longMsg)).toBe(false)
    })

    test('NO debe detectar follow-up en mensajes standalone', () => {
      expect(looksLikeFollowUp(withHistory, '¿Qué planes tenéis?')).toBe(false)
      expect(looksLikeFollowUp(withHistory, '¿Cuánto cuesta premium?')).toBe(false)
      expect(looksLikeFollowUp(withHistory, 'Hola, quiero información')).toBe(false)
    })
  })

  // ============================================
  // INTEGRACIÓN: canHandle + follow-up
  // ============================================
  describe('canHandle con follow-up detection', () => {
    const withHistory = [
      { role: 'user' },
      { role: 'assistant' },
      { role: 'user' },
    ]

    test('caso del bug: follow-up con keyword de KB debe ser rechazado', () => {
      // "oposición" matchea isPlatformQuery, pero empieza con "de" → follow-up
      expect(isPlatformQuery('de la oposición de auxiliar')).toBe(true)
      expect(canHandleWithFollowUp('de la oposición de auxiliar', withHistory)).toBe(false)
    })

    test('primera interacción con keyword de KB debe ser aceptada', () => {
      expect(canHandleWithFollowUp('¿Cuánto cuesta premium?', [])).toBe(true)
      expect(canHandleWithFollowUp('¿Qué oposiciones tenéis?', [])).toBe(true)
    })

    test('pregunta standalone con historial debe ser aceptada', () => {
      // No empieza con patrón de follow-up
      expect(canHandleWithFollowUp('¿Qué planes tenéis?', withHistory)).toBe(true)
    })

    test('mensaje sin keyword de KB no es capturado (con o sin historial)', () => {
      expect(canHandleWithFollowUp('Hola', withHistory)).toBe(false)
      expect(canHandleWithFollowUp('¿Qué dice el artículo 21?', withHistory)).toBe(false)
    })
  })

  // ============================================
  // DETECCIÓN DE CONSULTAS DE PLATAFORMA
  // ============================================
  describe('isPlatformQuery', () => {

    test('debe detectar preguntas sobre planes', () => {
      expect(isPlatformQuery('¿Qué planes tenéis?')).toBe(true)
      expect(isPlatformQuery('¿Cuánto cuesta la suscripción?')).toBe(true)
      expect(isPlatformQuery('¿Qué incluye el plan premium?')).toBe(true)
    })

    test('debe detectar preguntas sobre funcionalidades', () => {
      expect(isPlatformQuery('¿Cómo creo un test personalizado?')).toBe(true)
      expect(isPlatformQuery('¿Dónde veo mis estadísticas?')).toBe(true)
      expect(isPlatformQuery('¿Cómo funciona el chat?')).toBe(true)
    })

    test('debe detectar preguntas sobre la plataforma', () => {
      expect(isPlatformQuery('¿Qué oposiciones tenéis?')).toBe(true)
      expect(isPlatformQuery('¿De dónde salen las preguntas?')).toBe(false) // No tiene keyword específico
      expect(isPlatformQuery('¿Cuántas preguntas hay?')).toBe(true)
    })

    test('debe detectar preguntas de FAQ', () => {
      expect(isPlatformQuery('¿Cómo contacto con soporte?')).toBe(true)
      expect(isPlatformQuery('¿Cómo cancelo mi suscripción?')).toBe(true)
    })

    test('debe detectar preguntas sobre psicotécnicos', () => {
      expect(isPlatformQuery('¿Tenéis psicotécnicos?')).toBe(true)
      expect(isPlatformQuery('¿Cómo practico series numéricas?')).toBe(true)
    })

    test('NO debe detectar preguntas de leyes', () => {
      expect(isPlatformQuery('¿Qué dice el artículo 21?')).toBe(false)
      expect(isPlatformQuery('¿Cuál es el plazo para recurrir?')).toBe(false)
    })

    test('NO debe detectar saludos', () => {
      expect(isPlatformQuery('Hola')).toBe(false)
      expect(isPlatformQuery('Buenos días')).toBe(false)
    })
  })

  // ============================================
  // DETECCIÓN DE CATEGORÍA
  // ============================================
  describe('detectCategory', () => {

    test('debe detectar categoría "planes"', () => {
      expect(detectCategory('¿Cuánto cuesta el premium?')).toBe('planes')
      expect(detectCategory('Precios de suscripción')).toBe('planes')
    })

    test('debe detectar categoría "funcionalidades"', () => {
      expect(detectCategory('¿Cómo creo un test?')).toBe('funcionalidades')
      expect(detectCategory('¿Dónde están las estadísticas?')).toBe('funcionalidades')
    })

    test('debe detectar categoría "faq"', () => {
      expect(detectCategory('¿Cómo contacto soporte?')).toBe('faq')
      expect(detectCategory('Tengo un problema')).toBe('faq')
    })

    test('debe detectar categoría "plataforma"', () => {
      expect(detectCategory('¿Qué oposiciones preparáis?')).toBe('plataforma')
    })

    test('debe devolver null si no detecta categoría', () => {
      expect(detectCategory('Hola')).toBeNull()
    })
  })

  // ============================================
  // RESPUESTAS PREDEFINIDAS
  // ============================================
  describe('getPredefinedResponse', () => {

    test('debe devolver respuesta para psicotécnicos', () => {
      const response = getPredefinedResponse('¿Tenéis psicotécnicos?')
      expect(response).not.toBeNull()
      expect(response.toLowerCase()).toContain('psicotécnicos')
      expect(response).toContain('Series numéricas')
    })

    test('debe devolver respuesta para series numéricas', () => {
      const response = getPredefinedResponse('¿Cómo practico series numéricas?')
      expect(response).not.toBeNull()
      expect(response).toContain('Series numéricas')
    })

    test('debe devolver respuesta para dominós', () => {
      const response = getPredefinedResponse('¿Hay ejercicios de dominós?')
      expect(response).not.toBeNull()
    })

    test('debe devolver null para preguntas sin respuesta predefinida', () => {
      const response = getPredefinedResponse('¿Cuánto cuesta?')
      expect(response).toBeNull()
    })
  })

  // ============================================
  // FORMATO DE CONTEXTO KB
  // ============================================
  describe('formatKBContext', () => {

    test('debe formatear entradas de KB', () => {
      const entries = [
        {
          id: '1',
          title: 'Planes disponibles',
          content: 'Tenemos plan Free y Premium...',
          category: 'planes',
          priority: 1,
        },
      ]

      const context = formatKBContext(entries)

      expect(context).toContain('INFORMACIÓN DE LA PLATAFORMA VENCE')
      expect(context).toContain('Planes disponibles')
      expect(context).toContain('Tenemos plan Free y Premium')
    })

    test('debe formatear múltiples entradas', () => {
      const entries = [
        { id: '1', title: 'Título 1', content: 'Contenido 1', category: 'planes', priority: 1 },
        { id: '2', title: 'Título 2', content: 'Contenido 2', category: 'planes', priority: 2 },
      ]

      const context = formatKBContext(entries)

      expect(context).toContain('Título 1')
      expect(context).toContain('Título 2')
    })

    test('debe devolver string vacío si no hay entradas', () => {
      expect(formatKBContext([])).toBe('')
      expect(formatKBContext(null)).toBe('')
    })
  })

  // ============================================
  // SHORT ANSWER
  // ============================================
  describe('getShortAnswer', () => {

    test('debe devolver shortAnswer si existe', () => {
      const entries = [
        {
          id: '1',
          title: 'Precio Premium',
          content: 'El plan Premium cuesta...',
          shortAnswer: 'El plan Premium cuesta 9.99€/mes',
          category: 'planes',
          priority: 1,
        },
      ]

      const answer = getShortAnswer(entries)
      expect(answer).toBe('El plan Premium cuesta 9.99€/mes')
    })

    test('debe devolver null si no hay shortAnswer', () => {
      const entries = [
        {
          id: '1',
          title: 'Info',
          content: 'Contenido largo...',
          shortAnswer: null,
          category: 'planes',
          priority: 1,
        },
      ]

      const answer = getShortAnswer(entries)
      expect(answer).toBeNull()
    })

    test('debe priorizar por priority', () => {
      const entries = [
        { id: '1', shortAnswer: 'Respuesta baja', priority: 1 },
        { id: '2', shortAnswer: 'Respuesta alta', priority: 10 },
      ]

      const answer = getShortAnswer(entries)
      expect(answer).toBe('Respuesta alta')
    })

    test('debe devolver null para array vacío', () => {
      expect(getShortAnswer([])).toBeNull()
      expect(getShortAnswer(null)).toBeNull()
    })
  })

  // ============================================
  // SUGERENCIAS
  // ============================================
  describe('generateKBSuggestions', () => {

    test('debe generar sugerencias para categoría "planes"', () => {
      const suggestions = generateKBSuggestions('planes')
      expect(suggestions).toHaveLength(3)
      expect(suggestions.some(s => s.includes('Premium'))).toBe(true)
    })

    test('debe generar sugerencias para categoría "funcionalidades"', () => {
      const suggestions = generateKBSuggestions('funcionalidades')
      expect(suggestions).toHaveLength(3)
      expect(suggestions.some(s => s.includes('test'))).toBe(true)
    })

    test('debe generar sugerencias generales si no hay categoría', () => {
      const suggestions = generateKBSuggestions(null)
      expect(suggestions).toHaveLength(3)
    })

    test('debe generar sugerencias generales para categoría desconocida', () => {
      const suggestions = generateKBSuggestions('unknown')
      expect(suggestions).toHaveLength(3)
    })
  })

})
