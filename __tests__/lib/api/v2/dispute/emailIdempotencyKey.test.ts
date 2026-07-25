// __tests__/lib/api/v2/dispute/emailIdempotencyKey.test.ts
// Tests puros de buildDisputeEmailIdempotencyKey (T-116).
//
// La clave tiene que cumplir DOS propiedades opuestas a la vez:
//   1. mismo contenido → MISMA clave (un reintento no duplica el email)
//   2. contenido distinto → clave DISTINTA (una corrección o la respuesta a
//      una alegación `appealed` sí sale, en vez de que Resend la rechace con
//      "idempotency key has been used… but the request body was modified")
//
// La clave vieja (`dispute-resolve-${disputeId}`, fija por impugnación) solo
// cumplía la 1 → el email corregido se perdía en silencio (caso Sara 25/07).

import { buildDisputeEmailIdempotencyKey } from '@/lib/api/v2/dispute/idempotency'

const DISPUTE_A = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa'
const DISPUTE_B = 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb'
const RESPUESTA = 'Hemos revisado la pregunta y la clave es correcta segun el art. 103 CE.'

describe('buildDisputeEmailIdempotencyKey - propiedad 1: el reintento NO duplica', () => {
  it('es determinista: mismas entradas → misma clave', () => {
    expect(buildDisputeEmailIdempotencyKey(DISPUTE_A, 'resolved', RESPUESTA)).toBe(
      buildDisputeEmailIdempotencyKey(DISPUTE_A, 'resolved', RESPUESTA)
    )
  })

  it('no depende del reloj (dos llamadas separadas en el tiempo coinciden)', async () => {
    const k1 = buildDisputeEmailIdempotencyKey(DISPUTE_A, 'resolved', RESPUESTA)
    await new Promise((r) => setTimeout(r, 5))
    expect(buildDisputeEmailIdempotencyKey(DISPUTE_A, 'resolved', RESPUESTA)).toBe(k1)
  })
})

describe('buildDisputeEmailIdempotencyKey - propiedad 2: el cambio de cuerpo SÍ manda', () => {
  it('una respuesta corregida genera una clave distinta (el bug de T-116)', () => {
    const original = buildDisputeEmailIdempotencyKey(DISPUTE_A, 'resolved', RESPUESTA)
    const corregida = buildDisputeEmailIdempotencyKey(
      DISPUTE_A,
      'resolved',
      'Rectificamos: la clave correcta es la B, no la C. Disculpa el error.'
    )
    expect(corregida).not.toBe(original)
  })

  it('cambiar solo el veredicto (mismo texto) genera clave distinta', () => {
    expect(buildDisputeEmailIdempotencyKey(DISPUTE_A, 'rejected', RESPUESTA)).not.toBe(
      buildDisputeEmailIdempotencyKey(DISPUTE_A, 'resolved', RESPUESTA)
    )
  })

  it('detecta cambios minimos (un caracter) en la respuesta', () => {
    expect(buildDisputeEmailIdempotencyKey(DISPUTE_A, 'resolved', RESPUESTA + '.')).not.toBe(
      buildDisputeEmailIdempotencyKey(DISPUTE_A, 'resolved', RESPUESTA)
    )
  })
})

describe('buildDisputeEmailIdempotencyKey - aislamiento y forma', () => {
  it('dos impugnaciones distintas con la MISMA respuesta no comparten clave', () => {
    expect(buildDisputeEmailIdempotencyKey(DISPUTE_A, 'resolved', RESPUESTA)).not.toBe(
      buildDisputeEmailIdempotencyKey(DISPUTE_B, 'resolved', RESPUESTA)
    )
  })

  it('el separador NUL evita colisiones entre (status, respuesta) reagrupados', () => {
    // Sin separador, 'a' + 'bc' y 'ab' + 'c' hashearian lo mismo.
    expect(buildDisputeEmailIdempotencyKey(DISPUTE_A, 'a', 'bc')).not.toBe(
      buildDisputeEmailIdempotencyKey(DISPUTE_A, 'ab', 'c')
    )
  })

  it('conserva el prefijo y el disputeId legibles (rastreable en logs de Resend)', () => {
    const key = buildDisputeEmailIdempotencyKey(DISPUTE_A, 'resolved', RESPUESTA)
    expect(key.startsWith(`dispute-resolve-${DISPUTE_A}-`)).toBe(true)
  })

  it('cabe en el limite de 256 chars del schema aunque la respuesta sea enorme', () => {
    const key = buildDisputeEmailIdempotencyKey(DISPUTE_A, 'resolved', 'x'.repeat(50_000))
    expect(key.length).toBeLessThanOrEqual(256)
    // Prefijo (16) + uuid (36) + '-' + 12 hex = 65
    expect(key.length).toBe(65)
  })

  it('acepta respuesta vacia sin romper (aunque el caller no llegue a enviar)', () => {
    expect(() => buildDisputeEmailIdempotencyKey(DISPUTE_A, 'resolved', '')).not.toThrow()
  })
})
