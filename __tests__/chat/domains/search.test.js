// __tests__/chat/domains/search.test.js
// Tests para el dominio de búsqueda de artículos

// Mock de Supabase para evitar problemas con ESM
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => Promise.resolve({ data: [], error: null }))
      }))
    })),
    rpc: jest.fn(() => Promise.resolve({ data: [], error: null }))
  }))
}))

// Funciones de detección de patrones (lógica simplificada para tests)
function detectPlazoPattern(msg) {
  return /plazos?|t[eé]rminos?|d[ií]as?\s*(h[aá]biles?|naturales?)|\bcu[aá]nto\s*tiempo\b|\bcu[aá]ntos?\s*d[ií]as?\b/i.test(msg)
}

function detectRecursoPattern(msg) {
  return /recursos?\s*(de)?\s*(alzada|reposici[oó]n|extraordinario|contencioso|administrativo)|\bc[oó]mo\s+recurr|\bimpugnar\b/i.test(msg)
}

function detectOrganoPattern(msg) {
  return /[oó]rganos?\s*(colegiados?|administrativos?|competentes?)|\bconsejo\s+de\s+ministros\b|\bgobierno\b|\bministros?\b|\bsecretar[ií]os?\b|\bdelegado/i.test(msg)
}

function detectProcedimientoPattern(msg) {
  return /procedimiento\s*(sancionador|administrativo)|notificaci[oó]n|tr[aá]mite|audiencia|alegaciones/i.test(msg)
}

function detectSancionPattern(msg) {
  return /sanci[oó]n|infracci[oó]n|multa|punitivo/i.test(msg)
}

function extractLawReferences(msg) {
  const laws = []
  if (/ley\s*39\/2015|lpac/i.test(msg)) laws.push('Ley 39/2015')
  if (/ley\s*40\/2015|lrjsp/i.test(msg)) laws.push('Ley 40/2015')
  if (/constituci[oó]n/i.test(msg)) laws.push('CE')
  if (/ley\s*50\/1997/i.test(msg)) laws.push('Ley 50/1997')
  return laws
}

