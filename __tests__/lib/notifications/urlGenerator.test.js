// __tests__/lib/notifications/urlGenerator.test.js
// Tests unitarios para la generación de URLs de notificaciones

const { generateNotificationActionUrl, generateLawSlug } = require('../../../lib/notifications/urlGenerator')

describe('generateLawSlug', () => {
  it('devuelve "unknown" para valores undefined o vacíos', () => {
    expect(generateLawSlug(undefined)).toBe('unknown')
    expect(generateLawSlug('')).toBe('unknown')
  })

  it('maneja casos especiales de leyes conocidas', () => {
    expect(generateLawSlug('LPAC')).toBe('ley-39-2015')
    expect(generateLawSlug('LRJSP')).toBe('ley-40-2015')
    expect(generateLawSlug('CE')).toBe('ce')
    expect(generateLawSlug('Constitución Española')).toBe('ce')
    expect(generateLawSlug('TUE')).toBe('tue')
    expect(generateLawSlug('TFUE')).toBe('tfue')
    expect(generateLawSlug('Ley 40/2015')).toBe('ley-40-2015')
  })

  it('genera slugs correctos para leyes no especiales', () => {
    expect(generateLawSlug('Ley Orgánica 3/2007')).toBe('ley-org-nica-3-2007')
    expect(generateLawSlug('Real Decreto 5/2015')).toBe('real-decreto-5-2015')
  })
})

describe('generateNotificationActionUrl', () => {
  describe('dispute_update - CRÍTICO', () => {
    const disputeNotification = {
      id: 'dispute-abc123',
      type: 'dispute_update',
      campaign: 'disputes',
      disputeId: 'abc123'
    }

    it('genera URL correcta a /soporte con view_dispute', () => {
      const url = generateNotificationActionUrl(disputeNotification, 'view_dispute')

      expect(url).toContain('/soporte?tab=impugnaciones')
      expect(url).toContain('dispute_id=abc123')
      expect(url).toContain('utm_source=notification')
    })

    it('usa disputeId si está disponible', () => {
      const url = generateNotificationActionUrl(disputeNotification, 'view_dispute')
      expect(url).toContain('dispute_id=abc123')
    })

    it('extrae disputeId del id si no está disputeId', () => {
      const notification = {
        id: 'dispute-xyz789',
        type: 'dispute_update',
        campaign: 'disputes'
        // Sin disputeId explícito
      }
      const url = generateNotificationActionUrl(notification, 'view_dispute')
      expect(url).toContain('dispute_id=xyz789')
    })

    it('REGRESIÓN: NO debe ir a /test/rapido con view_dispute', () => {
      const url = generateNotificationActionUrl(disputeNotification, 'view_dispute')

      expect(url).not.toMatch(/^\/test\/rapido/)
      expect(url).toMatch(/^\/soporte/)
    })

    it('REGRESIÓN: view_corrected_question cae al default (este era el bug)', () => {
      // Este test documenta el comportamiento que causaba el bug
      // El tipo 'view_corrected_question' no está manejado, así que cae al default
      const url = generateNotificationActionUrl(disputeNotification, 'view_corrected_question')

      // IMPORTANTE: Este es el comportamiento que causaba el bug
      // Por eso en NotificationBell.tsx SIEMPRE debemos usar 'view_dispute'
      expect(url).toContain('/test/rapido')
    })
  })

  describe('problematic_articles', () => {
    const notification = {
      id: 'notif-123',
      type: 'problematic_articles',
      campaign: 'study',
      law_short_name: 'LPAC',
      articlesList: [
        { article_number: '21', accuracy_percentage: 40 },
        { article_number: '22', accuracy_percentage: 35 }
      ],
      articlesCount: 2
    }

    it('genera URL para intensive_test', () => {
      const url = generateNotificationActionUrl(notification, 'intensive_test')

      expect(url).toContain('/test/rapido')
      expect(url).toContain('mode=intensive')
      expect(url).toContain('articles=21%2C22')
      expect(url).toContain('law=ley-39-2015')
    })

    it('genera URL para view_theory', () => {
      const url = generateNotificationActionUrl(notification, 'view_theory')

      expect(url).toContain('/teoria/ley-39-2015')
    })
  })

  describe('level_regression', () => {
    const notification = {
      id: 'notif-456',
      type: 'level_regression',
      campaign: 'recovery',
      law_short_name: 'CE'
    }

    it('genera URL para directed_test', () => {
      const url = generateNotificationActionUrl(notification, 'directed_test')

      expect(url).toContain('/test/rapido')
      expect(url).toContain('mode=recovery')
      expect(url).toContain('n=15')
      expect(url).toContain('law=ce')
    })
  })

  describe('study_streak', () => {
    const notification = {
      id: 'notif-789',
      type: 'study_streak',
      campaign: 'streak'
    }

    it('genera URL para maintain_streak', () => {
      const url = generateNotificationActionUrl(notification, 'maintain_streak')

      expect(url).toContain('/test/mantener-racha')
      expect(url).toContain('mode=streak')
      expect(url).toContain('n=5')
    })

    it('genera URL para view_streak_stats', () => {
      const url = generateNotificationActionUrl(notification, 'view_streak_stats')

      expect(url).toContain('/mis-estadisticas')
    })
  })

  describe('feedback_response', () => {
    const notification = {
      id: 'notif-feedback',
      type: 'feedback_response',
      campaign: 'support',
      context_data: { conversation_id: 'conv-123' }
    }

    it('genera URL para open_chat', () => {
      const url = generateNotificationActionUrl(notification, 'open_chat')

      expect(url).toContain('/soporte')
      expect(url).toContain('conversation_id=conv-123')
    })
  })

  describe('fallback behavior', () => {
    it('devuelve /test/rapido para tipos desconocidos', () => {
      const notification = {
        id: 'notif-unknown',
        type: 'unknown_type',
        campaign: 'general'
      }
      const url = generateNotificationActionUrl(notification, 'some_action')

      expect(url).toContain('/test/rapido')
      expect(url).toContain('utm_source=notification')
    })

    it('devuelve /test/rapido para acciones no manejadas', () => {
      const notification = {
        id: 'notif-test',
        type: 'study_streak',
        campaign: 'general'
      }
      const url = generateNotificationActionUrl(notification, 'unknown_action')

      expect(url).toContain('/test/rapido')
    })
  })
})

