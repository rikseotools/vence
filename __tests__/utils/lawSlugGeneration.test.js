// __tests__/utils/lawSlugGeneration.test.js
// Tests para prevenir errores en generación de slugs de leyes

describe('Law Slug Generation', () => {
  // Función que replica la lógica del openArticleModal (ANTES del fix)
  const generateLawSlugBuggy = (lawName) => {
    return lawName?.toLowerCase().replace(/\s+/g, '-') || 'ley-desconocida'
  }

  // Función que replica la lógica CORREGIDA del openArticleModal
  const generateLawSlugFixed = (lawName) => {
    if (!lawName || !lawName.trim()) return 'ley-desconocida'
    return lawName.toLowerCase().replace(/\s+/g, '-').replace(/\//g, '-')
  }

  // Función que verifica si un slug es válido para API routes
  const isValidApiSlug = (slug) => {
    // No debe contener "/" porque causa problemas en Next.js dynamic routes
    return !slug.includes('/')
  }

  describe('Casos problemáticos que causaban 404', () => {
    const problematicLaws = [
      'Ley 50/1997',
      'Ley 39/2015', 
      'Ley 40/2015',
      'LO 6/1985',
      'RD 203/2021',
      'RDL 5/2015',
      'Orden APU/1461/2002',
      'Reglamento UE 2016/679'
    ]

    test.each(problematicLaws)('"%s" debe generar slug válido (sin "/")', (lawName) => {
      const slugFixed = generateLawSlugFixed(lawName)
      
      // El slug corregido NO debe contener "/"
      expect(slugFixed).not.toContain('/')
      expect(isValidApiSlug(slugFixed)).toBe(true)
    })

    test.each(problematicLaws)('"%s" con función buggy genera slug INVÁLIDO', (lawName) => {
      const slugBuggy = generateLawSlugBuggy(lawName)
      
      // El slug buggy SÍ contiene "/" (para demostrar el problema)
      expect(slugBuggy).toContain('/')
      expect(isValidApiSlug(slugBuggy)).toBe(false)
    })
  })

  describe('Casos que siempre funcionaron', () => {
    const workingLaws = [
      'CE',
      'TFUE', 
      'TUE',
      'LOTC',
      'Windows 10',
      'Base de datos: Access'
    ]

    test.each(workingLaws)('"%s" debe funcionar con ambas funciones', (lawName) => {
      const slugBuggy = generateLawSlugBuggy(lawName)
      const slugFixed = generateLawSlugFixed(lawName)
      
      // Ambos slugs deben ser válidos (no contienen "/")
      expect(isValidApiSlug(slugBuggy)).toBe(true)
      expect(isValidApiSlug(slugFixed)).toBe(true)
    })
  })

  describe('Transformaciones específicas', () => {
    test('debe convertir espacios a guiones', () => {
      expect(generateLawSlugFixed('Ley de Bases')).toBe('ley-de-bases')
      expect(generateLawSlugFixed('Real Decreto Legislativo')).toBe('real-decreto-legislativo')
    })

    test('debe convertir barras a guiones', () => {
      expect(generateLawSlugFixed('Ley 50/1997')).toBe('ley-50-1997')
      expect(generateLawSlugFixed('RD 203/2021')).toBe('rd-203-2021')
    })

    test('debe manejar casos mixtos correctamente', () => {
      expect(generateLawSlugFixed('Orden APU/1461/2002 de Base')).toBe('orden-apu-1461-2002-de-base')
      expect(generateLawSlugFixed('Reglamento UE 2016/679 GDPR')).toBe('reglamento-ue-2016-679-gdpr')
    })

    test('debe manejar casos edge', () => {
      expect(generateLawSlugFixed(null)).toBe('ley-desconocida')
      expect(generateLawSlugFixed(undefined)).toBe('ley-desconocida')
      expect(generateLawSlugFixed('')).toBe('ley-desconocida')
      expect(generateLawSlugFixed('   ')).toBe('ley-desconocida')
    })

    test('debe preservar mayúsculas a minúsculas', () => {
      expect(generateLawSlugFixed('LEY 50/1997')).toBe('ley-50-1997')
      expect(generateLawSlugFixed('LO 6/1985')).toBe('lo-6-1985')
    })
  })

  describe('Validación de URLs de API', () => {
    test('debe generar URLs de API válidas', () => {
      const testCases = [
        { law: 'Ley 50/1997', article: '15', expected: '/api/teoria/ley-50-1997/15' },
        { law: 'LO 6/1985', article: '24', expected: '/api/teoria/lo-6-1985/24' },
        { law: 'CE', article: '14', expected: '/api/teoria/ce/14' }
      ]

      testCases.forEach(({ law, article, expected }) => {
        const slug = generateLawSlugFixed(law)
        const apiUrl = `/api/teoria/${slug}/${article}`
        
        expect(apiUrl).toBe(expected)
        expect(apiUrl).not.toContain('//')
        expect(slug).not.toContain('/')
      })
    })
  })

  describe('Compatibilidad con law mapping utils', () => {
    // Mock de los mappings que existen en lawMappingUtils.js
    const existingMappings = {
      'ley-50-1997': 'Ley 50/1997',
      'ley-39-2015': 'Ley 39/2015',
      'lo-6-1985': 'LO 6/1985',
      'ce': 'CE'
    }

    test('debe generar slugs que coincidan con mappings existentes', () => {
      Object.entries(existingMappings).forEach(([expectedSlug, originalName]) => {
        const generatedSlug = generateLawSlugFixed(originalName)
        expect(generatedSlug).toBe(expectedSlug)
      })
    })
  })
})