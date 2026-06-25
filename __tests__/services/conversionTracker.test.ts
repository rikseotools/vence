// __tests__/services/conversionTracker.test.ts
// Tests unitarios del servicio de tracking de conversiones.
//
// AGNÓSTICO (Fase C1, commit 0bfd09d6): el servicio ya NO recibe el cliente
// supabase ni hace supabase.rpc. Hace POST a /api/v2/conversion-event (Drizzle +
// verifyAuth; user_id del token). Este test se reescribió (25/06) para mockear
// `fetch` + `getAuthHeaders` en vez del viejo `supabase.rpc` — estaba stale tras
// la migración y rompía CI (unit) con "Number of calls: 0".

import {
  trackConversionEvent,
  trackLimitReached,
  trackUpgradeModalView,
  trackUpgradeButtonClick,
  CONVERSION_EVENTS,
} from '../../lib/services/conversionTracker'

jest.mock('@/lib/api/authHeaders', () => ({
  getAuthHeaders: jest.fn().mockResolvedValue({ Authorization: 'Bearer test-token' }),
}))

const ENDPOINT = '/api/v2/conversion-event'

function mockFetchOk(id: string | null = 'event-uuid-123') {
  ;(global.fetch as jest.Mock).mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ id }),
  })
}

function bodyOfCall(idx = 0): { eventType: string; eventData: Record<string, unknown> } {
  const opts = (global.fetch as jest.Mock).mock.calls[idx][1]
  return JSON.parse(opts.body)
}

describe('conversionTracker Service', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    console.warn = jest.fn()
    console.error = jest.fn()
    console.log = jest.fn()
    global.fetch = jest.fn() as unknown as typeof fetch
  })

  describe('trackConversionEvent', () => {
    test('llama a POST /api/v2/conversion-event con eventType y eventData', async () => {
      mockFetchOk('event-uuid-123')

      const result = await trackConversionEvent('user-123', 'limit_reached', { questions_today: 25 })

      expect(global.fetch).toHaveBeenCalledWith(
        ENDPOINT,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ eventType: 'limit_reached', eventData: { questions_today: 25 } }),
        }),
      )
      expect(result).toBe('event-uuid-123')
    })

    test('retorna null y no llama al endpoint si falta eventType', async () => {
      const result = await trackConversionEvent('user-123', '')
      expect(result).toBeNull()
      expect(console.warn).toHaveBeenCalled()
      expect(global.fetch).not.toHaveBeenCalled()
    })

    test('retorna null si la respuesta no es ok (sin romper la app)', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValue({ ok: false, status: 500, json: async () => ({}) })

      const result = await trackConversionEvent('user-123', 'limit_reached', {})

      expect(result).toBeNull()
      expect(console.error).toHaveBeenCalled()
    })

    test('maneja excepciones (red) sin romper la app', async () => {
      ;(global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'))

      const result = await trackConversionEvent('user-123', 'limit_reached', {})

      expect(result).toBeNull()
      expect(console.error).toHaveBeenCalled()
    })
  })

  describe('trackLimitReached', () => {
    test('envía limit_reached con questions_today y timestamp', async () => {
      mockFetchOk('event-uuid-456')

      const result = await trackLimitReached('user-123', 25)

      const body = bodyOfCall()
      expect((global.fetch as jest.Mock).mock.calls[0][0]).toBe(ENDPOINT)
      expect(body.eventType).toBe('limit_reached')
      expect(body.eventData).toMatchObject({ questions_today: 25 })
      expect(body.eventData.timestamp).toBeDefined()
      expect(new Date(body.eventData.timestamp as string)).toBeInstanceOf(Date)
      expect(result).toBe('event-uuid-456')
    })
  })

  describe('trackUpgradeModalView', () => {
    test('envía upgrade_modal_viewed con source', async () => {
      mockFetchOk()

      await trackUpgradeModalView('user-123', 'limit')

      const body = bodyOfCall()
      expect(body.eventType).toBe('upgrade_modal_viewed')
      expect(body.eventData).toMatchObject({ source: 'limit' })
    })

    test('usa source por defecto (limit) si no se proporciona', async () => {
      mockFetchOk()

      await trackUpgradeModalView('user-123')

      expect(bodyOfCall().eventData.source).toBe('limit')
    })
  })

  describe('trackUpgradeButtonClick', () => {
    test('envía upgrade_button_clicked con source', async () => {
      mockFetchOk()

      await trackUpgradeButtonClick('user-123', 'banner')

      const body = bodyOfCall()
      expect(body.eventType).toBe('upgrade_button_clicked')
      expect(body.eventData).toMatchObject({ source: 'banner' })
    })
  })

  describe('CONVERSION_EVENTS constantes', () => {
    test('tiene todos los eventos definidos', () => {
      expect(CONVERSION_EVENTS.LIMIT_REACHED).toBe('limit_reached')
      expect(CONVERSION_EVENTS.UPGRADE_MODAL_VIEWED).toBe('upgrade_modal_viewed')
      expect(CONVERSION_EVENTS.UPGRADE_BUTTON_CLICKED).toBe('upgrade_button_clicked')
      expect(CONVERSION_EVENTS.PAYMENT_COMPLETED).toBe('payment_completed')
      expect(CONVERSION_EVENTS.REGISTRATION).toBe('registration')
    })
  })
})
