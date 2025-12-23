// __tests__/services/conversionTracker.test.js
// Tests unitarios para el servicio de tracking de conversiones

import {
  trackConversionEvent,
  trackLimitReached,
  trackUpgradeModalView,
  trackUpgradeButtonClick,
  CONVERSION_EVENTS
} from '../../lib/services/conversionTracker'

describe('conversionTracker Service', () => {
  let mockSupabase

  beforeEach(() => {
    jest.clearAllMocks()
    console.warn = jest.fn()
    console.error = jest.fn()
    console.log = jest.fn()

    mockSupabase = {
      rpc: jest.fn()
    }
  })

  describe('trackConversionEvent', () => {
    test('debe llamar RPC con parámetros correctos', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: 'event-uuid-123',
        error: null
      })

      const result = await trackConversionEvent(
        mockSupabase,
        'user-123',
        'limit_reached',
        { questions_today: 25 }
      )

      expect(mockSupabase.rpc).toHaveBeenCalledWith('track_conversion_event', {
        p_user_id: 'user-123',
        p_event_type: 'limit_reached',
        p_event_data: { questions_today: 25 }
      })

      expect(result).toBe('event-uuid-123')
    })

    test('debe retornar null si faltan parámetros', async () => {
      const result1 = await trackConversionEvent(null, 'user-123', 'event')
      expect(result1).toBeNull()
      expect(console.warn).toHaveBeenCalled()

      const result2 = await trackConversionEvent(mockSupabase, null, 'event')
      expect(result2).toBeNull()

      const result3 = await trackConversionEvent(mockSupabase, 'user', null)
      expect(result3).toBeNull()
    })

    test('debe manejar error de tabla no existente graciosamente', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: null,
        error: { code: '42P01', message: 'relation does not exist' }
      })

      const result = await trackConversionEvent(
        mockSupabase,
        'user-123',
        'limit_reached',
        {}
      )

      expect(result).toBeNull()
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('Tabla conversion_events no existe')
      )
    })

    test('debe manejar otros errores graciosamente', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: null,
        error: { code: 'OTHER', message: 'Some error' }
      })

      const result = await trackConversionEvent(
        mockSupabase,
        'user-123',
        'limit_reached',
        {}
      )

      expect(result).toBeNull()
      expect(console.error).toHaveBeenCalled()
    })

    test('debe manejar excepciones sin romper la app', async () => {
      mockSupabase.rpc.mockRejectedValue(new Error('Network error'))

      const result = await trackConversionEvent(
        mockSupabase,
        'user-123',
        'limit_reached',
        {}
      )

      expect(result).toBeNull()
      expect(console.error).toHaveBeenCalled()
    })
  })

  describe('trackLimitReached', () => {
    test('debe llamar trackConversionEvent con evento correcto', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: 'event-uuid-456',
        error: null
      })

      const result = await trackLimitReached(mockSupabase, 'user-123', 25)

      expect(mockSupabase.rpc).toHaveBeenCalledWith('track_conversion_event', {
        p_user_id: 'user-123',
        p_event_type: 'limit_reached',
        p_event_data: expect.objectContaining({
          questions_today: 25,
          timestamp: expect.any(String)
        })
      })

      expect(result).toBe('event-uuid-456')
    })

    test('debe incluir timestamp en event_data', async () => {
      mockSupabase.rpc.mockResolvedValue({ data: 'id', error: null })

      await trackLimitReached(mockSupabase, 'user-123', 25)

      const call = mockSupabase.rpc.mock.calls[0]
      const eventData = call[1].p_event_data

      expect(eventData.timestamp).toBeDefined()
      expect(new Date(eventData.timestamp)).toBeInstanceOf(Date)
    })
  })

  describe('trackUpgradeModalView', () => {
    test('debe trackear vista del modal con source', async () => {
      mockSupabase.rpc.mockResolvedValue({ data: 'id', error: null })

      await trackUpgradeModalView(mockSupabase, 'user-123', 'limit')

      expect(mockSupabase.rpc).toHaveBeenCalledWith('track_conversion_event', {
        p_user_id: 'user-123',
        p_event_type: 'upgrade_modal_viewed',
        p_event_data: expect.objectContaining({
          source: 'limit'
        })
      })
    })

    test('debe usar source por defecto si no se proporciona', async () => {
      mockSupabase.rpc.mockResolvedValue({ data: 'id', error: null })

      await trackUpgradeModalView(mockSupabase, 'user-123')

      const call = mockSupabase.rpc.mock.calls[0]
      expect(call[1].p_event_data.source).toBe('limit')
    })
  })

  describe('trackUpgradeButtonClick', () => {
    test('debe trackear clic en botón de upgrade', async () => {
      mockSupabase.rpc.mockResolvedValue({ data: 'id', error: null })

      await trackUpgradeButtonClick(mockSupabase, 'user-123', 'banner')

      expect(mockSupabase.rpc).toHaveBeenCalledWith('track_conversion_event', {
        p_user_id: 'user-123',
        p_event_type: 'upgrade_button_clicked',
        p_event_data: expect.objectContaining({
          source: 'banner'
        })
      })
    })
  })

  describe('CONVERSION_EVENTS constantes', () => {
    test('debe tener todos los eventos definidos', () => {
      expect(CONVERSION_EVENTS.LIMIT_REACHED).toBe('limit_reached')
      expect(CONVERSION_EVENTS.UPGRADE_MODAL_VIEWED).toBe('upgrade_modal_viewed')
      expect(CONVERSION_EVENTS.UPGRADE_BUTTON_CLICKED).toBe('upgrade_button_clicked')
      expect(CONVERSION_EVENTS.PAYMENT_COMPLETED).toBe('payment_completed')
      expect(CONVERSION_EVENTS.REGISTRATION).toBe('registration')
    })
  })
})
