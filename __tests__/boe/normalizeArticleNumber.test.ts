// __tests__/boe/normalizeArticleNumber.test.ts
// Tests unitarios para normalizeArticleNumber e isDisposicionArticle

import { normalizeArticleNumber, isDisposicionArticle } from '@/lib/boe-extractor'

// ============================================
// TESTS: isDisposicionArticle
// ============================================
describe('isDisposicionArticle', () => {
  test('Detecta disposiciones adicionales', () => {
    expect(isDisposicionArticle('DA1')).toBe(true)
    expect(isDisposicionArticle('DA14')).toBe(true)
    expect(isDisposicionArticle('DAunica')).toBe(true)
    expect(isDisposicionArticle('DA_adicional_primera')).toBe(true)
    expect(isDisposicionArticle('DAdecimocuarta')).toBe(true)
  })

  test('Detecta disposiciones transitorias', () => {
    expect(isDisposicionArticle('DT1')).toBe(true)
    expect(isDisposicionArticle('DT9')).toBe(true)
    expect(isDisposicionArticle('DA_transitoria_primera')).toBe(true)
  })

  test('Detecta disposiciones derogatorias y finales', () => {
    expect(isDisposicionArticle('DD')).toBe(true)
    expect(isDisposicionArticle('DDunica')).toBe(true)
    expect(isDisposicionArticle('DF1')).toBe(true)
    expect(isDisposicionArticle('DF4')).toBe(true)
    expect(isDisposicionArticle('DFunica')).toBe(true)
  })

  test('No detecta artículos normales', () => {
    expect(isDisposicionArticle('1')).toBe(false)
    expect(isDisposicionArticle('48')).toBe(false)
    expect(isDisposicionArticle('48 bis')).toBe(false)
    expect(isDisposicionArticle('149')).toBe(false)
    expect(isDisposicionArticle('4.3')).toBe(false)
  })

  test('Es case-insensitive', () => {
    expect(isDisposicionArticle('da1')).toBe(true)
    expect(isDisposicionArticle('dt9')).toBe(true)
    expect(isDisposicionArticle('df4')).toBe(true)
  })
})

// ============================================
// TESTS: normalizeArticleNumber — Formato legado DA_adicional_X
// ============================================
describe('normalizeArticleNumber — Formato legado (DA_tipo_ordinal)', () => {
  test('Convierte DA_adicional_primera → DA1', () => {
    expect(normalizeArticleNumber('DA_adicional_primera')).toBe('DA1')
  })

  test('Convierte DA_adicional_quinta → DA5', () => {
    expect(normalizeArticleNumber('DA_adicional_quinta')).toBe('DA5')
  })

  test('Convierte DA_adicional_décima → DA10', () => {
    expect(normalizeArticleNumber('DA_adicional_décima')).toBe('DA10')
  })

  test('Convierte DA_adicional_única → DAunica', () => {
    expect(normalizeArticleNumber('DA_adicional_única')).toBe('DAunica')
  })

  test('Convierte DA_transitoria_novena → DT9', () => {
    expect(normalizeArticleNumber('DA_transitoria_novena')).toBe('DT9')
  })

  test('Convierte DA_transitoria_primera → DT1', () => {
    expect(normalizeArticleNumber('DA_transitoria_primera')).toBe('DT1')
  })

  test('Convierte DA_final_cuarta → DF4', () => {
    expect(normalizeArticleNumber('DA_final_cuarta')).toBe('DF4')
  })

  test('Convierte DA_final_única → DFunica', () => {
    expect(normalizeArticleNumber('DA_final_única')).toBe('DFunica')
  })

  test('Convierte DA_derogatoria_única → DDunica', () => {
    expect(normalizeArticleNumber('DA_derogatoria_única')).toBe('DDunica')
  })
})

