/**
 * @jest-environment node
 */
// Núcleo puro del filtro de destinatarios de newsletter. (T-457, 01/08/2026)
//
// ── QUÉ PASABA ───────────────────────────────────────────────────────────────────────────────
// La newsletter tenía DOS vías de envío y solo una filtraba. Por **audiencia** se excluía a quien
// se había dado de baja (`unsubscribed_all`) o había apagado la newsletter
// (`email_newsletter_disabled`); por **selección manual** (`selectedUserIds`) la consulta era
// `inArray(id, selectedUserIds) AND email IS NOT NULL` — tenían email, y nada más.
//
// El criterio vive ahora en un solo sitio (`lib/api/newsletters/recipients.ts`) y lo usan las dos
// vías. Esto lo fija; el guardarraíl hermano (`__tests__/guardrails/newsletterFiltraPreferencias`)
// impide que alguien vuelva a montar una tercera consulta por su cuenta.
import {
  isBlockedForNewsletter,
  blockedUserIds,
  filterEligibleRecipients,
} from '@/lib/api/newsletters/recipients'

describe('isBlockedForNewsletter — las dos preferencias que bloquean', () => {
  it('bloquea a quien se dio de baja de TODO', () => {
    expect(isBlockedForNewsletter({ userId: 'u1', unsubscribedAll: true })).toBe(true)
  })

  it('bloquea a quien apagó solo la newsletter (quiere lo transaccional)', () => {
    expect(isBlockedForNewsletter({ userId: 'u1', emailNewsletterDisabled: true })).toBe(true)
  })

  it('NO bloquea a quien no ha pedido nada: ausente y null valen lo mismo que false', () => {
    expect(isBlockedForNewsletter({ userId: 'u1' })).toBe(false)
    expect(isBlockedForNewsletter({ userId: 'u1', unsubscribedAll: null, emailNewsletterDisabled: null })).toBe(false)
    expect(isBlockedForNewsletter({ userId: 'u1', unsubscribedAll: false, emailNewsletterDisabled: false })).toBe(false)
  })

  it('sin fila de preferencias tampoco bloquea (la mayoría de usuarios no tiene una)', () => {
    expect(isBlockedForNewsletter(undefined)).toBe(false)
    expect(isBlockedForNewsletter(null)).toBe(false)
  })
})

describe('blockedUserIds', () => {
  it('recoge las dos causas y descarta al resto', () => {
    const set = blockedUserIds([
      { userId: 'baja', unsubscribedAll: true },
      { userId: 'sin-newsletter', emailNewsletterDisabled: true },
      { userId: 'ambas', unsubscribedAll: true, emailNewsletterDisabled: true },
      { userId: 'normal', unsubscribedAll: false, emailNewsletterDisabled: false },
    ])
    expect([...set].sort()).toEqual(['ambas', 'baja', 'sin-newsletter'])
  })

  it('lista vacía → nadie bloqueado (no puede fallar en abierto al revés)', () => {
    expect(blockedUserIds([]).size).toBe(0)
  })
})

describe('filterEligibleRecipients — el punto de escritura de las dos vías', () => {
  const candidatos = [
    { id: 'a', email: 'a@vence.es' },
    { id: 'baja', email: 'baja@vence.es' },
    { id: 'sin-email', email: null },
    { id: 'b', email: 'b@vence.es' },
  ]

  it('deja fuera al bloqueado aunque venga en la selección manual', () => {
    const r = filterEligibleRecipients(candidatos, new Set(['baja']))
    expect(r.recipients.map(u => u.id)).toEqual(['a', 'b'])
  })

  it('CUENTA lo que descarta, y distingue la causa', () => {
    // Un envío del que desaparecen destinatarios en silencio es indistinguible de
    // uno que salió entero: por eso el motivo se separa y se devuelve.
    const r = filterEligibleRecipients(candidatos, new Set(['baja']))
    expect(r.skippedBlocked).toBe(1)
    expect(r.skippedNoEmail).toBe(1)
  })

  it('un id bloqueado que no está entre los candidatos no descuadra el recuento', () => {
    const r = filterEligibleRecipients(candidatos, new Set(['baja', 'alguien-que-no-viene']))
    expect(r.recipients).toHaveLength(2)
    expect(r.skippedBlocked).toBe(1)
  })

  it('sin bloqueados, solo se cae quien no tiene email', () => {
    const r = filterEligibleRecipients(candidatos, new Set())
    expect(r.recipients.map(u => u.id)).toEqual(['a', 'baja', 'b'])
    expect(r.skippedBlocked).toBe(0)
    expect(r.skippedNoEmail).toBe(1)
  })

  it('conserva los campos del candidato (el envío personaliza con ellos)', () => {
    const r = filterEligibleRecipients(
      [{ id: 'a', email: 'a@vence.es', fullName: 'Ana Pérez', targetOposicion: 'auxiliar_administrativo_estado' }],
      new Set()
    )
    expect(r.recipients[0]).toMatchObject({ fullName: 'Ana Pérez', targetOposicion: 'auxiliar_administrativo_estado' })
  })

  it('selección vacía → envío vacío, sin excepción', () => {
    const r = filterEligibleRecipients([], new Set(['baja']))
    expect(r.recipients).toEqual([])
    expect(r.skippedBlocked).toBe(0)
  })
})
