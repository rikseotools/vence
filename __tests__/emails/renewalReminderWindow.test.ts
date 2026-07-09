// __tests__/emails/renewalReminderWindow.test.ts
// La ventana de selección de recordatorios (7d/1d) era lógica inline sin cobertura:
// si se rompe (off-by-one, salto de mes), NADIE recibe el aviso y el heartbeat no lo ve.
// Aquí se blinda la función pura.
import { renewalReminderWindow } from '@/lib/api/renewal-reminders/queries'

describe('renewalReminderWindow', () => {
  it('7 días → día objetivo con límites 00:00:00.000 y 23:59:59.999', () => {
    const now = new Date(2026, 6, 2, 15, 30) // 2 jul 2026 15:30 (local)
    const { start, end } = renewalReminderWindow(now, 7)
    expect([start.getFullYear(), start.getMonth(), start.getDate()]).toEqual([2026, 6, 9])
    expect([start.getHours(), start.getMinutes(), start.getSeconds(), start.getMilliseconds()]).toEqual([0, 0, 0, 0])
    expect([end.getMonth(), end.getDate()]).toEqual([6, 9])
    expect([end.getHours(), end.getMinutes(), end.getSeconds(), end.getMilliseconds()]).toEqual([23, 59, 59, 999])
  })

  it('1 día → el día siguiente', () => {
    const { start } = renewalReminderWindow(new Date(2026, 6, 8, 9, 0), 1)
    expect([start.getMonth(), start.getDate()]).toEqual([6, 9])
  })

  it('salto de mes: 30 jul + 7 = 6 ago', () => {
    const { start } = renewalReminderWindow(new Date(2026, 6, 30, 12, 0), 7)
    expect([start.getMonth(), start.getDate()]).toEqual([7, 6])
  })

  it('la ventana cubre exactamente un día natural', () => {
    const { start, end } = renewalReminderWindow(new Date(2026, 6, 2), 7)
    expect(start.getDate()).toBe(end.getDate())
    expect(end.getTime() - start.getTime()).toBe(24 * 3600 * 1000 - 1)
  })
})
