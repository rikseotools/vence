// __tests__/support/campanaSinRespuestasSoporte.test.ts
// [T-378] Guardarraíl estructural (mismo patrón que
// __tests__/components/NotificationBellDismiss.test.ts): las respuestas de soporte
// (feedback + impugnaciones) ya no deben sumar al badge numérico de la campana ni
// entrar en la lista que fusiona `getAllNotifications`. Si alguien vuelve a sumarlas
// ahí, este test lo detecta sin necesitar levantar React ni una sesión real.
import * as fs from 'fs'
import * as path from 'path'

const ROOT = path.resolve(__dirname, '../..')
const bellContent = fs.readFileSync(path.join(ROOT, 'components/NotificationBell.tsx'), 'utf-8')
const intelligentContent = fs.readFileSync(path.join(ROOT, 'hooks/useIntelligentNotifications.ts'), 'utf-8')

describe('NotificationBell — getTotalUnreadCount ya no suma disputeUnread', () => {
  it('no queda ninguna referencia a disputeNotifications.unreadCount', () => {
    expect(bellContent).not.toContain('disputeNotifications.unreadCount')
  })

  it('getTotalUnreadCount solo suma mainUnread + oposicionUnread', () => {
    const start = bellContent.indexOf('const getTotalUnreadCount')
    const end = bellContent.indexOf('const getBadgeColor')
    const block = bellContent.substring(start, end)
    expect(block).toContain('mainUnread')
    expect(block).toContain('oposicionUnread')
    expect(block).not.toContain('disputeUnread')
  })

  it('getAllNotifications ya no fusiona disputeNotifications.notifications', () => {
    const start = bellContent.indexOf('const getAllNotifications')
    const end = bellContent.indexOf('const getFilteredNotifications')
    const block = bellContent.substring(start, end)
    expect(block).not.toContain('disputeNotifications.notifications')
  })
})

describe('useIntelligentNotifications — feedback_response no cuenta como aviso de estudio', () => {
  it('loadSystemNotifications filtra fuera el tipo feedback_response', () => {
    const start = intelligentContent.indexOf('const loadSystemNotifications')
    const end = intelligentContent.indexOf('const loadAvatarRotationNotifications')
    const block = intelligentContent.substring(start, end)
    expect(block).toMatch(/filter\(notif\s*=>\s*notif\.type\s*!==\s*'feedback_response'\)/)
  })
})
