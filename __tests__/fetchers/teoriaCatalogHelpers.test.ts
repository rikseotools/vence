// __tests__/fetchers/teoriaCatalogHelpers.test.ts
// Unit tests de los helpers PUROS del catálogo de teoría (sin BD).
import {
  normalizeQuery,
  parsePage,
  computeTotalPages,
  clampPage,
  TEORIA_PAGE_SIZE,
} from '@/lib/api/laws/teoriaCatalog'

describe('teoriaCatalog · normalizeQuery', () => {
  it('devuelve "" para nulos/vacíos', () => {
    expect(normalizeQuery(undefined)).toBe('')
    expect(normalizeQuery(null)).toBe('')
    expect(normalizeQuery('')).toBe('')
    expect(normalizeQuery('   ')).toBe('')
  })

  it('recorta y colapsa espacios internos', () => {
    expect(normalizeQuery('  ley   39  ')).toBe('ley 39')
    expect(normalizeQuery('Código\tCivil')).toBe('Código Civil')
  })

  it('acota la longitud a 100 caracteres', () => {
    expect(normalizeQuery('a'.repeat(250)).length).toBe(100)
  })

  it('no altera un término normal', () => {
    expect(normalizeQuery('Constitución')).toBe('Constitución')
  })
})

describe('teoriaCatalog · parsePage', () => {
  it('por defecto es 1', () => {
    expect(parsePage(undefined)).toBe(1)
    expect(parsePage(null)).toBe(1)
    expect(parsePage('')).toBe(1)
  })

  it('rechaza basura, negativos y cero → 1', () => {
    expect(parsePage('abc')).toBe(1)
    expect(parsePage('-5')).toBe(1)
    expect(parsePage('0')).toBe(1)
    expect(parsePage('1.9')).toBe(1) // parseInt("1.9")=1
  })

  it('parsea enteros válidos', () => {
    expect(parsePage('3')).toBe(3)
    expect(parsePage('42')).toBe(42)
  })

  it('acota páginas absurdas al techo', () => {
    expect(parsePage('999999999')).toBe(100000)
  })
})

describe('teoriaCatalog · computeTotalPages', () => {
  it('mínimo 1 aunque no haya resultados', () => {
    expect(computeTotalPages(0, 48)).toBe(1)
  })

  it('redondea hacia arriba', () => {
    expect(computeTotalPages(48, 48)).toBe(1)
    expect(computeTotalPages(49, 48)).toBe(2)
    expect(computeTotalPages(1139, 48)).toBe(24) // ceil(1139/48)=24
  })

  it('pageSize inválido → 1', () => {
    expect(computeTotalPages(100, 0)).toBe(1)
  })
})

describe('teoriaCatalog · clampPage', () => {
  it('acota al rango [1, totalPages]', () => {
    expect(clampPage(5, 3)).toBe(3)
    expect(clampPage(0, 3)).toBe(1)
    expect(clampPage(2, 3)).toBe(2)
    expect(clampPage(-10, 10)).toBe(1)
  })
})

describe('teoriaCatalog · constantes', () => {
  it('TEORIA_PAGE_SIZE es un entero positivo razonable', () => {
    expect(Number.isInteger(TEORIA_PAGE_SIZE)).toBe(true)
    expect(TEORIA_PAGE_SIZE).toBeGreaterThan(0)
    expect(TEORIA_PAGE_SIZE).toBeLessThanOrEqual(100)
  })
})
