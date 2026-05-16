// __tests__/lib/api/shared/psychometricExamProjection.test.ts
//
// Test de contrato: valida que los mappers producen objetos que pasan
// el schema Zod correspondiente, incluyendo TODOS los campos requeridos
// (en particular `imageUrl` — bug Mayte 16/05/2026 fue exactamente que
// ese campo se perdía en algún mapper duplicado).
//
// Si alguien añade un campo al schema (oficial / resumed) y olvida
// añadirlo al mapper, este test rompe inmediatamente.

import {
  toOfficialExamPsychometric,
  toResumedPsychometric,
  type PsychometricExamRow,
} from '@/lib/api/shared/psychometricExamProjection'
import {
  officialExamQuestionSchema,
  resumedOfficialExamQuestionSchema,
} from '@/lib/api/official-exams/schemas'

function makeRow(overrides: Partial<PsychometricExamRow> = {}): PsychometricExamRow {
  return {
    id: '00000000-0000-4000-8000-000000000001',
    questionText: '¿Cuántas figuras hay en total?',
    optionA: 'A',
    optionB: 'B',
    optionC: 'C',
    optionD: 'D',
    optionE: null,
    explanation: 'Explicación',
    difficulty: 'medium',
    examSource: 'Examen Aux Admin Estado 2024',
    questionSubtype: 'data_tables',
    contentData: {},
    timeLimitSeconds: 60,
    imageUrl: 'https://example.com/img.png',
    ...overrides,
  }
}

describe('toOfficialExamPsychometric', () => {
  it('produce un objeto válido según officialExamQuestionSchema', () => {
    const row = makeRow()
    const result = toOfficialExamPsychometric(row)
    const parsed = officialExamQuestionSchema.safeParse(result)
    if (!parsed.success) {
      throw new Error('Validación falló: ' + JSON.stringify(parsed.error.flatten(), null, 2))
    }
    expect(parsed.success).toBe(true)
  })

  it('preserva imageUrl del row', () => {
    const row = makeRow({ imageUrl: 'https://cdn.test/figure.png' })
    expect(toOfficialExamPsychometric(row).imageUrl).toBe('https://cdn.test/figure.png')
  })

  it('imageUrl null cuando el row no tiene', () => {
    const row = makeRow({ imageUrl: null })
    expect(toOfficialExamPsychometric(row).imageUrl).toBeNull()
  })

  it('isReserva true cuando examSource contiene "Reserva"', () => {
    const row = makeRow({ examSource: 'Examen Aux Admin Estado 2024 - Reserva' })
    expect(toOfficialExamPsychometric(row).isReserva).toBe(true)
  })

  it('isReserva false cuando examSource es null', () => {
    const row = makeRow({ examSource: null })
    expect(toOfficialExamPsychometric(row).isReserva).toBe(false)
  })

  it('campos solo-legislativos a null', () => {
    const out = toOfficialExamPsychometric(makeRow())
    expect(out.articleNumber).toBeNull()
    expect(out.lawName).toBeNull()
    expect(out.examCaseId).toBeNull()
  })

  it('options null se convierten a string vacío', () => {
    const row = makeRow({ optionA: null, optionB: null, optionC: null, optionD: null })
    const out = toOfficialExamPsychometric(row)
    expect(out.optionA).toBe('')
    expect(out.optionB).toBe('')
    expect(out.optionC).toBe('')
    expect(out.optionD).toBe('')
  })

  it('questionType siempre "psychometric"', () => {
    expect(toOfficialExamPsychometric(makeRow()).questionType).toBe('psychometric')
  })
})

describe('toResumedPsychometric', () => {
  it('produce un objeto válido según resumedOfficialExamQuestionSchema', () => {
    const row = makeRow()
    const result = toResumedPsychometric(row, { questionOrder: 32, savedAnswer: 'b' })
    const parsed = resumedOfficialExamQuestionSchema.safeParse(result)
    if (!parsed.success) {
      throw new Error('Validación falló: ' + JSON.stringify(parsed.error.flatten(), null, 2))
    }
    expect(parsed.success).toBe(true)
  })

  it('preserva imageUrl en la respuesta de resume', () => {
    const row = makeRow({ imageUrl: 'https://cdn.test/resumed.png' })
    const out = toResumedPsychometric(row, { questionOrder: 1, savedAnswer: null })
    expect(out.imageUrl).toBe('https://cdn.test/resumed.png')
  })

  it('savedAnswer null cuando no respondida', () => {
    const out = toResumedPsychometric(makeRow(), { questionOrder: 5, savedAnswer: null })
    expect(out.savedAnswer).toBeNull()
  })

  it('savedAnswer preservado cuando respondida', () => {
    const out = toResumedPsychometric(makeRow(), { questionOrder: 5, savedAnswer: 'c' })
    expect(out.savedAnswer).toBe('c')
  })

  it('questionOrder se traslada del extras', () => {
    const out = toResumedPsychometric(makeRow(), { questionOrder: 42, savedAnswer: null })
    expect(out.questionOrder).toBe(42)
  })
})

// =====================================================
// REGRESIÓN DEL BUG MAYTE
// =====================================================
// El bug original: una psicotécnica data_tables con image_url pero sin
// content_data estructurado se renderizaba vacía porque algún mapper
// duplicado olvidaba propagar imageUrl. Este test garantiza que el
// caso exacto del incidente queda cubierto.

describe('Regresión bug Mayte (16/05/2026): data_tables con solo image_url', () => {
  const dataTablesRow = makeRow({
    questionSubtype: 'data_tables',
    contentData: {}, // vacío — no es la tabla, solo image_url
    imageUrl: 'https://supabase.storage/q_666982_65d71b3bad370940949818.png',
  })

  it('toOfficialExamPsychometric: imageUrl llega al output', () => {
    expect(toOfficialExamPsychometric(dataTablesRow).imageUrl).toBe(
      'https://supabase.storage/q_666982_65d71b3bad370940949818.png',
    )
  })

  it('toResumedPsychometric: imageUrl llega al output del resume', () => {
    const out = toResumedPsychometric(dataTablesRow, { questionOrder: 1, savedAnswer: null })
    expect(out.imageUrl).toBe('https://supabase.storage/q_666982_65d71b3bad370940949818.png')
  })
})
