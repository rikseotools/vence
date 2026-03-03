// __tests__/utils/themeFormatting.test.js
// Tests para el formateo de temas según la oposición del usuario

// Reimplementamos las funciones para testear (deben coincidir con app/mis-estadisticas/page.js)
const formatThemeName = (num, oposicionSlug = 'auxiliar-administrativo-estado') => {
  // Administrativo del Estado (C1) - Estructura según /administrativo-estado/test
  if (oposicionSlug === 'administrativo-estado') {
    if (num >= 1 && num <= 11) return `Bloque I - Tema ${num}`
    if (num >= 201 && num <= 204) return `Bloque II - Tema ${num - 200}`
    if (num >= 301 && num <= 307) return `Bloque III - Tema ${num - 300}`
    if (num >= 401 && num <= 409) return `Bloque IV - Tema ${num - 400}`
    if (num >= 501 && num <= 506) return `Bloque V - Tema ${num - 500}`
    if (num >= 601 && num <= 608) return `Bloque VI - Tema ${num - 600}`
    return `Tema ${num}`
  }

  // Auxiliar Administrativo del Estado (C2) - Estructura por defecto
  if (num >= 1 && num <= 16) return `Bloque I - Tema ${num}`
  if (num >= 101 && num <= 112) return `Bloque II - Tema ${num - 100}`

  return `Tema ${num}`
}

const getValidThemeRanges = (oposicionSlug) => {
  if (oposicionSlug === 'administrativo-estado') {
    return [
      { min: 1, max: 11 },      // Bloque I: 11 temas
      { min: 201, max: 204 },   // Bloque II: 4 temas
      { min: 301, max: 307 },   // Bloque III: 7 temas
      { min: 401, max: 409 },   // Bloque IV: 9 temas
      { min: 501, max: 506 },   // Bloque V: 6 temas
      { min: 601, max: 608 },   // Bloque VI: 8 temas
    ]
  }
  // Auxiliar Administrativo C2: 2 bloques (por defecto)
  return [
    { min: 1, max: 16 },      // Bloque I: 16 temas
    { min: 101, max: 112 },   // Bloque II: 12 temas
  ]
}

const isThemeValidForOposicion = (themeNumber, oposicionSlug) => {
  const ranges = getValidThemeRanges(oposicionSlug)
  return ranges.some(r => themeNumber >= r.min && themeNumber <= r.max)
}

describe('Theme Formatting - Administrativo del Estado (C1)', () => {
  const oposicion = 'administrativo-estado'

  describe('formatThemeName para C1', () => {
    // Bloque I: Temas 1-11
    test('Bloque I - Tema 1', () => {
      expect(formatThemeName(1, oposicion)).toBe('Bloque I - Tema 1')
    })

    test('Bloque I - Tema 11 (último del bloque)', () => {
      expect(formatThemeName(11, oposicion)).toBe('Bloque I - Tema 11')
    })

    test('Tema 12 NO pertenece al Bloque I en C1', () => {
      expect(formatThemeName(12, oposicion)).toBe('Tema 12')
    })

    // Bloque II: Temas 201-204
    test('Bloque II - Tema 1 (interno 201)', () => {
      expect(formatThemeName(201, oposicion)).toBe('Bloque II - Tema 1')
    })

    test('Bloque II - Tema 4 (interno 204)', () => {
      expect(formatThemeName(204, oposicion)).toBe('Bloque II - Tema 4')
    })

    // Bloque III: Temas 301-307
    test('Bloque III - Tema 1 (interno 301)', () => {
      expect(formatThemeName(301, oposicion)).toBe('Bloque III - Tema 1')
    })

    test('Bloque III - Tema 7 (interno 307)', () => {
      expect(formatThemeName(307, oposicion)).toBe('Bloque III - Tema 7')
    })

    // Bloque IV: Temas 401-409
    test('Bloque IV - Tema 1 (interno 401)', () => {
      expect(formatThemeName(401, oposicion)).toBe('Bloque IV - Tema 1')
    })

    test('Bloque IV - Tema 9 (interno 409)', () => {
      expect(formatThemeName(409, oposicion)).toBe('Bloque IV - Tema 9')
    })

    // Bloque V: Temas 501-506
    test('Bloque V - Tema 1 (interno 501)', () => {
      expect(formatThemeName(501, oposicion)).toBe('Bloque V - Tema 1')
    })

    test('Bloque V - Tema 6 (interno 506)', () => {
      expect(formatThemeName(506, oposicion)).toBe('Bloque V - Tema 6')
    })

    // Bloque VI: Temas 601-608
    test('Bloque VI - Tema 1 (interno 601)', () => {
      expect(formatThemeName(601, oposicion)).toBe('Bloque VI - Tema 1')
    })

    test('Bloque VI - Tema 8 (interno 608)', () => {
      expect(formatThemeName(608, oposicion)).toBe('Bloque VI - Tema 8')
    })

    // Temas fuera de rango
    test('Tema 101 NO es válido para C1 (es de Auxiliar)', () => {
      expect(formatThemeName(101, oposicion)).toBe('Tema 101')
    })

    test('Tema 999 fuera de rango', () => {
      expect(formatThemeName(999, oposicion)).toBe('Tema 999')
    })
  })

  describe('getValidThemeRanges para C1', () => {
    test('Devuelve 6 rangos para C1', () => {
      const ranges = getValidThemeRanges(oposicion)
      expect(ranges).toHaveLength(6)
    })

    test('Bloque I tiene 11 temas (1-11)', () => {
      const ranges = getValidThemeRanges(oposicion)
      expect(ranges[0]).toEqual({ min: 1, max: 11 })
    })

    test('Bloque II tiene 4 temas (201-204)', () => {
      const ranges = getValidThemeRanges(oposicion)
      expect(ranges[1]).toEqual({ min: 201, max: 204 })
    })

    test('Bloque VI tiene 8 temas (601-608)', () => {
      const ranges = getValidThemeRanges(oposicion)
      expect(ranges[5]).toEqual({ min: 601, max: 608 })
    })
  })

  describe('isThemeValidForOposicion para C1', () => {
    test('Tema 1 es válido', () => {
      expect(isThemeValidForOposicion(1, oposicion)).toBe(true)
    })

    test('Tema 11 es válido', () => {
      expect(isThemeValidForOposicion(11, oposicion)).toBe(true)
    })

    test('Tema 12 NO es válido (fuera de Bloque I)', () => {
      expect(isThemeValidForOposicion(12, oposicion)).toBe(false)
    })

    test('Tema 101 NO es válido (es de Auxiliar C2)', () => {
      expect(isThemeValidForOposicion(101, oposicion)).toBe(false)
    })

    test('Tema 201 es válido (Bloque II)', () => {
      expect(isThemeValidForOposicion(201, oposicion)).toBe(true)
    })

    test('Tema 301 es válido (Bloque III)', () => {
      expect(isThemeValidForOposicion(301, oposicion)).toBe(true)
    })

    test('Tema 608 es válido (último de Bloque VI)', () => {
      expect(isThemeValidForOposicion(608, oposicion)).toBe(true)
    })

    test('Tema 609 NO es válido (fuera de Bloque VI)', () => {
      expect(isThemeValidForOposicion(609, oposicion)).toBe(false)
    })
  })
})

