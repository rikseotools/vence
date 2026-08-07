/**
 * @jest-environment node
 *
 * LA PANTALLA Y EL SERVIDOR DECIDEN IGUAL — [T-657], 07/08/2026.
 *
 * ── EL FALLO QUE ESTO IMPIDE ────────────────────────────────────────────────
 * El límite por dispositivo se evalúa en dos sitios con propósitos distintos:
 *   · `/api/v2/answer-and-save` decide si RECHAZA una respuesta ya dada.
 *   · `/api/v2/daily-question/status` decide si la UI levanta el MURO, antes de responder.
 *
 * El primero pasaba por el modo (`shadow` = medir sin cortar) y por la lista de confirmados. El
 * segundo sumaba el consumo del aparato SIEMPRE. Resultado: en sombra, la pantalla cortaba a quien
 * el servidor habría dejado pasar — y como el muro sale ANTES de contestar, la petición no llegaba
 * al servidor y su evento no se emitía. Medido ese día: 59 cuentas free topadas sin haber
 * respondido una sola pregunta, y CERO eventos que lo contaran. Se descubrió por un feedback.
 *
 * La lección no es "acordarse de mirar el modo en los dos sitios": es que **el criterio viva en un
 * solo sitio**. Dos puertas al mismo recurso con criterios distintos no protegen, se contradicen.
 */
import { readFileSync } from 'fs'
import { join } from 'path'

import {
  cuentaElCupoDelDispositivo,
  resolveDeviceLimitMode,
} from '@/lib/security/deviceLimitMode'

const raiz = join(__dirname, '..', '..')
const leer = (p: string) => readFileSync(join(raiz, p), 'utf8')

const STATUS = 'app/api/v2/daily-question/status/route.ts'
const ANSWER = 'app/api/v2/answer-and-save/route.ts'

describe('el criterio del cupo por dispositivo es UNO', () => {
  it('en sombra no cuenta para nadie, salvo confirmado a mano', () => {
    const shadow = resolveDeviceLimitMode('shadow')
    expect(cuentaElCupoDelDispositivo(shadow, false)).toBe(false)
    expect(cuentaElCupoDelDispositivo(shadow, true)).toBe(true)
  })

  it('en enforce cuenta para todos', () => {
    const enforce = resolveDeviceLimitMode('enforce')
    expect(cuentaElCupoDelDispositivo(enforce, false)).toBe(true)
    expect(cuentaElCupoDelDispositivo(enforce, true)).toBe(true)
  })

  it('en off no cuenta ni para los confirmados: `off` es rollback total', () => {
    const off = resolveDeviceLimitMode('off')
    expect(cuentaElCupoDelDispositivo(off, false)).toBe(false)
    expect(cuentaElCupoDelDispositivo(off, true)).toBe(false)
  })

  it('un modo con typo NO enciende el corte (un error de config no cierra el paso)', () => {
    for (const typo of ['enfoce', 'ENFORC', 'sombra', 'activar']) {
      expect(cuentaElCupoDelDispositivo(resolveDeviceLimitMode(typo), false)).toBe(false)
    }
  })
})

describe('el endpoint que levanta el muro pasa por ese criterio', () => {
  const status = leer(STATUS)

  it('consulta el modo vigente y la lista de confirmados', () => {
    expect(status).toContain('currentDeviceLimitMode')
    expect(status).toContain('esFraudeConfirmado')
  })

  it('el conteo del aparato queda DENTRO del criterio compartido, no suelto', () => {
    expect(status).toContain('cuentaElCupoDelDispositivo')
    // La llamada que suma el aparato no puede estar fuera de la guarda: si vuelve a estarlo, la
    // pantalla vuelve a cortar en sombra.
    const guarda = status.indexOf('cuentaElCupoDelDispositivo(')
    const consulta = status.indexOf('checkDeviceDailyUsage(')
    expect(guarda).toBeGreaterThan(-1)
    expect(consulta).toBeGreaterThan(guarda)
  })

  it('deja rastro del muro que ve el usuario (el del servidor no llega a emitirse)', () => {
    expect(status).toContain('device_daily_limit_muro')
  })
})

describe('los dos caminos siguen mirando lo mismo', () => {
  it('ninguno decide con `shouldBlock` a secas por su cuenta', () => {
    // El servidor puede seguir usando shouldBlock para OTRAS cosas (marcar el perfil), pero la
    // decisión de si el cupo del aparato cuenta tiene que salir del criterio compartido en ambos.
    const answer = leer(ANSWER)
    expect(answer).toContain('esFraudeConfirmado')
    expect(answer).toContain('currentDeviceLimitMode')
  })

  it('la corroboración por IP no se salta con una cabecera falsificable', () => {
    // `getClientIp` devuelve igual una IP de confianza que una que puso el cliente. Si el límite se
    // corrobora con la falsificable, basta con mandar una distinta por cuenta para esquivarlo.
    for (const f of [STATUS, ANSWER, 'app/api/exam/answer/route.ts',
                     'app/api/answer/psychometric/route.ts', 'app/api/answer/spelling/route.ts']) {
      const src = leer(f)
      const llamada = src.match(/checkDeviceDailyUsage\([^)]*\)/s)?.[0] ?? ''
      expect(llamada).toContain('ipDeConfianza')
      expect(llamada).not.toContain('getClientIp')
    }
  })
})
