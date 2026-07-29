/**
 * @jest-environment node
 */
// __tests__/referrals/badge-endpoint.test.ts — CAPA unit del endpoint /api/referrals/badge.
// GET → { unseen, balance } (ambos 0 si no premium). POST → marca visto. Auth y queries mockeados.
// El saldo entró el 29/07: el icono 🎁 pasó a tener TRES estados y necesita el número, no solo el
// contador de novedades. Sin él, el Header no puede distinguir «tienes algo» de «puedes cobrar».

import { NextResponse, NextRequest } from 'next/server'

jest.mock('@/lib/api/shared/auth', () => ({ getAuthenticatedUser: jest.fn() }))
jest.mock('@/lib/referrals/queries', () => ({
  getUserPlanType: jest.fn(),
  getUnseenEarningsCount: jest.fn(),
  markEarningsSeen: jest.fn(),
  getUserOwedBalance: jest.fn(),
}))

import { getAuthenticatedUser } from '@/lib/api/shared/auth'
import { getUserPlanType, getUnseenEarningsCount, markEarningsSeen, getUserOwedBalance } from '@/lib/referrals/queries'
import { _GET, _POST } from '@/app/api/referrals/badge/route'

const mAuth = getAuthenticatedUser as unknown as jest.Mock
const mPlan = getUserPlanType as unknown as jest.Mock
const mUnseen = getUnseenEarningsCount as unknown as jest.Mock
const mSeen = markEarningsSeen as unknown as jest.Mock
const mBalance = getUserOwedBalance as unknown as jest.Mock

const req = (method = 'GET') => new NextRequest('https://www.vence.es/api/referrals/badge', { method })

describe('/api/referrals/badge', () => {
  afterEach(() => jest.clearAllMocks())

  it('sin sesión → 401 del auth (GET)', async () => {
    mAuth.mockResolvedValue({ ok: false, response: NextResponse.json({ error: 'no' }, { status: 401 }) })
    const res = await _GET(req())
    expect(res.status).toBe(401)
    expect(mUnseen).not.toHaveBeenCalled()
  })

  it('GET no premium → unseen:0 sin consultar la BD', async () => {
    mAuth.mockResolvedValue({ ok: true, user: { id: 'u1' } })
    mPlan.mockResolvedValue('free')
    const res = await _GET(req())
    expect(await res.json()).toEqual({ unseen: 0, balance: 0 })
    expect(mUnseen).not.toHaveBeenCalled()
    expect(mBalance).not.toHaveBeenCalled()
  })

  it('GET premium → devuelve el conteo de sin-ver Y el saldo', async () => {
    mAuth.mockResolvedValue({ ok: true, user: { id: 'u1' } })
    mPlan.mockResolvedValue('premium')
    mUnseen.mockResolvedValue(3)
    mBalance.mockResolvedValue(7)
    const res = await _GET(req())
    expect(await res.json()).toEqual({ unseen: 3, balance: 7 })
    expect(mUnseen).toHaveBeenCalledWith('u1')
    expect(mBalance).toHaveBeenCalledWith('u1')
  })

  // El saldo sale de `getUserOwedBalance`, que ya resta holds, pagos emitidos y solicitudes en
  // curso. NO se suma el libro mayor a mano: medido el 29/07, la suma cruda daba 7 usuarios
  // cobrables y el saldo real solo 4 — pintar la cifra con el número inflado prometería vales
  // que no existen.
  it('el saldo es el DISPONIBLE, no el ganado de por vida', async () => {
    mAuth.mockResolvedValue({ ok: true, user: { id: 'u1' } })
    mPlan.mockResolvedValue('premium')
    mUnseen.mockResolvedValue(0)
    mBalance.mockResolvedValue(0)
    expect(await (await _GET(req())).json()).toEqual({ unseen: 0, balance: 0 })
  })

  it('POST → marca visto', async () => {
    mAuth.mockResolvedValue({ ok: true, user: { id: 'u1' } })
    mSeen.mockResolvedValue(undefined)
    const res = await _POST(req('POST'))
    expect(await res.json()).toEqual({ ok: true })
    expect(mSeen).toHaveBeenCalledWith('u1')
  })
})
