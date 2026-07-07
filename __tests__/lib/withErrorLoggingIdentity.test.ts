// __tests__/lib/withErrorLoggingIdentity.test.ts
// Atribución de identidad en logs/observabilidad (fix incidente 07/07/2026).
// La columna user_id debe reflejar la identidad VERIFICADA del token, no el
// `body.userId` que el cliente reclama — que la cola offline replay envenenaba
// haciendo que 403 de límite parecieran de cuentas premium nunca bloqueadas.
import { buildLogIdentity, type LogIdentity } from '@/lib/api/withErrorLogging'

const PREMIUM = '8ec9fbe3-e48a-4d58-85f0-8b6de991027f'
const FREE = '11111111-2222-3333-4444-555555555555'

describe('buildLogIdentity', () => {
  it('token verificado gana a lo que reclama el cliente (actor real)', () => {
    // Caso dual-account / account-switch: el body dice premium, el token es free.
    const id = buildLogIdentity(FREE, PREMIUM)
    expect(id.userId).toBe(FREE) // se atribuye al ACTOR real, no al reclamado
    expect(id.userIdVerified).toBe(true)
    expect(id.identityMismatch).toBe(true)
    expect(id.claimedUserId).toBe(PREMIUM)
  })

  it('token verificado == claimed → sin mismatch, verificado', () => {
    const id = buildLogIdentity(PREMIUM, PREMIUM)
    expect(id.userId).toBe(PREMIUM)
    expect(id.userIdVerified).toBe(true)
    expect(id.identityMismatch).toBe(false)
  })

  it('sin token válido (cola replay caducada) → cae al claimed pero NO verificado', () => {
    // No perdemos la traza, pero queda marcado para poder filtrarlo en alertas.
    const id = buildLogIdentity(null, PREMIUM)
    expect(id.userId).toBe(PREMIUM)
    expect(id.userIdVerified).toBe(false)
    expect(id.identityMismatch).toBe(false) // sin verificado no hay "mismatch"
  })

  it('sin token y sin claimed → anónimo', () => {
    const id = buildLogIdentity(null, undefined)
    expect(id.userId).toBeUndefined()
    expect(id.userIdVerified).toBe(false)
    expect(id.identityMismatch).toBe(false)
  })

  it('token verificado sin claimed → verificado, sin mismatch', () => {
    const id = buildLogIdentity(PREMIUM, null)
    expect(id.userId).toBe(PREMIUM)
    expect(id.userIdVerified).toBe(true)
    expect(id.identityMismatch).toBe(false)
    expect(id.claimedUserId).toBeUndefined()
  })

  it('strings vacíos se tratan como ausentes (no ensucian la columna)', () => {
    const id = buildLogIdentity('', '')
    expect(id.userId).toBeUndefined()
    expect(id.userIdVerified).toBe(false)
    expect(id.identityMismatch).toBe(false)
  })

  it('un alert-rule fiable: solo 403 con userIdVerified=true son actor real', () => {
    // Simula los dos flujos que hoy se confundían en el mismo bucket.
    const realActorHitLimit: LogIdentity = buildLogIdentity(FREE, FREE) // free real gastó su cupo
    const queueReplayNoise: LogIdentity = buildLogIdentity(null, PREMIUM) // replay caducado
    const alertable = [realActorHitLimit, queueReplayNoise].filter(i => i.userIdVerified)
    expect(alertable).toHaveLength(1)
    expect(alertable[0].userId).toBe(FREE)
  })
})
