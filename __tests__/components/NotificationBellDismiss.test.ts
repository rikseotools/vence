// __tests__/components/NotificationBellDismiss.test.ts
// Tests para verificar que handleDismiss marca correctamente como leído
// tanto notificaciones normales como de impugnaciones (dispute_update)

import * as fs from 'fs'
import * as path from 'path'

const ROOT = path.resolve(__dirname, '../..')
const content = fs.readFileSync(
  path.join(ROOT, 'components/NotificationBell.tsx'), 'utf-8'
)

describe('NotificationBell — handleDismiss marca disputes como leído', () => {

  it('handleDismiss existe en el componente', () => {
    expect(content).toContain('const handleDismiss')
  })

  it('handleDismiss llama markAsRead para notificaciones normales', () => {
    // Debe llamar markAsRead(notification.id) siempre
    expect(content).toMatch(/handleDismiss[\s\S]*?markAsRead\(notification\.id\)/)
  })

  it('handleDismiss detecta dispute_update y marca en tabla de disputas', () => {
    // After handleDismiss, before next function — get a wider block
    const startIdx = content.indexOf('const handleDismiss')
    const endIdx = content.indexOf('const handleRefresh')
    const handleDismissBlock = content.substring(startIdx, endIdx)

    expect(handleDismissBlock).toContain("notification.type === 'dispute_update'")
    expect(handleDismissBlock).toContain('disputeNotifications.markAsRead')
  })

  it('handleDismiss extrae realDisputeId para disputes', () => {
    const startIdx = content.indexOf('const handleDismiss')
    const endIdx = content.indexOf('const handleRefresh')
    const handleDismissBlock = content.substring(startIdx, endIdx)

    expect(handleDismissBlock).toContain('notification.disputeId')
  })

  it('handleDismiss pasa isPsychometric a disputeNotifications.markAsRead', () => {
    const startIdx = content.indexOf('const handleDismiss')
    const endIdx = content.indexOf('const handleRefresh')
    const handleDismissBlock = content.substring(startIdx, endIdx)

    expect(handleDismissBlock).toContain('notification.isPsychometric')
  })
})

describe('NotificationBell — handleMarkAsRead consistencia con handleDismiss', () => {

  it('handleMarkAsRead también detecta dispute_update', () => {
    const startIdx = content.indexOf('const handleMarkAsRead')
    const endIdx = content.indexOf('const handleDismiss')
    const block = content.substring(startIdx, endIdx)

    expect(block).toContain("notification.type === 'dispute_update'")
    expect(block).toContain('disputeNotifications.markAsRead')
  })

  it('ambos handlers usan la misma lógica para extraer disputeId', () => {
    const dismissStart = content.indexOf('const handleDismiss')
    const dismissEnd = content.indexOf('const handleRefresh')
    const dismissBlock = content.substring(dismissStart, dismissEnd)

    const markStart = content.indexOf('const handleMarkAsRead')
    const markEnd = content.indexOf('const handleDismiss')
    const markBlock = content.substring(markStart, markEnd)

    // Both must extract disputeId the same way
    expect(dismissBlock).toContain("notification.id.replace('dispute-', '')")
    expect(markBlock).toContain("notification.id.replace('dispute-', '')")
  })
})

describe('NotificationBell — primaryAction también marca disputes', () => {

  it('acción primaria de dispute_update llama disputeNotifications.markAsRead', () => {
    // En el handler de acción primaria, dispute_update debe marcar como leído
    expect(content).toMatch(/actionType === 'primary'[\s\S]*?dispute_update[\s\S]*?disputeNotifications\.markAsRead/)
  })
})

describe('NotificationBell — no envía emails de error', () => {

  it('no contiene referencia a send-admin-notification', () => {
    expect(content).not.toContain('send-admin-notification')
  })
})
