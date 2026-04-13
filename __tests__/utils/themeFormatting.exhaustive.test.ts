// __tests__/utils/themeFormatting.exhaustive.test.ts
// Simulaciones exhaustivas: TODAS las oposiciones de la config + escenario
// de cambio de oposición + edge cases.

import { formatThemeName, isThemeValidForOposicion, findThemeInOposicion } from '@/lib/utils/themeFormatting'
import { OPOSICIONES, ALL_OPOSICION_SLUGS, getOposicionBySlug } from '@/lib/config/oposiciones'

describe('Cobertura exhaustiva — TODAS las oposiciones', () => {
  test('Hay al menos 20 oposiciones en config (sanity check)', () => {
    expect(OPOSICIONES.length).toBeGreaterThanOrEqual(20)
  })

  describe.each(ALL_OPOSICION_SLUGS)('Oposición: %s', (slug) => {
    const opo = getOposicionBySlug(slug)!

    test('tiene bloques y temas', () => {
      expect(opo.blocks.length).toBeGreaterThan(0)
      const totalThemes = opo.blocks.reduce((acc, b) => acc + b.themes.length, 0)
      expect(totalThemes).toBeGreaterThan(0)
    })

    test('cada theme.id de la oposición pasa isThemeValidForOposicion', () => {
      for (const block of opo.blocks) {
        for (const theme of block.themes) {
          expect(isThemeValidForOposicion(theme.id, slug)).toBe(true)
        }
      }
    })

    test('formatThemeName devuelve "Bloque X - Tema N" para cada theme válido', () => {
      for (const block of opo.blocks) {
        for (const theme of block.themes) {
          const formatted = formatThemeName(theme.id, slug)
          expect(formatted).toMatch(/^Bloque [IVX]+ - Tema \d+$/)
        }
      }
    })

    test('un topic_number 99999 inexistente devuelve "Tema 99999"', () => {
      expect(formatThemeName(99999, slug)).toBe('Tema 99999')
      expect(isThemeValidForOposicion(99999, slug)).toBe(false)
    })
  })
})

describe('Cambio de oposición — user cambia target en mitad del camino', () => {
  // Escenario: el usuario empezó con `auxiliar_administrativo_estado`,
  // hizo tests (respuestas con tema_number = 1, 11, 101, etc.),
  // después cambió su target a `auxiliar_administrativo_galicia`.
  //
  // Cuando abre /mis-estadisticas con positionType = Galicia, la API
  // filtra por topics.position_type = 'auxiliar_administrativo_galicia'.
  // Los temas de Estado que comparten id con Galicia deben mostrarse con
  // el TÍTULO de Galicia (no el de Estado).
  //
  // El FORMAT del número cambia según el bloque de cada oposición.

  test('Topic 1 (CE) en Madrid vs Galicia: mismo número, mismo bloque, DISTINTO contexto', () => {
    // CE está en ambas como Bloque I, Tema 1
    const madrid = formatThemeName(1, 'auxiliar-administrativo-madrid')
    const galicia = formatThemeName(1, 'auxiliar-administrativo-galicia')
    const estado = formatThemeName(1, 'auxiliar-administrativo-estado')
    expect(madrid).toBe('Bloque I - Tema 1')
    expect(galicia).toBe('Bloque I - Tema 1')
    expect(estado).toBe('Bloque I - Tema 1')
  })

  test('Topic 16 en Madrid está en B2, en Aux Estado está en B1 (regresión bug Tatiana)', () => {
    // Madrid: T16 es "El explorador de Windows" → Bloque II
    // Aux Estado: T16 es "Políticas de igualdad" → Bloque I
    const madrid = formatThemeName(16, 'auxiliar-administrativo-madrid')
    const estado = formatThemeName(16, 'auxiliar-administrativo-estado')
    expect(madrid).toBe('Bloque II - Tema 16')
    expect(estado).toBe('Bloque I - Tema 16')
    expect(madrid).not.toBe(estado)
  })

  test('Topic 101 válido en Aux Estado pero NO en Madrid', () => {
    // Aux Estado: T101 = "Atención al ciudadano" (B2)
    // Madrid: no existe T101
    expect(isThemeValidForOposicion(101, 'auxiliar-administrativo-estado')).toBe(true)
    expect(isThemeValidForOposicion(101, 'auxiliar-administrativo-madrid')).toBe(false)
    // Formato: Estado muestra correcto, Madrid fallback
    expect(formatThemeName(101, 'auxiliar-administrativo-estado')).toBe('Bloque II - Tema 1')
    expect(formatThemeName(101, 'auxiliar-administrativo-madrid')).toBe('Tema 101')
  })

  test('Topic 201 válido en Admin Estado C1 pero NO en Aux Estado C2', () => {
    expect(isThemeValidForOposicion(201, 'administrativo-estado')).toBe(true)
    expect(isThemeValidForOposicion(201, 'auxiliar-administrativo-estado')).toBe(false)
  })

  test('Tras cambio de oposición, temas del target VIEJO ya no se validan para el NUEVO', () => {
    // Usuario cambió de Admin Estado C1 (tenía respuestas en T201) a Aux Estado C2
    // T201 ya no es válido para la nueva oposición
    expect(isThemeValidForOposicion(201, 'auxiliar-administrativo-estado')).toBe(false)
    // La UI mostraría "Tema 201" genérico (fallback seguro, no título inventado)
    expect(formatThemeName(201, 'auxiliar-administrativo-estado')).toBe('Tema 201')
  })
})

