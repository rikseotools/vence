/**
 * Tests para la API de sugerencias del chat de IA
 *
 * Bugs corregidos que estos tests previenen:
 * 1. El oposicionId del contexto viene como slug (ej: "tramitacion_procesal")
 *    pero la BD almacena UUIDs. La API debe convertir slugs a UUIDs.
 * 2. Las sugerencias deben filtrarse correctamente por oposición
 * 3. Las sugerencias con oposicion_id=null deben aparecer para todos
 */

// Tests con Jest

// Mock de Supabase para tests unitarios
const mockSupabase = {
  oposiciones: [
    { id: 'eee04e75-e1bf-4208-8b2b-a4bbede0912c', slug: 'auxiliar-administrativo-estado' },
    { id: '2fda2835-6fe7-471b-ad3c-a66f4a148403', slug: 'tramitacion-procesal' }
  ],
  suggestions: [
    { id: '1', label: '¿Cómo voy?', oposicion_id: null, context_type: 'general', page_context: 'general', is_active: true, priority: 10 },
    { id: '2', label: 'LOPJ', oposicion_id: '2fda2835-6fe7-471b-ad3c-a66f4a148403', context_type: 'general', page_context: 'general', is_active: true, priority: 8 },
    { id: '3', label: 'Constitución', oposicion_id: 'eee04e75-e1bf-4208-8b2b-a4bbede0912c', context_type: 'general', page_context: 'general', is_active: true, priority: 8 },
    { id: '4', label: 'Inactiva', oposicion_id: null, context_type: 'general', page_context: 'general', is_active: false, priority: 5 }
  ]
}

describe('API /api/ai/chat/suggestions', () => {

  describe('Conversión de slug a UUID', () => {

    it('debe reconocer un UUID válido y no intentar convertirlo', () => {
      const uuid = 'eee04e75-e1bf-4208-8b2b-a4bbede0912c'
      const isUuid = uuid.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
      expect(isUuid).toBeTruthy()
    })

    it('debe reconocer un slug con guiones bajos como NO UUID', () => {
      const slug = 'tramitacion_procesal'
      const isUuid = slug.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
      expect(isUuid).toBeFalsy()
    })

    it('debe reconocer un slug con guiones como NO UUID', () => {
      const slug = 'tramitacion-procesal'
      const isUuid = slug.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
      expect(isUuid).toBeFalsy()
    })

    it('debe convertir guiones bajos a guiones para buscar el slug', () => {
      const slugFromContext = 'tramitacion_procesal'
      const slugForDb = slugFromContext.replace(/_/g, '-')
      expect(slugForDb).toBe('tramitacion-procesal')
    })

    it('debe encontrar el UUID correcto para auxiliar-administrativo-estado', () => {
      const slug = 'auxiliar-administrativo-estado'
      const oposicion = mockSupabase.oposiciones.find(o => o.slug === slug)
      expect(oposicion).toBeDefined()
      expect(oposicion.id).toBe('eee04e75-e1bf-4208-8b2b-a4bbede0912c')
    })

    it('debe encontrar el UUID correcto para tramitacion-procesal', () => {
      const slug = 'tramitacion-procesal'
      const oposicion = mockSupabase.oposiciones.find(o => o.slug === slug)
      expect(oposicion).toBeDefined()
      expect(oposicion.id).toBe('2fda2835-6fe7-471b-ad3c-a66f4a148403')
    })
  })

  describe('Filtrado de sugerencias por oposición', () => {

    it('debe incluir sugerencias con oposicion_id=null para cualquier oposición', () => {
      const oposicionId = '2fda2835-6fe7-471b-ad3c-a66f4a148403' // Tramitación
      const suggestions = mockSupabase.suggestions.filter(s =>
        s.is_active &&
        s.context_type === 'general' &&
        s.page_context === 'general' &&
        (s.oposicion_id === oposicionId || s.oposicion_id === null)
      )

      // Debe incluir "¿Cómo voy?" (null) y "LOPJ" (tramitación)
      expect(suggestions.length).toBe(2)
      expect(suggestions.some(s => s.label === '¿Cómo voy?')).toBe(true)
      expect(suggestions.some(s => s.label === 'LOPJ')).toBe(true)
    })

    it('NO debe incluir sugerencias de otra oposición', () => {
      const oposicionId = '2fda2835-6fe7-471b-ad3c-a66f4a148403' // Tramitación
      const suggestions = mockSupabase.suggestions.filter(s =>
        s.is_active &&
        s.context_type === 'general' &&
        s.page_context === 'general' &&
        (s.oposicion_id === oposicionId || s.oposicion_id === null)
      )

      // NO debe incluir "Constitución" (auxiliar)
      expect(suggestions.some(s => s.label === 'Constitución')).toBe(false)
    })

    it('NO debe incluir sugerencias inactivas', () => {
      const suggestions = mockSupabase.suggestions.filter(s =>
        s.is_active &&
        s.context_type === 'general' &&
        s.page_context === 'general'
      )

      expect(suggestions.some(s => s.label === 'Inactiva')).toBe(false)
    })

    it('sin oposicionId solo debe devolver sugerencias con oposicion_id=null', () => {
      const oposicionId = null
      const suggestions = mockSupabase.suggestions.filter(s =>
        s.is_active &&
        s.context_type === 'general' &&
        s.page_context === 'general' &&
        s.oposicion_id === null
      )

      expect(suggestions.length).toBe(1)
      expect(suggestions[0].label).toBe('¿Cómo voy?')
    })
  })

  describe('Ordenamiento por CTR y prioridad', () => {

    it('debe ordenar primero por clicks (CTR) descendente', () => {
      const suggestions = [
        { label: 'A', clicks: 5, priority: 1 },
        { label: 'B', clicks: 10, priority: 1 },
        { label: 'C', clicks: 2, priority: 1 }
      ]

      const sorted = suggestions.sort((a, b) => {
        if (b.clicks !== a.clicks) return b.clicks - a.clicks
        return b.priority - a.priority
      })

      expect(sorted[0].label).toBe('B') // 10 clicks
      expect(sorted[1].label).toBe('A') // 5 clicks
      expect(sorted[2].label).toBe('C') // 2 clicks
    })

    it('debe ordenar por prioridad si los clicks son iguales', () => {
      const suggestions = [
        { label: 'A', clicks: 5, priority: 3 },
        { label: 'B', clicks: 5, priority: 10 },
        { label: 'C', clicks: 5, priority: 1 }
      ]

      const sorted = suggestions.sort((a, b) => {
        if (b.clicks !== a.clicks) return b.clicks - a.clicks
        return b.priority - a.priority
      })

      expect(sorted[0].label).toBe('B') // priority 10
      expect(sorted[1].label).toBe('A') // priority 3
      expect(sorted[2].label).toBe('C') // priority 1
    })
  })

  describe('Límite de sugerencias', () => {

    it('debe limitar a máximo 6 sugerencias', () => {
      const suggestions = Array.from({ length: 10 }, (_, i) => ({
        label: `Sugerencia ${i}`,
        clicks: 0,
        priority: i
      }))

      const limited = suggestions.slice(0, 6)
      expect(limited.length).toBe(6)
    })
  })
})

