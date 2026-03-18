/**
 * Tests para /api/teoria/[law]/[articleNumber]
 *
 * Bug: La API hacía parseInt(articleNumber) lo que convertía artículos
 * no numéricos ("General", "DA2", "único") a NaN, causando errores 500.
 * Además, todos los errores devolvían 500 cuando debían ser 404.
 *
 * Fix: Pasar articleNumber como string (article_number es text en BD),
 * devolver 404 para artículos/leyes no encontradas, y migrar a TypeScript.
 */

// ============================================
// TEST: Extracción de articleId desde URL param
// ============================================
describe('Article ID extraction from URL param', () => {
  // Replica la lógica de route.ts líneas 13-21
  function extractArticleId(articleParam: string | undefined): string | null {
    if (!articleParam) return null
    if (articleParam.startsWith('articulo-')) {
      return articleParam.replace('articulo-', '')
    }
    return articleParam
  }

  it('should extract numeric article from plain param', () => {
    expect(extractArticleId('14')).toBe('14')
    expect(extractArticleId('1')).toBe('1')
    expect(extractArticleId('169')).toBe('169')
  })

  it('should extract numeric article from articulo- prefix', () => {
    expect(extractArticleId('articulo-14')).toBe('14')
    expect(extractArticleId('articulo-1')).toBe('1')
  })

  it('should extract non-numeric article from plain param', () => {
    expect(extractArticleId('General')).toBe('General')
    expect(extractArticleId('DA2')).toBe('DA2')
    expect(extractArticleId('único')).toBe('único')
    expect(extractArticleId('DF1')).toBe('DF1')
    expect(extractArticleId('Compromiso8')).toBe('Compromiso8')
    expect(extractArticleId('Retos')).toBe('Retos')
  })

  it('should extract non-numeric article from articulo- prefix', () => {
    expect(extractArticleId('articulo-General')).toBe('General')
    expect(extractArticleId('articulo-DA2')).toBe('DA2')
    expect(extractArticleId('articulo-único')).toBe('único')
  })

  it('should return null for undefined/empty', () => {
    expect(extractArticleId(undefined)).toBeNull()
    expect(extractArticleId('')).toBeNull()
  })
})

// ============================================
// TEST: parseInt vs string — por qué parseInt estaba mal
// ============================================
describe('parseInt vs string for article_number', () => {
  it('parseInt destroys non-numeric article identifiers', () => {
    // Estos son article_number reales en la BD
    expect(parseInt('General')).toBeNaN()
    expect(parseInt('DA2')).toBeNaN()
    expect(parseInt('único')).toBeNaN()
    expect(parseInt('DF1')).toBeNaN()
    expect(parseInt('Compromiso8')).toBeNaN()
    expect(parseInt('Retos')).toBeNaN()
  })

  it('parseInt works for numeric articles but toString is equivalent', () => {
    // Para artículos numéricos, ambos producen el mismo string
    expect(parseInt('14').toString()).toBe('14')
    expect('14').toBe('14') // String directo también funciona
  })

  it('NaN.toString() produces "NaN" which never matches any article', () => {
    // Este era el bug: parseInt("General").toString() === "NaN"
    expect(parseInt('General').toString()).toBe('NaN')
    // La BD buscaba article_number = 'NaN' y no encontraba nada
  })
})

// ============================================
// TEST: HTTP status codes correctos
// ============================================
describe('HTTP status code classification', () => {
  // Replica la lógica de route.ts para clasificar errores
  function getStatusForError(message: string): number {
    const isNotFound = message.includes('ARTICULO_NO_ENCONTRADO') || message.includes('LEY_NO_RECONOCIDA')
    return isNotFound ? 404 : 500
  }

  it('should return 404 for article not found', () => {
    expect(getStatusForError('ARTICULO_NO_ENCONTRADO: El artículo 999 no existe en CE. Artículos disponibles: 1, 2, 3')).toBe(404)
  })

  it('should return 404 for law not recognized', () => {
    expect(getStatusForError('LEY_NO_RECONOCIDA: Ley "ley-falsa" no es válida')).toBe(404)
  })

  it('should return 500 for DB errors', () => {
    expect(getStatusForError('ERROR_BD: connection refused')).toBe(500)
  })

  it('should return 500 for unknown errors', () => {
    expect(getStatusForError('Something unexpected happened')).toBe(500)
  })
})