describe('Theme Formatting - Auxiliar Administrativo del Estado (C2)', () => {
  const oposicion = 'auxiliar-administrativo-estado'

  describe('formatThemeName para C2', () => {
    // Bloque I: Temas 1-16
    test('Bloque I - Tema 1', () => {
      expect(formatThemeName(1, oposicion)).toBe('Bloque I - Tema 1')
    })

    test('Bloque I - Tema 16 (último del bloque)', () => {
      expect(formatThemeName(16, oposicion)).toBe('Bloque I - Tema 16')
    })

    // Bloque II: Temas 101-112
    test('Bloque II - Tema 1 (interno 101)', () => {
      expect(formatThemeName(101, oposicion)).toBe('Bloque II - Tema 1')
    })

    test('Bloque II - Tema 12 (interno 112)', () => {
      expect(formatThemeName(112, oposicion)).toBe('Bloque II - Tema 12')
    })

    // Temas de C1 NO deben formatearse con bloques en C2
    test('Tema 201 NO tiene bloque en C2', () => {
      expect(formatThemeName(201, oposicion)).toBe('Tema 201')
    })

    test('Tema 301 NO tiene bloque en C2', () => {
      expect(formatThemeName(301, oposicion)).toBe('Tema 301')
    })
  })

  describe('getValidThemeRanges para C2', () => {
    test('Devuelve 2 rangos para C2', () => {
      const ranges = getValidThemeRanges(oposicion)
      expect(ranges).toHaveLength(2)
    })

    test('Bloque I tiene 16 temas (1-16)', () => {
      const ranges = getValidThemeRanges(oposicion)
      expect(ranges[0]).toEqual({ min: 1, max: 16 })
    })

    test('Bloque II tiene 12 temas (101-112)', () => {
      const ranges = getValidThemeRanges(oposicion)
      expect(ranges[1]).toEqual({ min: 101, max: 112 })
    })
  })

  describe('isThemeValidForOposicion para C2', () => {
    test('Tema 1 es válido', () => {
      expect(isThemeValidForOposicion(1, oposicion)).toBe(true)
    })

    test('Tema 16 es válido', () => {
      expect(isThemeValidForOposicion(16, oposicion)).toBe(true)
    })

    test('Tema 17 NO es válido', () => {
      expect(isThemeValidForOposicion(17, oposicion)).toBe(false)
    })

    test('Tema 101 es válido (Bloque II)', () => {
      expect(isThemeValidForOposicion(101, oposicion)).toBe(true)
    })

    test('Tema 112 es válido (último Bloque II)', () => {
      expect(isThemeValidForOposicion(112, oposicion)).toBe(true)
    })

    test('Tema 113 NO es válido', () => {
      expect(isThemeValidForOposicion(113, oposicion)).toBe(false)
    })

    test('Tema 201 NO es válido (es de C1)', () => {
      expect(isThemeValidForOposicion(201, oposicion)).toBe(false)
    })
  })
})