describe('Aislamiento entre oposiciones — ningún solapamiento incorrecto', () => {
  test('Ninguna oposición considera válido un topic_number > 999', () => {
    for (const slug of ALL_OPOSICION_SLUGS) {
      expect(isThemeValidForOposicion(99999, slug)).toBe(false)
    }
  })

  test('Cada topic_number de una oposición NO es válido para oposiciones con numeración distinta', () => {
    // T110 (Access en Aux Estado) no debería ser válido para Madrid
    expect(isThemeValidForOposicion(110, 'auxiliar-administrativo-estado')).toBe(true)
    expect(isThemeValidForOposicion(110, 'auxiliar-administrativo-madrid')).toBe(false)
    expect(isThemeValidForOposicion(110, 'auxiliar-administrativo-galicia')).toBe(false)
  })
})

describe('findThemeInOposicion — helper interno', () => {
  test('devuelve info correcta para Aux Estado T1', () => {
    const opo = getOposicionBySlug('auxiliar-administrativo-estado')!
    const info = findThemeInOposicion(opo, 1)
    expect(info).not.toBeNull()
    expect(info!.blockRoman).toBe('I')
    expect(info!.displayNum).toBe(1)
    expect(info!.themeName).toMatch(/Constitución Española/)
  })

  test('devuelve info correcta para Admin Estado T201 con displayNumber', () => {
    const opo = getOposicionBySlug('administrativo-estado')!
    const info = findThemeInOposicion(opo, 201)
    expect(info).not.toBeNull()
    expect(info!.blockRoman).toBe('II')
    expect(info!.displayNum).toBe(12) // displayNumber override
    expect(info!.themeName).toBeTruthy()
  })

  test('null cuando el theme no existe en la oposición', () => {
    const opo = getOposicionBySlug('auxiliar-administrativo-estado')!
    expect(findThemeInOposicion(opo, 99999)).toBeNull()
  })
})

describe('Edge cases numéricos', () => {
  test('Tema 0', () => {
    expect(formatThemeName(0, 'auxiliar-administrativo-estado')).toBe('Tema 0')
    expect(isThemeValidForOposicion(0, 'auxiliar-administrativo-estado')).toBe(false)
  })

  test('Tema negativo', () => {
    expect(formatThemeName(-1, 'auxiliar-administrativo-estado')).toBe('Tema -1')
    expect(isThemeValidForOposicion(-1, 'auxiliar-administrativo-estado')).toBe(false)
  })

  test('NaN', () => {
    expect(formatThemeName(NaN, 'auxiliar-administrativo-estado')).toBe('Tema NaN')
    expect(isThemeValidForOposicion(NaN, 'auxiliar-administrativo-estado')).toBe(false)
  })

  test('Infinity', () => {
    expect(formatThemeName(Infinity, 'auxiliar-administrativo-estado')).toBe('Tema Infinity')
    expect(isThemeValidForOposicion(Infinity, 'auxiliar-administrativo-estado')).toBe(false)
  })
})
