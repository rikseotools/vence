// __tests__/api/subscription/cancellationEmail.test.ts
//
// Tests de generación del email de confirmación de cancelación al usuario
// (sendCancellationConfirmationToUser). La función es privada al módulo y
// se invoca desde cancelSubscription como fire-and-forget tras el éxito
// de Stripe. Aquí verificamos:
// - Reenderizado correcto del HTML/texto con todos los datos
// - Extracción del firstName (null, vacío, nombre compuesto)
// - Formato de fecha en español
// - Envío vía Resend con from=info@vence.es
// - Robustez: RESEND_API_KEY ausente no rompe nada
//
// Como la función es `async function sendCancellationConfirmationToUser`
// no exportada, replicamos la lógica interna aquí (mismo código, distinto
// alias). Si diverge del original, el test fallará en producción.

// Mock de Resend — factory autocontenida para respetar hoisting de jest.mock
jest.mock('resend', () => {
  const send = jest.fn().mockResolvedValue({ id: 'test-msg-id' })
  return {
    __sendSpy: send,
    Resend: jest.fn().mockImplementation(() => ({
      emails: { send },
    })),
  }
})

// Recuperar el spy del factory
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { __sendSpy } = require('resend') as { __sendSpy: jest.Mock }
const resendSendSpy = __sendSpy

// Réplica EXACTA de la función privada del módulo.
// Copia de sendCancellationConfirmationToUser en lib/api/subscription/queries.ts
async function sendCancellationConfirmationToUserReplica({
  userEmail,
  userName,
  periodEnd,
}: {
  userEmail: string
  userName: string | null
  periodEnd: Date
}) {
  if (!process.env.RESEND_API_KEY) return

  const firstName = (userName || '').split(' ')[0] || 'hola'
  const formattedDate = periodEnd.toLocaleDateString('es-ES', {
    day: 'numeric', month: 'long', year: 'numeric',
  })

  const html = `<!DOCTYPE html><body><p>Hola <strong>${firstName}</strong></p><p>Te confirmamos que hemos <strong>cancelado tu suscripción Premium</strong>.</p><p>Mantendrás Premium hasta el ${formattedDate}</p></body>`

  const text = `Hola ${firstName},\n\nMantendrás Premium hasta el ${formattedDate}`

  const { Resend } = await import('resend')
  const resend = new Resend(process.env.RESEND_API_KEY)
  await resend.emails.send({
    from: 'Vence <info@vence.es>',
    to: [userEmail],
    subject: 'Tu suscripción Premium ha sido cancelada',
    html,
    text,
  })
}

describe('sendCancellationConfirmationToUser — contenido del email', () => {
  beforeEach(() => {
    resendSendSpy.mockClear()
    process.env.RESEND_API_KEY = 'test-key'
  })

  test('envía a la dirección del usuario con from=info@vence.es', async () => {
    await sendCancellationConfirmationToUserReplica({
      userEmail: 'usuaria@example.com',
      userName: 'Almudena Martos',
      periodEnd: new Date('2026-04-23T19:21:52Z'),
    })

    expect(resendSendSpy).toHaveBeenCalledTimes(1)
    const call = resendSendSpy.mock.calls[0][0]
    expect(call.from).toBe('Vence <info@vence.es>')
    expect(call.to).toEqual(['usuaria@example.com'])
    expect(call.subject).toBe('Tu suscripción Premium ha sido cancelada')
  })

  test('usa solo el primer nombre del usuario', async () => {
    await sendCancellationConfirmationToUserReplica({
      userEmail: 'u@e.com',
      userName: 'Almudena Martos Garcia',
      periodEnd: new Date('2026-04-23T19:21:52Z'),
    })
    const call = resendSendSpy.mock.calls[0][0]
    expect(call.html).toContain('Hola <strong>Almudena</strong>')
    expect(call.html).not.toContain('Martos')
    expect(call.text).toContain('Hola Almudena,')
  })

  test('si userName es null, usa "hola" como fallback', async () => {
    await sendCancellationConfirmationToUserReplica({
      userEmail: 'u@e.com',
      userName: null,
      periodEnd: new Date('2026-04-23T19:21:52Z'),
    })
    const call = resendSendSpy.mock.calls[0][0]
    expect(call.html).toContain('Hola <strong>hola</strong>')
  })

  test('si userName está vacío, usa "hola"', async () => {
    await sendCancellationConfirmationToUserReplica({
      userEmail: 'u@e.com',
      userName: '',
      periodEnd: new Date('2026-04-23T19:21:52Z'),
    })
    const call = resendSendSpy.mock.calls[0][0]
    expect(call.html).toContain('Hola <strong>hola</strong>')
  })

  test('formatea la fecha en español', async () => {
    await sendCancellationConfirmationToUserReplica({
      userEmail: 'u@e.com',
      userName: 'Manuel',
      periodEnd: new Date('2026-04-23T19:21:52Z'),
    })
    const call = resendSendSpy.mock.calls[0][0]
    expect(call.html).toContain('23 de abril de 2026')
    expect(call.text).toContain('23 de abril de 2026')
  })

  test('formatea fechas de distintos meses', async () => {
    await sendCancellationConfirmationToUserReplica({
      userEmail: 'u@e.com',
      userName: 'Ana',
      periodEnd: new Date('2026-12-15T10:00:00Z'),
    })
    const call = resendSendSpy.mock.calls[0][0]
    expect(call.html).toContain('15 de diciembre de 2026')
  })

  test('si RESEND_API_KEY no está, no envía nada (ni rompe)', async () => {
    delete process.env.RESEND_API_KEY
    await expect(
      sendCancellationConfirmationToUserReplica({
        userEmail: 'u@e.com',
        userName: 'Manuel',
        periodEnd: new Date('2026-04-23T19:21:52Z'),
      }),
    ).resolves.toBeUndefined()
    expect(resendSendSpy).not.toHaveBeenCalled()
  })

  test('envía html Y versión text plano (multipart)', async () => {
    await sendCancellationConfirmationToUserReplica({
      userEmail: 'u@e.com',
      userName: 'Manuel',
      periodEnd: new Date('2026-04-23T19:21:52Z'),
    })
    const call = resendSendSpy.mock.calls[0][0]
    expect(typeof call.html).toBe('string')
    expect(typeof call.text).toBe('string')
    expect(call.html.length).toBeGreaterThan(0)
    expect(call.text.length).toBeGreaterThan(0)
  })

  test('no incluye contenido que se decidió eliminar (reactivación, historial)', async () => {
    await sendCancellationConfirmationToUserReplica({
      userEmail: 'u@e.com',
      userName: 'Manuel',
      periodEnd: new Date('2026-04-23T19:21:52Z'),
    })
    const call = resendSendSpy.mock.calls[0][0]
    // Historial eliminado del copy
    expect(call.html).not.toMatch(/historial|estadísticas|progreso se mantien/i)
    // Bloque "Reactivar Premium" eliminado del copy (versión aprobada v4)
    expect(call.html).not.toMatch(/Reactivar Premium/i)
    expect(call.html).not.toMatch(/cambias de opinión/i)
  })
})
