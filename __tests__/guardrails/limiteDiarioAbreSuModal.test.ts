/**
 * @jest-environment node
 *
 * Cada rechazo del servidor abre EL modal que le corresponde (T-304, 30/07/2026).
 *
 * Hay dos cosas distintas que devuelven 403 y que es fácil confundir:
 *   · `deviceLimitReached` → «ya tienes N dispositivos conectados, desconecta uno» (DeviceLimitModal)
 *   · `limitReached`       → «se te acabaron las preguntas de hoy» (UpgradeLimitModal, Premium)
 *
 * El bloqueo por CUPO del dispositivo devolvía `limitReached`, y el único puente que existía en la
 * cola escuchaba `deviceLimitReached`. Resultado: no se abría NADA. Quien cambiaba de cuenta seguía
 * respondiendo mientras sus respuestas se perdían en silencio — que es peor que un muro claro.
 *
 * Y la tentación fácil (reutilizar `deviceLimitReached`) habría sido peor: le diría al usuario que
 * desconecte dispositivos cuando lo que falla es el cupo del día. Arreglar lo que no está roto.
 */
import { readFileSync } from 'fs'
import { join } from 'path'

const ROOT = join(__dirname, '..', '..')
const cola = readFileSync(join(ROOT, 'utils/answerSaveQueue.ts'), 'utf-8')
const testLayout = readFileSync(join(ROOT, 'components/TestLayout.tsx'), 'utf-8')

describe('403 de cupo diario → modal de Premium', () => {
  it('la cola dispara el evento de cupo cuando el 403 trae `limitReached`', () => {
    expect(cola).toMatch(/errorBody\.limitReached/)
    expect(cola).toMatch(/dispatchDailyLimitEvent\(\)/)
  })

  it('NO lo confunde con el límite de número de dispositivos', () => {
    // El de cupo se dispara solo si NO es el de dispositivos: si no, un usuario con demasiados
    // equipos conectados vería el modal de Premium, que no resuelve su problema.
    expect(cola).toMatch(/errorBody\.limitReached && !errorBody\.deviceLimitReached/)
  })

  it('el modal de "desconecta un dispositivo" sigue atado a SU señal', () => {
    expect(cola).toMatch(/errorBody\.deviceLimitReached[\s\S]{0,120}vence:deviceLimitReached/)
  })

  it('TestLayout escucha el evento y abre el modal de Premium', () => {
    expect(testLayout).toMatch(/useDailyLimitEvent\(/)
    expect(testLayout).toMatch(/setShowUpgradeModal\(true\)/)
  })

  it('los dos eventos son DISTINTOS (si se unifican, vuelve el mensaje equivocado)', () => {
    const hookCupo = readFileSync(join(ROOT, 'hooks/useDailyLimitEvent.ts'), 'utf-8')
    const hookDisp = readFileSync(join(ROOT, 'hooks/useDeviceLimitModal.ts'), 'utf-8')
    const nombre = (s: string) => s.match(/'(vence:[a-zA-Z]+)'/)?.[1]
    expect(nombre(hookCupo)).toBe('vence:dailyLimitReached')
    expect(nombre(hookDisp)).toBe('vence:deviceLimitReached')
    expect(nombre(hookCupo)).not.toBe(nombre(hookDisp))
  })
})
