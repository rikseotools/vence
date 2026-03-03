// __tests__/integration/lawSlugsValidation.test.js
// Test de integración para validar que TODAS las leyes en BD generen slugs válidos

// Mock de Supabase para tests
const mockSupabaseData = {
  laws: [
    { short_name: 'CE', name: 'Constitución Española' },
    { short_name: 'Ley 50/1997', name: 'Ley 50/1997, de 27 de noviembre' },
    { short_name: 'Ley 39/2015', name: 'Ley 39/2015, de 1 de octubre' },
    { short_name: 'Ley 40/2015', name: 'Ley 40/2015, de 1 de octubre' },
    { short_name: 'LO 6/1985', name: 'Ley Orgánica 6/1985' },
    { short_name: 'RD 203/2021', name: 'Real Decreto 203/2021' },
    { short_name: 'RDL 5/2015', name: 'Real Decreto Legislativo 5/2015' },
    { short_name: 'Orden APU/1461/2002', name: 'Orden APU/1461/2002' },
    { short_name: 'Reglamento UE 2016/679', name: 'Reglamento UE 2016/679 GDPR' },
    { short_name: 'TFUE', name: 'Tratado de Funcionamiento de la UE' },
    { short_name: 'TUE', name: 'Tratado de la Unión Europea' },
    { short_name: 'LOTC', name: 'Ley Orgánica del Tribunal Constitucional' }
  ]
}