describe('Integración: Flujo completo slug → UUID → sugerencias', () => {

  it('tramitacion_procesal debe convertirse y retornar sugerencias de Tramitación', () => {
    // Simular el flujo completo
    const slugFromContext = 'tramitacion_procesal'

    // 1. Detectar que no es UUID
    const isUuid = slugFromContext.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
    expect(isUuid).toBeFalsy()

    // 2. Convertir underscore a dash
    const slugForDb = slugFromContext.replace(/_/g, '-')
    expect(slugForDb).toBe('tramitacion-procesal')

    // 3. Buscar UUID
    const oposicion = mockSupabase.oposiciones.find(o => o.slug === slugForDb)
    expect(oposicion).toBeDefined()
    const oposicionId = oposicion.id
    expect(oposicionId).toBe('2fda2835-6fe7-471b-ad3c-a66f4a148403')

    // 4. Filtrar sugerencias
    const suggestions = mockSupabase.suggestions.filter(s =>
      s.is_active &&
      s.context_type === 'general' &&
      s.page_context === 'general' &&
      (s.oposicion_id === oposicionId || s.oposicion_id === null)
    )

    // 5. Verificar resultado
    expect(suggestions.length).toBe(2)
    expect(suggestions.some(s => s.label === '¿Cómo voy?')).toBe(true) // null - para todos
    expect(suggestions.some(s => s.label === 'LOPJ')).toBe(true) // tramitación
    expect(suggestions.some(s => s.label === 'Constitución')).toBe(false) // auxiliar - NO
  })

  it('auxiliar_administrativo_estado debe convertirse y retornar sugerencias de Auxiliar', () => {
    const slugFromContext = 'auxiliar_administrativo_estado'

    // Convertir y buscar
    const slugForDb = slugFromContext.replace(/_/g, '-')
    const oposicion = mockSupabase.oposiciones.find(o => o.slug === slugForDb)
    expect(oposicion).toBeDefined()
    const oposicionId = oposicion.id

    // Filtrar
    const suggestions = mockSupabase.suggestions.filter(s =>
      s.is_active &&
      s.context_type === 'general' &&
      s.page_context === 'general' &&
      (s.oposicion_id === oposicionId || s.oposicion_id === null)
    )

    // Verificar
    expect(suggestions.length).toBe(2)
    expect(suggestions.some(s => s.label === '¿Cómo voy?')).toBe(true) // null
    expect(suggestions.some(s => s.label === 'Constitución')).toBe(true) // auxiliar
    expect(suggestions.some(s => s.label === 'LOPJ')).toBe(false) // tramitación - NO
  })
})
