// __tests__/api/psychometric-test-data/questions.test.ts
// Test de integración: verifica que la API de preguntas psicotécnicas
// devuelve todos los campos necesarios para el frontend.

import { psychometricQuestionSchema } from '@/lib/api/psychometric-test-data/schemas'

// Campos que el frontend necesita para funcionar correctamente
// Si alguno falta en el schema, el test falla y alerta del problema.
const REQUIRED_FRONTEND_FIELDS = [
  'id',
  'questionText',
  'optionA',
  'optionB',
  'optionC',
  'optionD',
  'correctOption',
  'explanation',
  'contentData',
  'questionSubtype',
  'imageUrl',
] as const

describe('Psychometric Questions API - Schema', () => {
  it('el schema debe incluir todos los campos que el frontend necesita', () => {
    const schemaKeys = Object.keys(psychometricQuestionSchema.shape)

    for (const field of REQUIRED_FRONTEND_FIELDS) {
      expect(schemaKeys).toContain(field)
    }
  })

  it('explanation debe aceptar string', () => {
    const valid = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      categoryId: '660e8400-e29b-41d4-a716-446655440001',
      sectionId: null,
      questionSubtype: 'sequence_numeric',
      questionText: '1, 2, 3, ?',
      optionA: '4',
      optionB: '5',
      optionC: '6',
      optionD: '7',
      correctOption: 0,
      explanation: 'La serie suma 1 cada vez.',
      contentData: {},
      difficulty: 'medium',
      timeLimitSeconds: 120,
      cognitiveSkills: null,
      isOfficialExam: false,
      examSource: null,
      imageUrl: null,
    }

    const result = psychometricQuestionSchema.safeParse(valid)
    expect(result.success).toBe(true)
  })

  it('explanation debe aceptar null', () => {
    const valid = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      categoryId: '660e8400-e29b-41d4-a716-446655440001',
      sectionId: null,
      questionSubtype: 'sequence_numeric',
      questionText: '1, 2, 3, ?',
      optionA: '4',
      optionB: '5',
      optionC: '6',
      optionD: '7',
      correctOption: 0,
      explanation: null,
      contentData: {},
      difficulty: 'medium',
      timeLimitSeconds: 120,
      cognitiveSkills: null,
      isOfficialExam: false,
      examSource: null,
      imageUrl: null,
    }

    const result = psychometricQuestionSchema.safeParse(valid)
    expect(result.success).toBe(true)
  })

  it('explanation debe aceptar undefined (campo omitido)', () => {
    const valid = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      categoryId: '660e8400-e29b-41d4-a716-446655440001',
      sectionId: null,
      questionSubtype: 'sequence_numeric',
      questionText: '1, 2, 3, ?',
      optionA: '4',
      optionB: '5',
      optionC: '6',
      optionD: '7',
      correctOption: 0,
      contentData: {},
      difficulty: 'medium',
      timeLimitSeconds: 120,
      cognitiveSkills: null,
      isOfficialExam: false,
      examSource: null,
      imageUrl: null,
    }

    const result = psychometricQuestionSchema.safeParse(valid)
    expect(result.success).toBe(true)
  })
})
