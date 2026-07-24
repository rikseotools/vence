// __tests__/config/administrativoEstadoConfig.test.ts
// Tests para validar la config de administrativo-estado: IDs, displayNumber, y estructura
import {
  OPOSICIONES,
  getOposicionBySlug,
} from '@/lib/config/oposiciones'

const ADMIN_SLUG = 'administrativo-estado'

// topic_numbers reales en la BD para position_type='administrativo_estado'
const EXPECTED_TOPIC_NUMBERS = {
  bloque1: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
  bloque2: [201, 202, 203, 204],
  bloque3: [301, 302, 303, 304, 305, 306, 307],
  bloque4: [401, 402, 403, 404, 405, 406, 407, 408, 409],
  bloque5: [501, 502, 503, 504, 505, 506],
  bloque6: [601, 602, 603, 604, 605, 606, 607, 608],
}

describe('administrativo-estado config', () => {
  const config = getOposicionBySlug(ADMIN_SLUG)

  test('existe en la config central', () => {
    expect(config).toBeDefined()
    expect(config!.positionType).toBe('administrativo_estado')
  })

  test('tiene 6 bloques con 45 temas totales', () => {
    expect(config!.blocks).toHaveLength(6)
    expect(config!.totalTopics).toBe(45)
    const totalThemes = config!.blocks.reduce((sum, b) => sum + b.themes.length, 0)
    expect(totalThemes).toBe(45)
  })

  test('theme.id coincide con los topic_number reales de la BD', () => {
    const blockIds: Record<string, number[]> = {}
    config!.blocks.forEach(block => {
      blockIds[block.id] = block.themes.map(t => t.id)
    })

    expect(blockIds['bloque1']).toEqual(EXPECTED_TOPIC_NUMBERS.bloque1)
    expect(blockIds['bloque2']).toEqual(EXPECTED_TOPIC_NUMBERS.bloque2)
    expect(blockIds['bloque3']).toEqual(EXPECTED_TOPIC_NUMBERS.bloque3)
    expect(blockIds['bloque4']).toEqual(EXPECTED_TOPIC_NUMBERS.bloque4)
    expect(blockIds['bloque5']).toEqual(EXPECTED_TOPIC_NUMBERS.bloque5)
    expect(blockIds['bloque6']).toEqual(EXPECTED_TOPIC_NUMBERS.bloque6)
  })

  test('todos los temas tienen nombre descriptivo (no genérico)', () => {
    const allThemes = config!.blocks.flatMap(b => b.themes)
    for (const theme of allThemes) {
      // No debe ser un nombre genérico como "Tema 1", "Tema 2"
      expect(theme.name).not.toMatch(/^Tema \d+$/)
      expect(theme.name.length).toBeGreaterThan(5)
    }
  })
})

describe('administrativo-estado displayNumber (POR-BLOQUE, programa oficial)', () => {
  // El programa oficial del Cuerpo General Administrativo del Estado (BOE-A-2025-26262,
  // Resolución 18/12/2025) numera POR-BLOQUE: cada grupo de materias REINICIA en 1
  // (materias generales 1-16, ofimática reinicia 1-12). Nuestro temario editorial son 6
  // bloques; el número VISIBLE de cada bloque reinicia en 1. Coincide con la BD
  // (display_number por-bloque) → breadcrumbs/header e índice muestran lo mismo.
  // Antes este test exigía numeración CONTINUA 12-45; era la asunción equivocada que causó
  // el bug de número incoherente (lo cazó una usuaria). Guardarraíl config↔BD (RDS live):
  // __tests__/integration/oposicionDataCompleteness.test.ts.
  const config = getOposicionBySlug(ADMIN_SLUG)!

  test('bloque 1 (IDs 1-11): el número visible = id (displayNumber opcional)', () => {
    const bloque1 = config.blocks.find(b => b.id === 'bloque1')!
    for (const theme of bloque1.themes) {
      if (theme.displayNumber !== undefined) {
        expect(theme.displayNumber).toBe(theme.id)
      }
    }
  })

  test('cada bloque reinicia su número visible en 1..N (por-bloque)', () => {
    for (const block of config.blocks) {
      const visible = block.themes.map(t => t.displayNumber ?? t.id)
      const expected = Array.from({ length: block.themes.length }, (_, i) => i + 1)
      expect(visible).toEqual(expected)
    }
  })

  test('dentro de un bloque el número visible no se repite', () => {
    for (const block of config.blocks) {
      const visible = block.themes.map(t => t.displayNumber ?? t.id)
      expect(new Set(visible).size).toBe(visible.length)
    }
  })
})

describe('displayNumber en otras oposiciones', () => {
  test('oposiciones con IDs secuenciales no necesitan displayNumber', () => {
    const sequential = ['tramitacion-procesal', 'auxiliar-administrativo-carm', 'auxiliar-administrativo-cyl', 'auxiliar-administrativo-andalucia']

    for (const slug of sequential) {
      const config = getOposicionBySlug(slug)!
      const allThemes = config.blocks.flatMap(b => b.themes)

      // IDs ya son secuenciales, displayNumber no debería existir
      for (const theme of allThemes) {
        if (theme.displayNumber !== undefined) {
          // Si existe, debe coincidir con el id (no cambia nada)
          expect(theme.displayNumber).toBe(theme.id)
        }
      }
    }
  })
})