// ============================================
// TESTS: normalizeArticleNumber — Formato compacto (DAdecimocuarta)
// ============================================
describe('normalizeArticleNumber — Formato compacto (prefijo+ordinal)', () => {
  test('Convierte DAdecimotercera → DA13', () => {
    expect(normalizeArticleNumber('DAdecimotercera')).toBe('DA13')
  })

  test('Convierte DAdecimocuarta → DA14', () => {
    expect(normalizeArticleNumber('DAdecimocuarta')).toBe('DA14')
  })

  test('Convierte DAdecimoquinta → DA15', () => {
    expect(normalizeArticleNumber('DAdecimoquinta')).toBe('DA15')
  })

  test('Convierte DAdecimosexta → DA16', () => {
    expect(normalizeArticleNumber('DAdecimosexta')).toBe('DA16')
  })

  test('Convierte DAdecimoséptima → DA17', () => {
    expect(normalizeArticleNumber('DAdecimoséptima')).toBe('DA17')
  })

  test('Convierte DAunica → DAunica', () => {
    expect(normalizeArticleNumber('DAunica')).toBe('DAunica')
  })

  test('Convierte dadecimocuarta (minúsculas) → DA14', () => {
    expect(normalizeArticleNumber('dadecimocuarta')).toBe('DA14')
  })
})

// ============================================
// TESTS: normalizeArticleNumber — Formato canónico (ya correcto)
// ============================================
describe('normalizeArticleNumber — Formato canónico (sin cambios)', () => {
  test('DA1 se mantiene', () => {
    expect(normalizeArticleNumber('DA1')).toBe('DA1')
  })

  test('DT9 se mantiene', () => {
    expect(normalizeArticleNumber('DT9')).toBe('DT9')
  })

  test('DF4 se mantiene', () => {
    expect(normalizeArticleNumber('DF4')).toBe('DF4')
  })

  test('DA15 se mantiene', () => {
    expect(normalizeArticleNumber('DA15')).toBe('DA15')
  })

  test('DDunica se mantiene', () => {
    expect(normalizeArticleNumber('DDunica')).toBe('DDunica')
  })

  test('DD se mantiene', () => {
    expect(normalizeArticleNumber('DD')).toBe('DD')
  })

  test('DF se mantiene', () => {
    expect(normalizeArticleNumber('DF')).toBe('DF')
  })
})

// ============================================
// TESTS: normalizeArticleNumber — Normalización case
// ============================================
describe('normalizeArticleNumber — Normalización de mayúsculas/minúsculas', () => {
  test('da9 → DA9', () => {
    expect(normalizeArticleNumber('da9')).toBe('DA9')
  })

  test('dt3 → DT3', () => {
    expect(normalizeArticleNumber('dt3')).toBe('DT3')
  })

  test('df1 → DF1', () => {
    expect(normalizeArticleNumber('df1')).toBe('DF1')
  })

  test('dd → DD', () => {
    expect(normalizeArticleNumber('dd')).toBe('DD')
  })
})

// ============================================
// TESTS: normalizeArticleNumber — Artículos normales (no disposiciones)
// ============================================
describe('normalizeArticleNumber — Artículos normales', () => {
  test('No modifica artículos numéricos simples', () => {
    expect(normalizeArticleNumber('1')).toBe('1')
    expect(normalizeArticleNumber('48')).toBe('48')
    expect(normalizeArticleNumber('149')).toBe('149')
  })

  test('Normaliza artículos con sufijo (bis, ter)', () => {
    expect(normalizeArticleNumber('48 bis')).toBe('48 bis')
    expect(normalizeArticleNumber('47 bis')).toBe('47 bis')
  })

  test('No trunca artículos con punto (4.3, 2.2)', () => {
    // CRÍTICO: este es el bug que causaba que parseInt('4.3') = 4
    expect(normalizeArticleNumber('4.3')).toBe('4.3')
    expect(normalizeArticleNumber('2.2')).toBe('2.2')
    expect(normalizeArticleNumber('3.4')).toBe('3.4')
  })

  test('Maneja null y undefined', () => {
    expect(normalizeArticleNumber(null)).toBe('')
    expect(normalizeArticleNumber(undefined)).toBe('')
    expect(normalizeArticleNumber('')).toBe('')
  })
})

