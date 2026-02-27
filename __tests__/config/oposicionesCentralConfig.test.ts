// __tests__/config/oposicionesCentralConfig.test.ts
// Tests para la config central de oposiciones y sus exports derivados
import { z } from 'zod'
import {
  OPOSICIONES,
  ALL_OPOSICION_SLUGS,
  ALL_POSITION_TYPES,
  SLUG_TO_POSITION_TYPE,
  OPOSICION_SLUGS_ENUM,
  POSITION_TYPES_ENUM,
  getOposicionBySlug,
} from '@/lib/config/oposiciones'

// Oposiciones conocidas a fecha del test
const KNOWN_SLUGS = [
  'auxiliar-administrativo-estado',
  'administrativo-estado',
  'tramitacion-procesal',
  'auxilio-judicial',
  'auxiliar-administrativo-carm',
]

const KNOWN_POSITION_TYPES = [
  'auxiliar_administrativo',
  'administrativo',
  'tramitacion_procesal',
  'auxilio_judicial',
  'auxiliar_administrativo_carm',
]

describe('Config central de oposiciones', () => {
  test('ALL_OPOSICION_SLUGS contiene las 5 oposiciones conocidas', () => {
    for (const slug of KNOWN_SLUGS) {
      expect(ALL_OPOSICION_SLUGS).toContain(slug)
    }
    expect(ALL_OPOSICION_SLUGS.length).toBe(5)
  })

  test('ALL_POSITION_TYPES contiene los 5 positionTypes conocidos', () => {
    for (const pt of KNOWN_POSITION_TYPES) {
      expect(ALL_POSITION_TYPES).toContain(pt)
    }
    expect(ALL_POSITION_TYPES.length).toBe(5)
  })

  test('SLUG_TO_POSITION_TYPE mapea correctamente cada slug', () => {
    expect(SLUG_TO_POSITION_TYPE['auxiliar-administrativo-estado']).toBe('auxiliar_administrativo')
    expect(SLUG_TO_POSITION_TYPE['administrativo-estado']).toBe('administrativo')
    expect(SLUG_TO_POSITION_TYPE['tramitacion-procesal']).toBe('tramitacion_procesal')
    expect(SLUG_TO_POSITION_TYPE['auxilio-judicial']).toBe('auxilio_judicial')
    expect(SLUG_TO_POSITION_TYPE['auxiliar-administrativo-carm']).toBe('auxiliar_administrativo_carm')
  })

  test('OPOSICION_SLUGS_ENUM funciona con z.enum()', () => {
    const schema = z.enum(OPOSICION_SLUGS_ENUM)
    // Debe parsear slugs válidos
    for (const slug of KNOWN_SLUGS) {
      expect(schema.parse(slug)).toBe(slug)
    }
    // Debe rechazar slugs inválidos
    expect(() => schema.parse('inexistente')).toThrow()
  })

  test('POSITION_TYPES_ENUM funciona con z.enum()', () => {
    const schema = z.enum(POSITION_TYPES_ENUM)
    for (const pt of KNOWN_POSITION_TYPES) {
      expect(schema.parse(pt)).toBe(pt)
    }
    expect(() => schema.parse('inexistente')).toThrow()
  })

  test('Cada oposición tiene blocks con themes', () => {
    for (const oposicion of OPOSICIONES) {
      expect(oposicion.blocks.length).toBeGreaterThan(0)
      for (const block of oposicion.blocks) {
        expect(block.themes.length).toBeGreaterThan(0)
      }
    }
  })

  test('getOposicionBySlug() devuelve datos correctos', () => {
    const aux = getOposicionBySlug('auxiliar-administrativo-estado')
    expect(aux).toBeDefined()
    expect(aux!.positionType).toBe('auxiliar_administrativo')
    expect(aux!.name).toBe('Auxiliar Administrativo del Estado')

    const tp = getOposicionBySlug('tramitacion-procesal')
    expect(tp).toBeDefined()
    expect(tp!.positionType).toBe('tramitacion_procesal')

    expect(getOposicionBySlug('no-existe')).toBeUndefined()
  })
})
