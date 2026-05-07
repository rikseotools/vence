/**
 * Tests del schema AvailabilityResponseSchema tras añadir availableNeverSeen.
 *
 * Contexto: feedbacks de mbelen177 y pilarmartagui (06-may-2026) reportaron
 * que el botón promete N preguntas pero el test arranca con menos. Causa: el
 * pre-flight `/api/random-test/availability` ignora user_question_history,
 * mientras que la generación real (vía /api/questions/filtered con
 * prioritizeNeverSeen=true) sí descuenta las vistas. Solución: el endpoint
 * pasa a devolver dos números — `availableQuestions` (pool total) y
 * `availableNeverSeen` (descontando history) — para que el cliente muestre
 * conteo realista y ofrezca toggle "incluir vistas".
 */

import { AvailabilityResponseSchema } from '@/lib/api/random-test/schemas'

describe('AvailabilityResponseSchema — availableNeverSeen field', () => {
  test('parsea response con availableNeverSeen', () => {
    const res = AvailabilityResponseSchema.safeParse({
      success: true,
      availableQuestions: 100,
      availableNeverSeen: 82,
      byTheme: { '1': 50, '2': 50 },
    })
    expect(res.success).toBe(true)
    if (res.success) {
      expect(res.data.availableNeverSeen).toBe(82)
      expect(res.data.availableQuestions).toBe(100)
    }
  })

  test('compat: response sin availableNeverSeen sigue siendo válido', () => {
    const res = AvailabilityResponseSchema.safeParse({
      success: true,
      availableQuestions: 100,
      byTheme: { '1': 50, '2': 50 },
    })
    expect(res.success).toBe(true)
    if (res.success) {
      // Sin neverSeen: undefined (UI cae a comportamiento anterior)
      expect(res.data.availableNeverSeen).toBeUndefined()
    }
  })

  test('rechaza availableNeverSeen no-numérico', () => {
    const res = AvailabilityResponseSchema.safeParse({
      success: true,
      availableQuestions: 100,
      availableNeverSeen: 'eighty-two',
    })
    expect(res.success).toBe(false)
  })

  test('availableNeverSeen <= availableQuestions es invariante semántica (no enforced en schema, sí documentada)', () => {
    // El schema no fuerza la relación porque depende de la implementación.
    // Test sirve de documentación: si neverSeen > total, hay bug en la query.
    const res = AvailabilityResponseSchema.safeParse({
      success: true,
      availableQuestions: 50,
      availableNeverSeen: 100,
    })
    // Schema lo acepta, pero sería un bug en `checkQuestionAvailability`
    expect(res.success).toBe(true)
  })
})