describe('Integración: Flujo de notificación de disputa', () => {
  // Este test simula el flujo completo que ocurre en NotificationBell
  it('el flujo correcto SIEMPRE debe usar view_dispute para disputas', () => {
    const disputeNotification = {
      id: 'dispute-real-test',
      type: 'dispute_update',
      disputeId: 'real-dispute-id',
      campaign: 'disputes'
    }

    // Este es el flujo CORRECTO que implementamos en el fix
    const correctActionType = 'view_dispute' // Hardcodeado en NotificationBell
    const url = generateNotificationActionUrl(disputeNotification, correctActionType)

    expect(url).toContain('/soporte?tab=impugnaciones')
    expect(url).toContain('dispute_id=real-dispute-id')
    expect(url).not.toContain('/test/rapido')
  })

  it('documentación del bug anterior: usar action.type causaba el problema', () => {
    // Este test documenta qué pasaba ANTES del fix
    // NOTIFICATION_TYPES['dispute_update'].primaryAction.type era 'view_corrected_question'
    const disputeNotification = {
      id: 'dispute-bug-demo',
      type: 'dispute_update',
      disputeId: 'bug-demo-id',
      campaign: 'disputes'
    }

    // ANTES del fix, se usaba action.type que era 'view_corrected_question'
    const buggyActionType = 'view_corrected_question'
    const buggyUrl = generateNotificationActionUrl(disputeNotification, buggyActionType)

    // Esto causaba que fuera a /test/rapido (el bug que reportó Nila)
    expect(buggyUrl).toContain('/test/rapido')
    expect(buggyUrl).not.toContain('/soporte')
  })
})
