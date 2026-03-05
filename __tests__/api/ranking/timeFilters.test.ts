/**
 * Tests para computeDateRange - calculo de rangos de fechas UTC
 */
import { computeDateRange } from '../../../lib/api/ranking/queries'

// Usar fake timers para controlar Date
beforeEach(() => {
  jest.useFakeTimers()
})

afterEach(() => {
  jest.useRealTimers()
})

describe('computeDateRange', () => {
  describe('today', () => {
    test('today -> hoy 00:00 UTC hasta 23:59:59.999 UTC', () => {
      // Miercoles 5 marzo 2026, 14:30 UTC
      jest.setSystemTime(new Date('2026-03-05T14:30:00.000Z'))

      const range = computeDateRange('today')
      expect(range.startDate).toBe('2026-03-05T00:00:00.000Z')
      expect(range.endDate).toBe('2026-03-05T23:59:59.999Z')
    })
  })

  describe('yesterday', () => {
    test('yesterday -> ayer 00:00 UTC hasta ayer 23:59:59.999 UTC', () => {
      jest.setSystemTime(new Date('2026-03-05T14:30:00.000Z'))

      const range = computeDateRange('yesterday')
      expect(range.startDate).toBe('2026-03-04T00:00:00.000Z')
      expect(range.endDate).toBe('2026-03-04T23:59:59.999Z')
    })

    test('yesterday con cambio de mes: 1 marzo -> 28 febrero (no bisiesto)', () => {
      jest.setSystemTime(new Date('2027-03-01T10:00:00.000Z'))

      const range = computeDateRange('yesterday')
      expect(range.startDate).toBe('2027-02-28T00:00:00.000Z')
      expect(range.endDate).toBe('2027-02-28T23:59:59.999Z')
    })

    test('yesterday con anio bisiesto: 1 marzo 2028 -> 29 febrero', () => {
      jest.setSystemTime(new Date('2028-03-01T10:00:00.000Z'))

      const range = computeDateRange('yesterday')
      expect(range.startDate).toBe('2028-02-29T00:00:00.000Z')
      expect(range.endDate).toBe('2028-02-29T23:59:59.999Z')
    })
  })

  describe('week', () => {
    test('week en miercoles -> lunes 00:00 UTC, endDate null', () => {
      // Miercoles 5 marzo 2026
      jest.setSystemTime(new Date('2026-03-05T14:30:00.000Z'))

      const range = computeDateRange('week')
      expect(range.startDate).toBe('2026-03-02T00:00:00.000Z') // Lunes
      expect(range.endDate).toBeNull()
    })

    test('week en domingo -> retrocede al lunes anterior', () => {
      // Domingo 8 marzo 2026
      jest.setSystemTime(new Date('2026-03-08T14:30:00.000Z'))

      const range = computeDateRange('week')
      expect(range.startDate).toBe('2026-03-02T00:00:00.000Z') // Lunes anterior
      expect(range.endDate).toBeNull()
    })

    test('week en lunes -> empieza hoy', () => {
      // Lunes 2 marzo 2026
      jest.setSystemTime(new Date('2026-03-02T14:30:00.000Z'))

      const range = computeDateRange('week')
      expect(range.startDate).toBe('2026-03-02T00:00:00.000Z')
      expect(range.endDate).toBeNull()
    })

    test('week en sabado -> retrocede al lunes', () => {
      // Sabado 7 marzo 2026
      jest.setSystemTime(new Date('2026-03-07T14:30:00.000Z'))

      const range = computeDateRange('week')
      expect(range.startDate).toBe('2026-03-02T00:00:00.000Z')
      expect(range.endDate).toBeNull()
    })
  })

  describe('month', () => {
    test('month -> dia 1 00:00 UTC, endDate null', () => {
      jest.setSystemTime(new Date('2026-03-15T14:30:00.000Z'))

      const range = computeDateRange('month')
      expect(range.startDate).toBe('2026-03-01T00:00:00.000Z')
      expect(range.endDate).toBeNull()
    })

    test('month el dia 1 -> empieza hoy', () => {
      jest.setSystemTime(new Date('2026-03-01T10:00:00.000Z'))

      const range = computeDateRange('month')
      expect(range.startDate).toBe('2026-03-01T00:00:00.000Z')
      expect(range.endDate).toBeNull()
    })
  })

  describe('UTC', () => {
    test('siempre devuelve fechas ISO (UTC)', () => {
      jest.setSystemTime(new Date('2026-03-05T23:59:59.000Z'))

      const range = computeDateRange('today')
      // Debe ser UTC independientemente de timezone local
      expect(range.startDate).toContain('T00:00:00.000Z')
      expect(range.endDate).toContain('T23:59:59.999Z')
    })

    test('week: startDate siempre tiene hora 00:00:00.000Z', () => {
      jest.setSystemTime(new Date('2026-03-05T23:59:59.000Z'))

      const range = computeDateRange('week')
      expect(range.startDate).toContain('T00:00:00.000Z')
    })
  })
})
