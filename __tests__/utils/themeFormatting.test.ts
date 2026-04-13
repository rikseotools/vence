// __tests__/utils/themeFormatting.test.ts
// Tests de formatThemeName + isThemeValidForOposicion.
// Prueban la versión REAL del helper (no duplicada inline) y verifican
// que todas las oposiciones funcionan — no solo Aux Admin Estado.
//
// Regresión: el bug de abr 2026 fue que estos helpers hardcodeaban los
// rangos de Estado como default → usuarios de Madrid/Galicia/Policía veían
// títulos de temas de otras oposiciones mezclados en /mis-estadisticas.

import { formatThemeName, isThemeValidForOposicion } from '@/lib/utils/themeFormatting'

describe('formatThemeName', () => {
  describe('Aux Admin del Estado (C2) — slug: auxiliar-administrativo-estado', () => {
    const slug = 'auxiliar-administrativo-estado'
    test('Tema 1 → Bloque I - Tema 1', () => {
      expect(formatThemeName(1, slug)).toBe('Bloque I - Tema 1')
    })
    test('Tema 16 (último de B1) → Bloque I - Tema 16', () => {
      expect(formatThemeName(16, slug)).toBe('Bloque I - Tema 16')
    })
    test('Tema 101 (primero de B2, displayNumber=1) → Bloque II - Tema 1', () => {
      expect(formatThemeName(101, slug)).toBe('Bloque II - Tema 1')
    })
    test('Tema 112 (último de B2, displayNumber=12) → Bloque II - Tema 12', () => {
      expect(formatThemeName(112, slug)).toBe('Bloque II - Tema 12')
    })
  })

  describe('Administrativo del Estado (C1) — slug: administrativo-estado', () => {
    const slug = 'administrativo-estado'
    test('Tema 1 → Bloque I - Tema 1', () => {
      expect(formatThemeName(1, slug)).toBe('Bloque I - Tema 1')
    })
    test('Tema 201 (displayNumber=12) → Bloque II - Tema 12', () => {
      expect(formatThemeName(201, slug)).toBe('Bloque II - Tema 12')
    })
    test('Tema 301 → Bloque III', () => {
      expect(formatThemeName(301, slug)).toMatch(/^Bloque III - Tema \d+$/)
    })
  })

  describe('Aux Admin Xunta de Galicia (C2) — slug: auxiliar-administrativo-galicia', () => {
    const slug = 'auxiliar-administrativo-galicia'
    test('Tema 1 → Bloque I - Tema 1', () => {
      expect(formatThemeName(1, slug)).toBe('Bloque I - Tema 1')
    })
    test('Tema 14 (primero de B2) → Bloque II - Tema 14', () => {
      expect(formatThemeName(14, slug)).toBe('Bloque II - Tema 14')
    })
  })

  describe('Aux Admin Madrid (caso del bug) — slug: auxiliar-administrativo-madrid', () => {
    const slug = 'auxiliar-administrativo-madrid'
    test('Tema 5 (bloque I) devuelve Bloque I', () => {
      expect(formatThemeName(5, slug)).toMatch(/^Bloque I - Tema \d+$/)
    })
    test('Tema 20 (bloque II) devuelve Bloque II', () => {
      expect(formatThemeName(20, slug)).toMatch(/^Bloque II - Tema \d+$/)
    })
  })

  describe('Fallbacks seguros (antes bug: defaulteaba a Estado)', () => {
    test('Sin slug → "Tema N"', () => {
      expect(formatThemeName(5)).toBe('Tema 5')
    })
    test('Slug null → "Tema N"', () => {
      expect(formatThemeName(5, null)).toBe('Tema 5')
    })
    test('Slug vacío → "Tema N"', () => {
      expect(formatThemeName(5, '')).toBe('Tema 5')
    })
    test('Slug inexistente → "Tema N"', () => {
      expect(formatThemeName(5, 'oposicion-que-no-existe')).toBe('Tema 5')
    })
    test('Tema que no pertenece a la oposición → "Tema N"', () => {
      // Tema 999 no existe en Aux Admin Estado
      expect(formatThemeName(999, 'auxiliar-administrativo-estado')).toBe('Tema 999')
    })
  })
})

describe('isThemeValidForOposicion', () => {
  describe('Detecta temas que SÍ pertenecen a cada oposición', () => {
    test('Aux Estado C2: Tema 1 válido', () => {
      expect(isThemeValidForOposicion(1, 'auxiliar-administrativo-estado')).toBe(true)
    })
    test('Aux Estado C2: Tema 101 válido', () => {
      expect(isThemeValidForOposicion(101, 'auxiliar-administrativo-estado')).toBe(true)
    })
    test('Admin Estado C1: Tema 201 válido', () => {
      expect(isThemeValidForOposicion(201, 'administrativo-estado')).toBe(true)
    })
    test('Madrid: Tema 15 válido', () => {
      expect(isThemeValidForOposicion(15, 'auxiliar-administrativo-madrid')).toBe(true)
    })
    test('Madrid: Tema 21 válido', () => {
      expect(isThemeValidForOposicion(21, 'auxiliar-administrativo-madrid')).toBe(true)
    })
  })

  describe('Rechaza temas que NO pertenecen a la oposición (regresión bug Tatiana)', () => {
    test('Madrid: Tema 101 (propio de Aux Estado) NO es válido', () => {
      expect(isThemeValidForOposicion(101, 'auxiliar-administrativo-madrid')).toBe(false)
    })
    test('Aux Estado C2: Tema 201 (propio de Admin C1) NO es válido', () => {
      expect(isThemeValidForOposicion(201, 'auxiliar-administrativo-estado')).toBe(false)
    })
    test('Admin Estado C1: Tema 101 (propio de Aux C2) NO es válido', () => {
      expect(isThemeValidForOposicion(101, 'administrativo-estado')).toBe(false)
    })
    test('Galicia: Tema 999 inexistente NO es válido', () => {
      expect(isThemeValidForOposicion(999, 'auxiliar-administrativo-galicia')).toBe(false)
    })
  })

  describe('Fallbacks seguros', () => {
    test('Sin slug → false', () => {
      expect(isThemeValidForOposicion(1)).toBe(false)
    })
    test('Slug null → false', () => {
      expect(isThemeValidForOposicion(1, null)).toBe(false)
    })
    test('Slug inexistente → false', () => {
      expect(isThemeValidForOposicion(1, 'oposicion-que-no-existe')).toBe(false)
    })
  })
})
