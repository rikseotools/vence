/**
 * `maybeRewardResolvedDispute` NUNCA puede lanzar.
 *
 * Nace de un fallo real (28/07): la primera versión emitía el evento de error directamente desde el
 * `catch`, y con el sink de observabilidad no disponible el propio manejador de errores lanzó. El
 * error subió hasta `resolveDispute` y convirtió "no se pudo conceder 1 €" en "no se pudo resolver la
 * impugnación" — 15 tests en rojo. Arreglar solo el mock del test habría escondido el defecto: el
 * código tenía que dejar de ser frágil, y esto lo fija.
 *
 * La regla: el usuario prefiere que su impugnación se resuelva sin 1 € a que no se resuelva.
 */

const mockCreate = jest.fn()
jest.mock('@/lib/referrals/queries', () => ({
  __esModule: true,
  createRewardSubmission: (...args: unknown[]) => mockCreate(...args),
}))

// Sink de observabilidad ROTO a propósito: cualquier emisión revienta.
jest.mock('@/lib/referrals/observability', () => ({
  __esModule: true,
  emitReferralEvent: () => { throw new Error('sink caído') },
}))

const mockGetReadDb = jest.fn()
jest.mock('@/db/client', () => ({
  __esModule: true,
  getReadDb: () => mockGetReadDb(),
}))

import { maybeRewardResolvedDispute } from '@/lib/referrals/disputeReward'

const dbWith = (rows: unknown[]) => ({ execute: jest.fn().mockResolvedValue({ rows }) })

describe('maybeRewardResolvedDispute — a prueba de fallos', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockCreate.mockResolvedValue({ ok: true, id: 'rs-1' })
  })

  it('no lanza aunque la BD explote — devuelve error controlado', async () => {
    mockGetReadDb.mockImplementation(() => { throw new Error('BD caída') })
    await expect(
      maybeRewardResolvedDispute({ disputeId: 'd1', userId: 'u1', status: 'resolved', questionType: 'legislative' })
    ).resolves.toEqual({ granted: false, reason: 'error' })
  })

  it('no lanza aunque el SINK DE EVENTOS explote en la ruta de éxito', async () => {
    mockGetReadDb.mockReturnValue(dbWith([{ plan_type: 'premium', source: 'user', dispute_type: 'respuesta_incorrecta' }]))
    const r = await maybeRewardResolvedDispute({ disputeId: 'd2', userId: 'u1', status: 'resolved', questionType: 'legislative' })
    expect(r.granted).toBe(true)
    expect(r.amount).toBe(1)
  })

  it('no lanza aunque el sink explote DENTRO del manejador de errores (el fallo original)', async () => {
    mockGetReadDb.mockReturnValue(dbWith([{ plan_type: 'premium', source: 'user', dispute_type: 'respuesta_incorrecta' }]))
    mockCreate.mockRejectedValue(new Error('insert falló'))
    await expect(
      maybeRewardResolvedDispute({ disputeId: 'd3', userId: 'u1', status: 'resolved', questionType: 'legislative' })
    ).resolves.toEqual({ granted: false, reason: 'error' })
  })

  it('no lanza cuando se topa el límite mensual (emite y sigue)', async () => {
    mockGetReadDb.mockReturnValue(dbWith([{ plan_type: 'premium', source: 'user', dispute_type: 'respuesta_incorrecta' }]))
    mockCreate.mockResolvedValue({ ok: false, reason: 'monthly_cap' })
    await expect(
      maybeRewardResolvedDispute({ disputeId: 'd4', userId: 'u1', status: 'resolved', questionType: 'legislative' })
    ).resolves.toEqual({ granted: false, reason: 'monthly_cap' })
  })

  it('ni siquiera consulta la BD si la impugnación se desestima', async () => {
    const r = await maybeRewardResolvedDispute({ disputeId: 'd5', userId: 'u1', status: 'rejected', questionType: 'legislative' })
    expect(r).toEqual({ granted: false, reason: 'not_resolved' })
    expect(mockGetReadDb).not.toHaveBeenCalled()
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('un free NO cobra, y no se intenta crear nada', async () => {
    mockGetReadDb.mockReturnValue(dbWith([{ plan_type: 'free', source: 'user', dispute_type: 'respuesta_incorrecta' }]))
    const r = await maybeRewardResolvedDispute({ disputeId: 'd6', userId: 'u1', status: 'resolved', questionType: 'legislative' })
    expect(r).toEqual({ granted: false, reason: 'not_premium' })
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('un motivo de valoración personal NO paga, aunque sea premium y aceptada', async () => {
    // El 61 % de lo aceptado caía aquí (medido a 90 días el 28/07). Que NO se llame a `createRewardSubmission`
    // es lo importante: sin fila no hay saldo, no hay tope consumido y no hay nada que revertir.
    mockGetReadDb.mockReturnValue(dbWith([{ plan_type: 'premium', source: 'user', dispute_type: 'explicacion_confusa' }]))
    const r = await maybeRewardResolvedDispute({ disputeId: 'd8', userId: 'u1', status: 'resolved', questionType: 'legislative' })
    expect(r).toEqual({ granted: false, reason: 'not_rewardable_type' })
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('un motivo desconocido en BD tampoco paga (el dinero falla cerrado)', async () => {
    mockGetReadDb.mockReturnValue(dbWith([{ plan_type: 'premium', source: 'user', dispute_type: 'motivo_inventado' }]))
    const r = await maybeRewardResolvedDispute({ disputeId: 'd9', userId: 'u1', status: 'resolved', questionType: 'legislative' })
    expect(r).toEqual({ granted: false, reason: 'not_rewardable_type' })
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('re-resolver la misma impugnación no paga dos veces', async () => {
    mockGetReadDb.mockReturnValue(dbWith([{ plan_type: 'premium', source: 'user', dispute_type: 'respuesta_incorrecta' }]))
    mockCreate.mockResolvedValue({ ok: false, reason: 'duplicate' })
    const r = await maybeRewardResolvedDispute({ disputeId: 'd7', userId: 'u1', status: 'resolved', questionType: 'legislative' })
    expect(r).toEqual({ granted: false, reason: 'duplicate' })
  })
})