// ============================================
// TESTS: Bug parseInt('4.3') = 4 en getArticlesForLaw
// ============================================
describe('Bug: parseInt trunca artículos con punto decimal', () => {
  test('parseInt trunca 4.3 a 4 — este era el bug', () => {
    // Demostración del bug original
    expect(parseInt('4.3')).toBe(4) // parseInt pierde el .3
    expect(parseInt('2.2')).toBe(2) // parseInt pierde el .2
  })

  test('article_number debe preservarse como string, no convertirse a int', () => {
    // Simulación de getArticlesForLaw — ANTES del fix (bug)
    const buggyTransform = (articleNumber: string) =>
      isNaN(parseInt(articleNumber)) ? articleNumber : parseInt(articleNumber)

    expect(buggyTransform('4.3')).toBe(4) // BUG: pierde el .3
    expect(buggyTransform('2.2')).toBe(2) // BUG: pierde el .2

    // DESPUÉS del fix — se devuelve el string original
    const fixedTransform = (articleNumber: string) => articleNumber

    expect(fixedTransform('4.3')).toBe('4.3') // OK
    expect(fixedTransform('2.2')).toBe('2.2') // OK
    expect(fixedTransform('48')).toBe('48')    // OK
    expect(fixedTransform('DA1')).toBe('DA1')  // OK
  })

  test('El filtro de artículos debe coincidir exactamente con article_number de la BD', () => {
    // topic_scope tiene '4.3', el configurador debe enviar '4.3' (no 4)
    const topicScopeArticles = ['2.2', '3.4', '4.3', '5', '5.5', '8', '9', '10', '11', '12']

    // Simulación: usuario selecciona artículo '4.3' desde el configurador
    const selectedArticles = ['4.3']
    const filtered = topicScopeArticles.filter(a => selectedArticles.includes(a))

    expect(filtered).toEqual(['4.3'])
    expect(filtered).not.toEqual(['4']) // No debe truncar
  })

  test('Seleccionar artículo 4 (truncado) no encuentra preguntas del 4.3', () => {
    // Esto es lo que pasaba con el bug
    const dbArticleNumbers = ['4.3'] // La pregunta está en 4.3
    const selectedByUser = ['4']     // El configurador enviaba 4 (truncado)

    const match = dbArticleNumbers.filter(a => selectedByUser.includes(a))
    expect(match).toEqual([]) // 0 resultados — el usuario veía error
  })
})

// ============================================
// TESTS: Filtro de secciones con disposiciones
// ============================================
describe('Filtro de secciones no debe excluir disposiciones', () => {
  test('parseInt de disposiciones devuelve NaN', () => {
    expect(parseInt('DA1')).toBeNaN()
    expect(parseInt('DT9')).toBeNaN()
    expect(parseInt('DF4')).toBeNaN()
  })

  test('isDisposicionArticle permite incluir disposiciones en el filtro de secciones', () => {
    const articleNumbers = ['1', '2', '3', '48', '49', 'DA14', 'DT1', 'DF4']
    const sectionRange = { start: 1, end: 10 }

    // Simulación del filtro DESPUÉS del fix
    const filtered = articleNumbers.filter(articleNum => {
      if (isDisposicionArticle(articleNum)) return true // Siempre incluir disposiciones
      const num = parseInt(articleNum)
      if (isNaN(num)) return false
      return num >= sectionRange.start && num <= sectionRange.end
    })

    // Artículos 1, 2, 3 están en rango + todas las disposiciones
    expect(filtered).toEqual(['1', '2', '3', 'DA14', 'DT1', 'DF4'])
    expect(filtered).not.toContain('48')
    expect(filtered).not.toContain('49')
  })

  test('Sin el fix, disposiciones se pierden silenciosamente', () => {
    const articleNumbers = ['1', '2', '3', 'DA14', 'DT1']
    const sectionRange = { start: 1, end: 10 }

    // Simulación del filtro ANTES del fix (bug)
    const buggyFiltered = articleNumbers.filter(articleNum => {
      const num = parseInt(articleNum)
      return num >= sectionRange.start && num <= sectionRange.end
    })

    // DA14 y DT1 se pierden porque parseInt devuelve NaN
    expect(buggyFiltered).toEqual(['1', '2', '3'])
    expect(buggyFiltered).not.toContain('DA14') // Perdido!
    expect(buggyFiltered).not.toContain('DT1')  // Perdido!
  })
})