// ============================================
// TEST: Artículos no numéricos reales en la BD
// ============================================
describe('Non-numeric article_number in database', () => {
  // article_number es text en la BD, estos son valores reales
  const realNonNumericArticles = [
    { number: 'General', law: 'I Plan Gobierno Abierto', description: 'Plan de acción completo como artículo único' },
    { number: 'DA2', law: 'RD 937/2003', description: 'Disposición Adicional' },
    { number: 'DF1', law: 'LO 3/2018', description: 'Disposición Final' },
    { number: 'único', law: 'Protocolo nº 6', description: 'Artículo único del protocolo' },
    { number: 'Compromiso8', law: 'IV Plan Gobierno Abierto', description: 'Compromiso específico del plan' },
    { number: 'Retos', law: 'EDS 2030', description: 'Retos país de la estrategia' },
    { number: 'DA15', law: 'LO 6/1985', description: 'Disposición Adicional 15' },
  ]

  it('should all be valid strings that would work as article_number', () => {
    for (const art of realNonNumericArticles) {
      expect(typeof art.number).toBe('string')
      expect(art.number.length).toBeGreaterThan(0)
      // No se les debe aplicar parseInt
      expect(art.number).toBe(art.number.toString())
    }
  })

  it('parseInt would break all of them', () => {
    for (const art of realNonNumericArticles) {
      expect(isNaN(parseInt(art.number))).toBe(true)
    }
  })

  it('passing as string preserves the identifier', () => {
    for (const art of realNonNumericArticles) {
      // Simula lo que hace fetchArticleContent con .eq('article_number', articleNumber.toString())
      const queryValue = art.number.toString()
      expect(queryValue).toBe(art.number)
    }
  })
})

// ============================================
// TEST: route.ts es TypeScript
// ============================================
describe('Route file is TypeScript', () => {
  const fs = require('fs')

  it('should exist as .ts, not .js', () => {
    expect(fs.existsSync('app/api/teoria/[law]/[articleNumber]/route.ts')).toBe(true)
    expect(fs.existsSync('app/api/teoria/[law]/[articleNumber]/route.js')).toBe(false)
  })

  it('should not use parseInt for articleNumber', () => {
    const content = fs.readFileSync('app/api/teoria/[law]/[articleNumber]/route.ts', 'utf-8')
    expect(content).not.toContain('parseInt(articleNumber)')
    expect(content).not.toContain('parseInt(articleParam)')
  })

  it('should return 404 for not-found errors, not 500', () => {
    const content = fs.readFileSync('app/api/teoria/[law]/[articleNumber]/route.ts', 'utf-8')
    expect(content).toContain('ARTICULO_NO_ENCONTRADO')
    expect(content).toContain('404')
  })

  it('should import NextRequest for type safety', () => {
    const content = fs.readFileSync('app/api/teoria/[law]/[articleNumber]/route.ts', 'utf-8')
    expect(content).toContain('NextRequest')
  })
})

// ============================================
// TEST: Suggestions query uses inner join
// ============================================
describe('Suggestions query in teoriaFetchers', () => {
  const fs = require('fs')

  it('should use inner join for law filter in suggestions query', () => {
    const content = fs.readFileSync('lib/teoriaFetchers.ts', 'utf-8')
    // Find the suggestions query (after PGRST116 check)
    const pgrst116Index = content.indexOf('PGRST116')
    expect(pgrst116Index).toBeGreaterThan(-1)

    // The query after PGRST116 should use laws!inner, not just laws
    const querySection = content.substring(pgrst116Index, pgrst116Index + 500)
    expect(querySection).toContain('laws!inner')
  })
})
