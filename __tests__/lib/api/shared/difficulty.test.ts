// __tests__/lib/api/shared/difficulty.test.ts
// Verificar que difficulty se valida correctamente en los schemas de INPUT
import fs from 'fs'
import path from 'path'

const ROOT = path.resolve(__dirname, '../../../../')

describe('difficulty — validación en schemas de INPUT', () => {
  const inputSchemaFiles = [
    'lib/api/exam/schemas.ts',
    'lib/api/test-answers/schemas.ts',
    'lib/api/v2/answer-and-save/schemas.ts',
  ]

  it.each(inputSchemaFiles)(
    '%s usa VALID_DIFFICULTIES para validar difficulty (no z.string() libre)',
    (file) => {
      const content = fs.readFileSync(path.join(ROOT, file), 'utf-8')
      // Debe importar las constantes compartidas
      expect(content).toContain('VALID_DIFFICULTIES')
      // Debe usar z.enum(VALID_DIFFICULTIES) para validar
      expect(content).toMatch(/z\.enum\(VALID_DIFFICULTIES\)/)
    }
  )

  it('todas las queries que insertan en test_questions usan normalizeDifficulty', () => {
    const queryFiles = [
      'lib/api/exam/queries.ts',
      'lib/api/test-answers/queries.ts',
    ]
    for (const file of queryFiles) {
      const content = fs.readFileSync(path.join(ROOT, file), 'utf-8')
      expect(content).toContain('normalizeDifficulty')
      // No debe tener mapDifficulty local
      expect(content).not.toMatch(/function mapDifficulty/)
    }
  })
})

describe('difficulty — normalizeDifficulty', () => {
  // Importar directamente para testear la función
  const { normalizeDifficulty } = require('../../../../lib/api/shared/difficulty')

  it('acepta valores válidos sin cambiarlos', () => {
    expect(normalizeDifficulty('easy')).toBe('easy')
    expect(normalizeDifficulty('medium')).toBe('medium')
    expect(normalizeDifficulty('hard')).toBe('hard')
    expect(normalizeDifficulty('extreme')).toBe('extreme')
  })

  it('mapea valores numéricos legacy', () => {
    expect(normalizeDifficulty('1')).toBe('easy')
    expect(normalizeDifficulty('2')).toBe('medium')
    expect(normalizeDifficulty('3')).toBe('hard')
    expect(normalizeDifficulty('4')).toBe('extreme')
    expect(normalizeDifficulty('5')).toBe('extreme')
  })

  it('null y undefined devuelven medium', () => {
    expect(normalizeDifficulty(null)).toBe('medium')
    expect(normalizeDifficulty(undefined)).toBe('medium')
  })

  it('valores desconocidos devuelven medium', () => {
    expect(normalizeDifficulty('auto')).toBe('medium')
    expect(normalizeDifficulty('garbage')).toBe('medium')
    expect(normalizeDifficulty('3.5')).toBe('medium')
  })
})

describe('difficulty — VALID_DIFFICULTIES como fuente de verdad', () => {
  const { VALID_DIFFICULTIES } = require('../../../../lib/api/shared/difficulty')
  const { z } = require('zod/v3')

  // Recrea el schema como lo hacen los módulos consumidores
  const difficultySchema = z.enum(VALID_DIFFICULTIES).nullable().optional()

  it('acepta valores válidos', () => {
    expect(difficultySchema.safeParse('easy').success).toBe(true)
    expect(difficultySchema.safeParse('medium').success).toBe(true)
    expect(difficultySchema.safeParse('hard').success).toBe(true)
    expect(difficultySchema.safeParse('extreme').success).toBe(true)
    expect(difficultySchema.safeParse(null).success).toBe(true)
    expect(difficultySchema.safeParse(undefined).success).toBe(true)
  })

  it('RECHAZA valores numéricos (alerta de bug de importación)', () => {
    expect(difficultySchema.safeParse('1').success).toBe(false)
    expect(difficultySchema.safeParse('2').success).toBe(false)
    expect(difficultySchema.safeParse('3').success).toBe(false)
    expect(difficultySchema.safeParse('4').success).toBe(false)
  })

  it('RECHAZA valores arbitrarios', () => {
    expect(difficultySchema.safeParse('auto').success).toBe(false)
    expect(difficultySchema.safeParse('mixed').success).toBe(false)
    expect(difficultySchema.safeParse('garbage').success).toBe(false)
  })
})
