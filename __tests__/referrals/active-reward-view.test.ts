// Guardarraíl del mapeo de transparencia del bonus "registro activo" (deriveActiveReward).
// Es DINERO que se le PROMETE al embajador en pantalla → cada modo de fallo = un test.
import { deriveActiveReward } from '@/lib/referrals/logic'

describe('deriveActiveReward — cómo se muestra el bonus de registro activo por referido', () => {
  test('concedido (grantedAmount) → earned con el importe real, aunque el programa esté apagado', () => {
    const r = deriveActiveReward({ grantedAmount: 2, testsDone: 7, status: 'pending', enabled: false })
    expect(r.state).toBe('earned')
    expect(r.amount).toBe(2)
    expect(r.testsDone).toBe(7)
  })

  test('sin conceder + programa activo + no rechazado → pending con el promocionado (2€) y progreso', () => {
    const r = deriveActiveReward({ grantedAmount: null, testsDone: 3, status: 'pending', enabled: true })
    expect(r.state).toBe('pending')
    expect(r.amount).toBe(2)
    expect(r.testsDone).toBe(3)
    expect(r.testsNeeded).toBeGreaterThan(0)
  })

  test('programa APAGADO → none (no se promete nada)', () => {
    const r = deriveActiveReward({ grantedAmount: null, testsDone: 3, status: 'pending', enabled: false })
    expect(r.state).toBe('none')
    expect(r.amount).toBe(0)
  })

  test('referido RECHAZADO → none aunque el programa esté activo (no prometer a un descartado)', () => {
    const r = deriveActiveReward({ grantedAmount: null, testsDone: 9, status: 'rejected', enabled: true })
    expect(r.state).toBe('none')
  })

  test('un referido rechazado PERO ya concedido antes → sigue earned (respeta lo pagado)', () => {
    const r = deriveActiveReward({ grantedAmount: 2, testsDone: 9, status: 'rejected', enabled: true })
    expect(r.state).toBe('earned')
    expect(r.amount).toBe(2)
  })

  test('testsDone negativo/basura → se clampa a 0 (no se muestran negativos)', () => {
    const r = deriveActiveReward({ grantedAmount: null, testsDone: -5, status: 'pending', enabled: true })
    expect(r.testsDone).toBe(0)
  })
})
