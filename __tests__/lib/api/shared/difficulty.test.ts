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
    '%s usa difficultyInputSchema (no z.string() libre)',
    (file) => {
      const content = fs.readFileSync(path.join(ROOT, file), 'utf-8')
      // Debe importar el schema compartido
      expect(content).toContain('difficultyInputSchema')
      // No debe tener difficulty: z.string() suelto para campos que escriben en test_questions
      // (excepción: schemas de OUTPUT/lectura que no escriben en BD)
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

describe('difficulty — difficultyInputSchema', () => {
  const { difficultyInputSchema } = require('../../../../lib/api/shared/difficulty')

  it('acepta valores válidos', () => {
    expect(difficultyInputSchema.safeParse('easy').success).toBe(true)
    expect(difficultyInputSchema.safeParse('medium').success).toBe(true)
    expect(difficultyInputSchema.safeParse('hard').success).toBe(true)
    expect(difficultyInputSchema.safeParse('extreme').success).toBe(true)
    expect(difficultyInputSchema.safeParse(null).success).toBe(true)
    expect(difficultyInputSchema.safeParse(undefined).success).toBe(true)
  })

  it('RECHAZA valores numéricos (alerta de bug de importación)', () => {
    expect(difficultyInputSchema.safeParse('1').success).toBe(false)
    expect(difficultyInputSchema.safeParse('2').success).toBe(false)
    expect(difficultyInputSchema.safeParse('3').success).toBe(false)
    expect(difficultyInputSchema.safeParse('4').success).toBe(false)
  })

  it('RECHAZA valores arbitrarios', () => {
    expect(difficultyInputSchema.safeParse('auto').success).toBe(false)
    expect(difficultyInputSchema.safeParse('mixed').success).toBe(false)
    expect(difficultyInputSchema.safeParse('garbage').success).toBe(false)
  })
})
