/**
 * [T-448] «El cron ticó (2xx) pero no envió nada» — para LAS DOS campañas, no solo una.
 *
 * El guardarraíl existía desde hacía tiempo… y protegía únicamente los recordatorios de COBRO.
 * La campaña de fin de suscripción corre en el MISMO handler, avisa a quien va a **perder su
 * precio antiguo** (20/35/59 € frente a los 29/39/69 € vigentes) y sus resultados solo iban a
 * `console.log` y al JSON de respuesta. Si un día tenía candidatos y no salía ninguno —consulta
 * rota, dedup pasado de listo, Resend caído— no quedaba señal en ninguna parte: se sabría cuando
 * alguien escribiera preguntando por qué se había quedado sin su precio.
 *
 * El criterio vive AQUÍ y no en dos `if` dentro del handler porque eso es exactamente lo que
 * dejó a una de las dos sin cubrir.
 */
import { campanaNoEnvioNada, mensajeSinEnvios } from '@/lib/api/premium/campanaSinEnvios'

describe('campanaNoEnvioNada (T-448)', () => {
  it('había destinatarios y no salió ninguno → ALARMA', () => {
    expect(campanaNoEnvioNada({ total: 5, sent: 0 })).toBe(true)
  })

  it('había destinatarios y salieron → normal', () => {
    expect(campanaNoEnvioNada({ total: 5, sent: 5 })).toBe(false)
    expect(campanaNoEnvioNada({ total: 5, sent: 1 })).toBe(false)
  })

  it('NO había nadie a quien avisar → NO es alarma (es el día normal)', () => {
    // La mayoría de los días no vence nadie. Tratar ese cero como avería llenaría el correo de
    // ruido y la alerta se acabaría silenciando — que es como se pierden las que sí importan.
    expect(campanaNoEnvioNada({ total: 0, sent: 0 })).toBe(false)
  })

  it('los omitidos y fallidos no cambian el veredicto: lo que manda es que no salió NINGUNO', () => {
    // Omitidos por idempotencia con 0 enviados sigue siendo «hoy nadie recibió su aviso».
    expect(campanaNoEnvioNada({ total: 4, sent: 0, skipped: 4, failed: 0 })).toBe(true)
    expect(campanaNoEnvioNada({ total: 4, sent: 0, skipped: 0, failed: 4 })).toBe(true)
  })

  it('aguanta números que llegan como texto (vienen de un JSON)', () => {
    expect(campanaNoEnvioNada({ total: '3', sent: '0' } as never)).toBe(true)
    expect(campanaNoEnvioNada({ total: '0', sent: '0' } as never)).toBe(false)
  })

  it('el mensaje lleva los números para diagnosticar sin abrir otra consulta', () => {
    const m = mensajeSinEnvios('fin_suscripcion', { total: 7, sent: 0, skipped: 2, failed: 5 })
    expect(m).toContain('fin_suscripcion')
    expect(m).toContain('7 destinatario')
    expect(m).toContain('omitidos:2')
    expect(m).toContain('fallidos:5')
  })

  it('sin omitidos/fallidos el mensaje no inventa: dice 0', () => {
    expect(mensajeSinEnvios('renovacion', { total: 1, sent: 0 })).toContain('omitidos:0, fallidos:0')
  })
})
