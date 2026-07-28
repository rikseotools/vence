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
    mockGetReadDb.mockReturnValue(dbWith([{ plan_type: 'premium', source: 'user' }]))
    const r = await maybeRewardResolvedDispute({ disputeId: 'd2', userId: 'u1', status: 'resolved', questionType: 'legislative' })
    expect(r.granted).toBe(true)
    expect(r.amount).toBe(1)
  })

  it('no lanza aunque el sink explote DENTRO del manejador de errores (el fallo original)', async () => {
    mockGetReadDb.mockReturnValue(dbWith([{ plan_type: 'premium', source: 'user' }]))
    mockCreate.mockRejectedValue(new Error('insert falló'))
    await expect(
      maybeRewardResolvedDispute({ disputeId: 'd3', userId: 'u1', status: 'resolved', questionType: 'legislative' })
    ).resolves.toEqual({ granted: false, reason: 'error' })
  })

  it('no lanza cuando se topa el límite mensual (emite y sigue)', async () => {
    mockGetReadDb.mockReturnValue(dbWith([{ plan_type: 'premium', source: 'user' }]))
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
    mockGetReadDb.mockReturnValue(dbWith([{ plan_type: 'free', source: 'user' }]))
    const r = await maybeRewardResolvedDispute({ disputeId: 'd6', userId: 'u1', status: 'resolved', questionType: 'legislative' })
    expect(r).toEqual({ granted: false, reason: 'not_premium' })
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('re-resolver la misma impugnación no paga dos veces', async () => {
    mockGetReadDb.mockReturnValue(dbWith([{ plan_type: 'premium', source: 'user' }]))
    mockCreate.mockResolvedValue({ ok: false, reason: 'duplicate' })
    const r = await maybeRewardResolvedDispute({ disputeId: 'd7', userId: 'u1', status: 'resolved', questionType: 'legislative' })
    expect(r).toEqual({ granted: false, reason: 'duplicate' })
  })
})