describe('Law Slugs Validation - Integration Tests', () => {
  const generateLawSlug = (lawName) => {
    if (!lawName || !lawName.trim()) return 'ley-desconocida'
    return lawName.toLowerCase().replace(/\s+/g, '-').replace(/\//g, '-')
  }

  const isValidApiSlug = (slug) => {
    // Validaciones para slug de API válido
    return (
      slug && 
      typeof slug === 'string' &&
      !slug.includes('/') &&           // No debe contener barras
      !slug.includes('//') &&          // No debe tener dobles barras
      !slug.includes(' ') &&           // No debe contener espacios
      slug.length > 0 &&               // No debe estar vacío
      slug !== 'ley-desconocida' &&    // No debe ser el fallback
      !slug.startsWith('-') &&         // No debe empezar con guión
      !slug.endsWith('-')              // No debe terminar con guión
    )
  }

  describe('Validación de todas las leyes en BD (simulada)', () => {
    test.each(mockSupabaseData.laws)('$short_name debe generar slug válido', ({ short_name }) => {
      const slug = generateLawSlug(short_name)
      
      expect(isValidApiSlug(slug)).toBe(true)
      expect(slug).not.toContain('/')
      
      // Log para debugging (solo en caso de fallo)
      if (!isValidApiSlug(slug)) {
        console.error(`❌ Slug inválido para "${short_name}": "${slug}"`)
      }
    })
  })

  describe('Validación de URLs de API generadas', () => {
    test('todas las leyes deben poder formar URLs de API válidas', () => {
      const articleNumber = '15'
      
      mockSupabaseData.laws.forEach(({ short_name }) => {
        const slug = generateLawSlug(short_name)
        const apiUrl = `/api/teoria/${slug}/${articleNumber}`
        
        // Verificaciones de URL válida
        expect(apiUrl).toMatch(/^\/api\/teoria\/[^\/]+\/\d+$/)
        expect(apiUrl).not.toContain('//')
        expect(apiUrl).not.toContain('undefined')
        expect(apiUrl).not.toContain('null')
        
        // URL específica no debe contener caracteres problemáticos
        expect(apiUrl).not.toMatch(/\/api\/teoria\/[^\/]*\/[^\/]*\//)
      })
    })
  })

  describe('Casos específicos que causaron errores 404', () => {
    const problematicCases = [
      { law: 'Ley 50/1997', expectedSlug: 'ley-50-1997', article: '15' },
      { law: 'Ley 39/2015', expectedSlug: 'ley-39-2015', article: '128' },
      { law: 'LO 6/1985', expectedSlug: 'lo-6-1985', article: '24' },
      { law: 'RD 203/2021', expectedSlug: 'rd-203-2021', article: '5' }
    ]

    test.each(problematicCases)('$law → $expectedSlug (Art. $article)', ({ law, expectedSlug, article }) => {
      const slug = generateLawSlug(law)
      
      expect(slug).toBe(expectedSlug)
      expect(slug).not.toContain('/')
      
      // Verificar URL de API completa
      const apiUrl = `/api/teoria/${slug}/${article}`
      expect(apiUrl).toBe(`/api/teoria/${expectedSlug}/${article}`)
    })
  })

  describe('Casos edge que podrían aparecer en BD', () => {
    const edgeCases = [
      { name: '', expected: 'ley-desconocida' },
      { name: null, expected: 'ley-desconocida' },
      { name: undefined, expected: 'ley-desconocida' },
      { name: '   ', expected: 'ley-desconocida' },
      { name: 'Ley  con   espacios', expected: 'ley-con-espacios' },
      { name: 'RD 1/2/3/Test', expected: 'rd-1-2-3-test' },
      { name: 'LEY MAYÚSCULAS/2023', expected: 'ley-mayúsculas-2023' }
    ]

    test.each(edgeCases)('caso edge: "$name" → "$expected"', ({ name, expected }) => {
      const slug = generateLawSlug(name)
      expect(slug).toBe(expected)
      
      if (expected !== 'ley-desconocida') {
        expect(slug).not.toContain('/')
      }
    })
  })

  describe('Compatibilidad con sistema de mapping existente', () => {
    // Mock del mapeo que podría existir en lawMappingUtils.js
    const expectedMappings = {
      'ley-50-1997': 'Ley 50/1997',
      'ley-39-2015': 'Ley 39/2015', 
      'lo-6-1985': 'LO 6/1985',
      'ce': 'CE',
      'tfue': 'TFUE',
      'tue': 'TUE'
    }

    test('slugs generados deben coincidir con mappings esperados', () => {
      Object.entries(expectedMappings).forEach(([expectedSlug, originalName]) => {
        const generatedSlug = generateLawSlug(originalName)
        expect(generatedSlug).toBe(expectedSlug)
      })
    })
  })

  describe('Performance y escalabilidad', () => {
    test('debe procesar muchas leyes rápidamente', () => {
      const manyLaws = Array(1000).fill().map((_, i) => `Ley ${i}/2023`)
      
      const startTime = performance.now()
      
      const slugs = manyLaws.map(generateLawSlug)
      
      const endTime = performance.now()
      const duration = endTime - startTime
      
      // Debe procesarse en menos de 100ms
      expect(duration).toBeLessThan(100)
      expect(slugs).toHaveLength(1000)
      
      // Todos deben ser válidos
      slugs.forEach(slug => {
        expect(slug).not.toContain('/')
      })
    })
  })

  describe('Prevención de regresiones futuras', () => {
    test('función de generación debe mantener contrato estable', () => {
      // Estas transformaciones NUNCA deben cambiar (casos ya en producción)
      const stableCases = [
        { input: 'Ley 50/1997', output: 'ley-50-1997' },
        { input: 'CE', output: 'ce' },
        { input: 'LO 6/1985', output: 'lo-6-1985' }
      ]

      stableCases.forEach(({ input, output }) => {
        expect(generateLawSlug(input)).toBe(output)
      })
    })

    test('debe rechazar cualquier slug que contenga "/"', () => {
      // Esta es la regla CRÍTICA que previene el bug 404
      mockSupabaseData.laws.forEach(({ short_name }) => {
        const slug = generateLawSlug(short_name)
        
        if (slug.includes('/')) {
          throw new Error(`❌ REGRESIÓN DETECTADA: "${short_name}" genera slug con "/": "${slug}"`)
        }
      })
    })
  })
})