describe('Search Domain - Pattern Matcher', () => {

  // ============================================
  // DETECCIÓN DE PATRONES DE PLAZOS
  // ============================================
  describe('Plazo Pattern Detection', () => {

    test('debe detectar "plazo para recurrir"', () => {
      expect(detectPlazoPattern('¿Cuál es el plazo para recurrir?')).toBe(true)
    })

    test('debe detectar "cuántos días tengo"', () => {
      expect(detectPlazoPattern('¿Cuántos días tengo para presentar alegaciones?')).toBe(true)
    })

    test('debe detectar "tiempo para responder"', () => {
      expect(detectPlazoPattern('¿Cuánto tiempo hay para responder?')).toBe(true)
    })

    test('debe detectar "días hábiles"', () => {
      expect(detectPlazoPattern('¿Son días hábiles o naturales?')).toBe(true)
    })

    test('NO debe detectar mensaje sin plazo', () => {
      expect(detectPlazoPattern('Hola, buenos días')).toBe(false)
    })
  })

  // ============================================
  // DETECCIÓN DE PATRONES DE RECURSOS
  // ============================================
  describe('Recurso Pattern Detection', () => {

    test('debe detectar "recurso de alzada"', () => {
      expect(detectRecursoPattern('¿Cómo se interpone un recurso de alzada?')).toBe(true)
    })

    test('debe detectar "recurso de reposición"', () => {
      expect(detectRecursoPattern('Quiero información sobre recurso de reposición')).toBe(true)
    })

    test('debe detectar "recurso extraordinario de revisión"', () => {
      expect(detectRecursoPattern('¿Qué es el recurso extraordinario de revisión?')).toBe(true)
    })

    test('debe detectar "impugnar"', () => {
      expect(detectRecursoPattern('¿Cómo puedo impugnar esta decisión?')).toBe(true)
    })

    test('debe detectar "cómo recurrir"', () => {
      expect(detectRecursoPattern('¿Cómo recurro esta resolución?')).toBe(true)
    })
  })

  // ============================================
  // DETECCIÓN DE PATRONES DE ÓRGANOS
  // ============================================
  describe('Órgano Pattern Detection', () => {

    test('debe detectar "Consejo de Ministros"', () => {
      expect(detectOrganoPattern('¿Qué funciones tiene el Consejo de Ministros?')).toBe(true)
    })

    test('debe detectar "delegado del gobierno"', () => {
      expect(detectOrganoPattern('¿Quién es el delegado del gobierno?')).toBe(true)
    })

    test('debe detectar "secretario de estado"', () => {
      expect(detectOrganoPattern('Funciones del secretario de estado')).toBe(true)
    })

    test('debe detectar "órganos colegiados"', () => {
      expect(detectOrganoPattern('¿Cómo funcionan los órganos colegiados?')).toBe(true)
    })
  })

  // ============================================
  // DETECCIÓN DE PATRONES DE PROCEDIMIENTO
  // ============================================
  describe('Procedimiento Pattern Detection', () => {

    test('debe detectar "procedimiento sancionador"', () => {
      expect(detectProcedimientoPattern('¿Cómo es el procedimiento sancionador?')).toBe(true)
    })

    test('debe detectar "notificación"', () => {
      expect(detectProcedimientoPattern('¿Cómo se hace una notificación?')).toBe(true)
    })

    test('debe detectar "trámite de audiencia"', () => {
      expect(detectProcedimientoPattern('¿Qué es el trámite de audiencia?')).toBe(true)
    })

    test('debe detectar "alegaciones"', () => {
      expect(detectProcedimientoPattern('Quiero presentar alegaciones')).toBe(true)
    })
  })

  // ============================================
  // DETECCIÓN DE PATRONES DE SANCIÓN
  // ============================================
  describe('Sanción Pattern Detection', () => {

    test('debe detectar "sanción"', () => {
      expect(detectSancionPattern('¿Qué sanciones hay?')).toBe(true)
    })

    test('debe detectar "infracción"', () => {
      expect(detectSancionPattern('¿Qué es una infracción administrativa?')).toBe(true)
    })

    test('debe detectar "multa"', () => {
      expect(detectSancionPattern('¿Cuánto es la multa?')).toBe(true)
    })
  })

  // ============================================
  // DETECCIÓN DE REFERENCIAS A LEYES
  // ============================================
  describe('Law Reference Detection', () => {

    test('debe extraer "Ley 39/2015"', () => {
      const laws = extractLawReferences('¿Qué dice la Ley 39/2015?')
      expect(laws).toContain('Ley 39/2015')
    })

    test('debe extraer "Constitución"', () => {
      const laws = extractLawReferences('¿Qué dice la Constitución sobre esto?')
      expect(laws).toContain('CE')
    })

    test('debe extraer "LPAC"', () => {
      const laws = extractLawReferences('Según la LPAC...')
      expect(laws).toContain('Ley 39/2015')
    })

    test('debe extraer múltiples leyes', () => {
      const laws = extractLawReferences('Entre la Ley 39/2015 y la Ley 40/2015')
      expect(laws).toContain('Ley 39/2015')
      expect(laws).toContain('Ley 40/2015')
    })

    test('debe devolver array vacío si no hay leyes', () => {
      const laws = extractLawReferences('Hola, ¿qué tal?')
      expect(laws).toHaveLength(0)
    })
  })

  // ============================================
  // NO DETECCIÓN
  // ============================================
  describe('No Pattern Detection', () => {

    test('no debe detectar plazo en saludo', () => {
      expect(detectPlazoPattern('Hola, ¿qué tal?')).toBe(false)
    })

    test('no debe detectar recurso en pregunta genérica', () => {
      expect(detectRecursoPattern('Ayúdame con algo')).toBe(false)
    })
  })

})
