/**
 * Tests para validación de API /api/answer/psychometric
 * Verifica que la API acepta userAnswer como número o null
 */
import { z } from 'zod/v3'

// Recrear el schema de validación (mismo que en route.ts)
const validatePsychometricRequestSchema = z.object({
  questionId: z.string().uuid('ID de pregunta inválido'),
  userAnswer: z.number().int().min(0).max(3).nullable() // 0=A, 1=B, 2=C, 3=D, null=sin respuesta
})

describe('Psychometric Answer API Validation', () => {
  describe('userAnswer field', () => {
    const validQuestionId = '550e8400-e29b-41d4-a716-446655440000'

    it('debe aceptar userAnswer como número 0 (opción A)', () => {
      const result = validatePsychometricRequestSchema.safeParse({
        questionId: validQuestionId,
        userAnswer: 0
      })
      expect(result.success).toBe(true)
    })

    it('debe aceptar userAnswer como número 3 (opción D)', () => {
      const result = validatePsychometricRequestSchema.safeParse({
        questionId: validQuestionId,
        userAnswer: 3
      })
      expect(result.success).toBe(true)
    })

    it('debe aceptar userAnswer como null (pregunta sin responder)', () => {
      const result = validatePsychometricRequestSchema.safeParse({
        questionId: validQuestionId,
        userAnswer: null
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.userAnswer).toBeNull()
      }
    })

    it('debe rechazar userAnswer como string', () => {
      const result = validatePsychometricRequestSchema.safeParse({
        questionId: validQuestionId,
        userAnswer: 'a'
      })
      expect(result.success).toBe(false)
    })

    it('debe rechazar userAnswer mayor que 3', () => {
      const result = validatePsychometricRequestSchema.safeParse({
        questionId: validQuestionId,
        userAnswer: 4
      })
      expect(result.success).toBe(false)
    })

    it('debe rechazar userAnswer negativo', () => {
      const result = validatePsychometricRequestSchema.safeParse({
        questionId: validQuestionId,
        userAnswer: -1
      })
      expect(result.success).toBe(false)
    })

    it('debe rechazar userAnswer decimal', () => {
      const result = validatePsychometricRequestSchema.safeParse({
        questionId: validQuestionId,
        userAnswer: 1.5
      })
      expect(result.success).toBe(false)
    })
  })

  describe('questionId field', () => {
    it('debe aceptar UUID válido', () => {
      const result = validatePsychometricRequestSchema.safeParse({
        questionId: '550e8400-e29b-41d4-a716-446655440000',
        userAnswer: 1
      })
      expect(result.success).toBe(true)
    })

    it('debe rechazar string no UUID', () => {
      const result = validatePsychometricRequestSchema.safeParse({
        questionId: 'not-a-uuid',
        userAnswer: 1
      })
      expect(result.success).toBe(false)
    })

    it('debe rechazar questionId vacío', () => {
      const result = validatePsychometricRequestSchema.safeParse({
        questionId: '',
        userAnswer: 1
      })
      expect(result.success).toBe(false)
    })
  })
})
