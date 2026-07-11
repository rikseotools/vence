/**
 * @jest-environment node
 */
// __tests__/referrals/active-signup.test.ts — CAPA unit del bonus de REGISTRO ACTIVO (dinero).
// Verifica el control de flujo seguro: flag OFF no concede nada; con flag, respeta el presupuesto
// global y devuelve el nº concedido según lo que devuelva el UPDATE.

jest.mock('@/db/client', () => ({ getAdminDb: jest.fn() }))
import { getAdminDb } from '@/db/client'
import { grantActiveSignupRewards } from '@/lib/referrals/activeSignup'

const mDb = getAdminDb as unknown as jest.Mock

afterEach(() => { jest.clearAllMocks(); delete process.env.ACTIVE_SIGNUP_REWARD })

describe('grantActiveSignupRewards', () => {
  it('flag OFF → disabled, 0 y NO toca la BD (deploy seguro)', async () => {
    delete process.env.ACTIVE_SIGNUP_REWARD
    const r = await grantActiveSignupRewards()
    expect(r).toMatchObject({ enabled: false, granted: 0 })
    expect(mDb).not.toHaveBeenCalled()
  })

  it('flag ON → concede los elegibles (el UPDATE devuelve 3 filas → granted 3)', async () => {
    process.env.ACTIVE_SIGNUP_REWARD = '1'
    const execute = jest.fn()
      .mockResolvedValueOnce([{ spent: 0 }]) // presupuesto gastado
      .mockResolvedValueOnce([{ id: 'a' }, { id: 'b' }, { id: 'c' }]) // UPDATE ... RETURNING
    mDb.mockReturnValue({ execute })
    const r = await grantActiveSignupRewards()
    expect(r).toMatchObject({ enabled: true, granted: 3, amount: 2 })
  })

  it('flag ON pero presupuesto global agotado → 0 sin llegar al UPDATE', async () => {
    process.env.ACTIVE_SIGNUP_REWARD = '1'
    const execute = jest.fn().mockResolvedValueOnce([{ spent: 500 }]) // = presupuesto por defecto
    mDb.mockReturnValue({ execute })
    const r = await grantActiveSignupRewards()
    expect(r).toMatchObject({ granted: 0, note: 'budget_reached' })
    expect(execute).toHaveBeenCalledTimes(1) // no ejecuta el UPDATE
  })
})
