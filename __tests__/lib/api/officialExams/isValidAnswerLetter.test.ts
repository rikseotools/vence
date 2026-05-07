/**
 * Tests del helper isValidAnswerLetter.
 *
 * Contexto: bug reportado por Iván Bueno (06-may-2026) — 17/19 psicotécnicas
 * marcadas mal. La causa fue que `correct_answer` en BD a veces queda como
 * '', '?' o 'x' (placeholders de cuando init no resolvió la correcta), y
 * saveOfficialExamAnswer comparaba `userAnswer` contra ese placeholder. Con
 * el guard `record.correctAnswer ? ... : false`, valores como '?' (truthy)
 * pasaban el guard y producían `userAnswer === '?'` → siempre false.
 *
 * isValidAnswerLetter rechaza esos placeholders y solo acepta 'a'-'e'.
 */

import { isValidAnswerLetter } from '@/lib/api/official-exams/queries'

describe('isValidAnswerLetter', () => {
  test('acepta letras válidas a-d minúsculas', () => {
    expect(isValidAnswerLetter('a')).toBe(true)
    expect(isValidAnswerLetter('b')).toBe(true)
    expect(isValidAnswerLetter('c')).toBe(true)
    expect(isValidAnswerLetter('d')).toBe(true)
  })

  test('acepta letra e (preguntas con 5 opciones)', () => {
    expect(isValidAnswerLetter('e')).toBe(true)
  })

  test('acepta letras mayúsculas', () => {
    expect(isValidAnswerLetter('A')).toBe(true)
    expect(isValidAnswerLetter('E')).toBe(true)
  })

  test('rechaza placeholders comunes que han causado falsos negativos', () => {
    expect(isValidAnswerLetter('?')).toBe(false) // answerToLetter(null)
    expect(isValidAnswerLetter('x')).toBe(false) // initOfficialExam fallback
    expect(isValidAnswerLetter('')).toBe(false)  // complete client-side missing
    expect(isValidAnswerLetter('unknown')).toBe(false) // saveOfficialExamResults legacy
  })

  test('rechaza null y undefined', () => {
    expect(isValidAnswerLetter(null)).toBe(false)
    expect(isValidAnswerLetter(undefined)).toBe(false)
  })

  test('rechaza strings con más de un carácter', () => {
    expect(isValidAnswerLetter('ab')).toBe(false)
    expect(isValidAnswerLetter('aa')).toBe(false)
    expect(isValidAnswerLetter(' a')).toBe(false)
  })

  test('rechaza letras fuera del rango a-e', () => {
    expect(isValidAnswerLetter('f')).toBe(false)
    expect(isValidAnswerLetter('z')).toBe(false)
    expect(isValidAnswerLetter('A1')).toBe(false)
  })

  test('TypeScript: actúa como type guard', () => {
    const v: string | null = 'a'
    if (isValidAnswerLetter(v)) {
      // TS debe inferir v como string aquí (no string | null)
      const s: string = v
      expect(s).toBe('a')
    }
  })
})