describe('Theme Formatting - Valor por defecto', () => {
  test('Sin oposición especificada usa C2 por defecto', () => {
    expect(formatThemeName(1)).toBe('Bloque I - Tema 1')
    expect(formatThemeName(101)).toBe('Bloque II - Tema 1')
    expect(formatThemeName(201)).toBe('Tema 201') // C1 tema, no válido en C2
  })

  test('getValidThemeRanges sin parámetro devuelve rangos de C2', () => {
    const ranges = getValidThemeRanges()
    expect(ranges).toHaveLength(2)
  })
})

describe('Integración: Combinación de bloque + título descriptivo', () => {
  // Simula la lógica de combinación usada en mis-estadisticas/page.js
  function combineThemeTitle(temaNumber, descriptiveTitle, oposicionSlug) {
    const bloquePrefix = formatThemeName(temaNumber, oposicionSlug)
    if (!descriptiveTitle) return bloquePrefix
    return `${bloquePrefix}: ${descriptiveTitle}`
  }

  test('C1: Tema 1 con título descriptivo', () => {
    const result = combineThemeTitle(1, 'La Constitución Española de 1978', 'administrativo-estado')
    expect(result).toBe('Bloque I - Tema 1: La Constitución Española de 1978')
  })

  test('C1: Tema 201 con título descriptivo', () => {
    const result = combineThemeTitle(201, 'Atención al Público', 'administrativo-estado')
    expect(result).toBe('Bloque II - Tema 1: Atención al Público')
  })

  test('C1: Tema 301 con título descriptivo', () => {
    const result = combineThemeTitle(301, 'Las Fuentes del Derecho Administrativo', 'administrativo-estado')
    expect(result).toBe('Bloque III - Tema 1: Las Fuentes del Derecho Administrativo')
  })

  test('C1: Tema 601 con título descriptivo', () => {
    const result = combineThemeTitle(601, 'Informática Básica', 'administrativo-estado')
    expect(result).toBe('Bloque VI - Tema 1: Informática Básica')
  })

  test('C2: Tema 1 con título descriptivo', () => {
    const result = combineThemeTitle(1, 'La Constitución Española', 'auxiliar-administrativo-estado')
    expect(result).toBe('Bloque I - Tema 1: La Constitución Española')
  })

  test('C2: Tema 101 con título descriptivo', () => {
    const result = combineThemeTitle(101, 'Atención al ciudadano', 'auxiliar-administrativo-estado')
    expect(result).toBe('Bloque II - Tema 1: Atención al ciudadano')
  })

  test('Sin título descriptivo solo muestra bloque', () => {
    const result = combineThemeTitle(1, null, 'administrativo-estado')
    expect(result).toBe('Bloque I - Tema 1')
  })

  test('Con título vacío solo muestra bloque', () => {
    const result = combineThemeTitle(1, '', 'administrativo-estado')
    expect(result).toBe('Bloque I - Tema 1')
  })
})

describe('Casos Edge', () => {
  test('Tema 0 (tests aleatorios)', () => {
    expect(formatThemeName(0, 'administrativo-estado')).toBe('Tema 0')
    expect(formatThemeName(0, 'auxiliar-administrativo-estado')).toBe('Tema 0')
  })

  test('Tema negativo', () => {
    expect(formatThemeName(-1, 'administrativo-estado')).toBe('Tema -1')
  })

  test('Oposición desconocida usa formato por defecto (C2)', () => {
    expect(formatThemeName(1, 'oposicion-desconocida')).toBe('Bloque I - Tema 1')
    expect(formatThemeName(101, 'oposicion-desconocida')).toBe('Bloque II - Tema 1')
    expect(formatThemeName(201, 'oposicion-desconocida')).toBe('Tema 201')
  })

  test('Límites exactos de cada bloque C1', () => {
    const oposicion = 'administrativo-estado'
    // Bloque I límites
    expect(isThemeValidForOposicion(1, oposicion)).toBe(true)
    expect(isThemeValidForOposicion(11, oposicion)).toBe(true)
    // Bloque II límites
    expect(isThemeValidForOposicion(201, oposicion)).toBe(true)
    expect(isThemeValidForOposicion(204, oposicion)).toBe(true)
    // Bloque III límites
    expect(isThemeValidForOposicion(301, oposicion)).toBe(true)
    expect(isThemeValidForOposicion(307, oposicion)).toBe(true)
    // Bloque IV límites
    expect(isThemeValidForOposicion(401, oposicion)).toBe(true)
    expect(isThemeValidForOposicion(409, oposicion)).toBe(true)
    // Bloque V límites
    expect(isThemeValidForOposicion(501, oposicion)).toBe(true)
    expect(isThemeValidForOposicion(506, oposicion)).toBe(true)
    // Bloque VI límites
    expect(isThemeValidForOposicion(601, oposicion)).toBe(true)
    expect(isThemeValidForOposicion(608, oposicion)).toBe(true)
  })
})
