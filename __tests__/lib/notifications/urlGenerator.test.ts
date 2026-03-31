// __tests__/lib/notifications/urlGenerator.test.js
// Tests unitarios para la generación de URLs de notificaciones

// Mock getCanonicalSlugAsync para que resuelve via specialCases o genera slug
jest.mock('@/lib/api/laws/queries', () => ({
  getCanonicalSlugAsync: jest.fn(async (shortName: string) => {
    const specialCases: Record<string, string> = {
      'LPAC': 'ley-39-2015',
      'LRJSP': 'ley-40-2015',
      'Ley 40/2015': 'ley-40-2015',
      'CE': 'ce',
      'Constitución Española': 'ce',
      'TUE': 'tue',
      'TFUE': 'tfue',
    }
    if (specialCases[shortName]) return specialCases[shortName]
    return shortName?.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
  }),
}))

const { generateNotificationActionUrl, generateLawSlug } = require('../../../lib/notifications/urlGenerator')

describe('generateLawSlug', () => {
  it('devuelve "unknown" para valores undefined o vacíos', async () => {
    expect(await generateLawSlug(undefined)).toBe('unknown')
    expect(await generateLawSlug('')).toBe('unknown')
  })

  it('maneja casos especiales de leyes conocidas', async () => {
    expect(await generateLawSlug('LPAC')).toBe('ley-39-2015')
    expect(await generateLawSlug('LRJSP')).toBe('ley-40-2015')
    expect(await generateLawSlug('CE')).toBe('ce')
    expect(await generateLawSlug('Constitución Española')).toBe('ce')
    expect(await generateLawSlug('TUE')).toBe('tue')
    expect(await generateLawSlug('TFUE')).toBe('tfue')
    expect(await generateLawSlug('Ley 40/2015')).toBe('ley-40-2015')
  })

  it('genera slugs correctos para leyes no especiales', async () => {
    expect(await generateLawSlug('Ley Orgánica 3/2007')).toBe('ley-organica-3-2007')
    expect(await generateLawSlug('Real Decreto 5/2015')).toBe('real-decreto-5-2015')
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

    it('genera URL correcta a /soporte con view_dispute', async () => {
      const url = await generateNotificationActionUrl(disputeNotification, 'view_dispute')

      expect(url).toContain('/soporte?tab=impugnaciones')
      expect(url).toContain('dispute_id=abc123')
      expect(url).toContain('utm_source=notification')
    })

    it('usa disputeId si está disponible', async () => {
      const url = await generateNotificationActionUrl(disputeNotification, 'view_dispute')
      expect(url).toContain('dispute_id=abc123')
    })

    it('extrae disputeId del id si no está disputeId', async () => {
      const notification = {
        id: 'dispute-xyz789',
        type: 'dispute_update',
        campaign: 'disputes'
      }
      const url = await generateNotificationActionUrl(notification, 'view_dispute')
      expect(url).toContain('dispute_id=xyz789')
    })

    it('REGRESIÓN: NO debe ir a /test/rapido con view_dispute', async () => {
      const url = await generateNotificationActionUrl(disputeNotification, 'view_dispute')

      expect(url).not.toMatch(/^\/test\/rapido/)
      expect(url).toMatch(/^\/soporte/)
    })

    it('REGRESIÓN: view_corrected_question cae al default (este era el bug)', async () => {
      const url = await generateNotificationActionUrl(disputeNotification, 'view_corrected_question')
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

    it('genera URL para intensive_test', async () => {
      const url = await generateNotificationActionUrl(notification, 'intensive_test')

      expect(url).toContain('/test/rapido')
      expect(url).toContain('mode=intensive')
      expect(url).toContain('articles=21%2C22')
      expect(url).toContain('law_short_name=LPAC')
      expect(url).toContain('law=ley-39-2015')
    })

    it('genera URL para view_theory', async () => {
      const url = await generateNotificationActionUrl(notification, 'view_theory')

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

    it('genera URL para directed_test', async () => {
      const url = await generateNotificationActionUrl(notification, 'directed_test')

      expect(url).toContain('/test/rapido')
      expect(url).toContain('mode=recovery')
      expect(url).toContain('n=15')
      expect(url).toContain('law_short_name=CE')
      expect(url).toContain('law=ce')
    })
  })

  describe('study_streak', () => {
    const notification = {
      id: 'notif-789',
      type: 'study_streak',
      campaign: 'streak'
    }

    it('genera URL para maintain_streak', async () => {
      const url = await generateNotificationActionUrl(notification, 'maintain_streak')

      expect(url).toContain('/test/mantener-racha')
      expect(url).toContain('mode=streak')
      expect(url).toContain('n=5')
    })

    it('genera URL para view_streak_stats', async () => {
      const url = await generateNotificationActionUrl(notification, 'view_streak_stats')

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

    it('genera URL para open_chat', async () => {
      const url = await generateNotificationActionUrl(notification, 'open_chat')

      expect(url).toContain('/soporte')
      expect(url).toContain('conversation_id=conv-123')
    })
  })

  describe('fallback behavior', () => {
    it('devuelve /test/rapido para tipos desconocidos', async () => {
      const notification = {
        id: 'notif-unknown',
        type: 'unknown_type',
        campaign: 'general'
      }
      const url = await generateNotificationActionUrl(notification, 'some_action')

      expect(url).toContain('/test/rapido')
      expect(url).toContain('utm_source=notification')
    })

    it('devuelve /test/rapido para acciones no manejadas', async () => {
      const notification = {
        id: 'notif-test',
        type: 'study_streak',
        campaign: 'general'
      }
      const url = await generateNotificationActionUrl(notification, 'unknown_action')

      expect(url).toContain('/test/rapido')
    })
  })
})

describe('Integración: Flujo de notificación de disputa', () => {
  it('el flujo correcto SIEMPRE debe usar view_dispute para disputas', async () => {
    const disputeNotification = {
      id: 'dispute-real-test',
      type: 'dispute_update',
      disputeId: 'real-dispute-id',
      campaign: 'disputes'
    }

    const correctActionType = 'view_dispute'
    const url = await generateNotificationActionUrl(disputeNotification, correctActionType)

    expect(url).toContain('/soporte?tab=impugnaciones')
    expect(url).toContain('dispute_id=real-dispute-id')
    expect(url).not.toContain('/test/rapido')
  })

  it('documentación del bug anterior: usar action.type causaba el problema', async () => {
    const disputeNotification = {
      id: 'dispute-bug-demo',
      type: 'dispute_update',
      disputeId: 'bug-demo-id',
      campaign: 'disputes'
    }

    const buggyActionType = 'view_corrected_question'
    const buggyUrl = await generateNotificationActionUrl(disputeNotification, buggyActionType)

    expect(buggyUrl).toContain('/test/rapido')
    expect(buggyUrl).not.toContain('/soporte')
  })
})
