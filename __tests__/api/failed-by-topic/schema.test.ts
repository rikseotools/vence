// __tests__/api/failed-by-topic/schema.test.ts
// Regresión del bug "Tatiana Madrid" (abr 2026): /api/questions/failed-by-topic
// aceptaba `positionType` vacío/undefined y devolvía títulos de temas mezclados
// de otras oposiciones. Ahora el schema Zod lo hace OBLIGATORIO.

import { getFailedByTopicRequestSchema } from '@/lib/api/user-failed-questions/schemas'

describe('getFailedByTopicRequestSchema', () => {
  test('acepta un positionType válido (snake_case)', () => {
    const r = getFailedByTopicRequestSchema.safeParse({
      positionType: 'auxiliar_administrativo_madrid',
    })
    expect(r.success).toBe(true)
  })

  test('acepta todas las oposiciones reales conocidas', () => {
    const valid = [
      'auxiliar_administrativo_estado',
      'administrativo_estado',
      'auxiliar_administrativo_madrid',
      'auxiliar_administrativo_galicia',
      'administrativo_galicia',
      'auxilio_judicial',
      'tramitacion_procesal',
      'policia_nacional',
      'guardia_civil',
    ]
    for (const pt of valid) {
      const r = getFailedByTopicRequestSchema.safeParse({ positionType: pt })
      expect(r.success).toBe(true)
    }
  })

  test('rechaza positionType vacío (regresión bug principal)', () => {
    const r = getFailedByTopicRequestSchema.safeParse({ positionType: '' })
    expect(r.success).toBe(false)
  })

  test('rechaza positionType ausente', () => {
    const r = getFailedByTopicRequestSchema.safeParse({})
    expect(r.success).toBe(false)
  })

  test('rechaza positionType undefined explícito', () => {
    const r = getFailedByTopicRequestSchema.safeParse({ positionType: undefined })
    expect(r.success).toBe(false)
  })

  test('rechaza positionType null', () => {
    const r = getFailedByTopicRequestSchema.safeParse({ positionType: null })
    expect(r.success).toBe(false)
  })

  test('rechaza positionType con caracteres inválidos (mayúsculas)', () => {
    const r = getFailedByTopicRequestSchema.safeParse({ positionType: 'Auxiliar_Estado' })
    expect(r.success).toBe(false)
  })

  test('rechaza positionType con espacios', () => {
    const r = getFailedByTopicRequestSchema.safeParse({ positionType: 'aux estado' })
    expect(r.success).toBe(false)
  })

  test('rechaza positionType con guiones (debe ser snake_case)', () => {
    const r = getFailedByTopicRequestSchema.safeParse({ positionType: 'auxiliar-administrativo-madrid' })
    expect(r.success).toBe(false)
  })

  test('rechaza SQL injection trivial', () => {
    const r = getFailedByTopicRequestSchema.safeParse({
      positionType: "' OR 1=1 --",
    })
    expect(r.success).toBe(false)
  })
})
