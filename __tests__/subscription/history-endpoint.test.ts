/**
 * @jest-environment node
 */
// __tests__/subscription/history-endpoint.test.ts — CAPA unit del endpoint de historial de suscripción.
// Verifica el gate de sesión (401) y, sobre todo, que la identidad se toma del TOKEN y NUNCA del
// `?userId=` del cliente (anti-IDOR): un usuario no puede leer el historial de otro.

import { NextResponse, NextRequest } from 'next/server'

jest.mock('@/lib/api/shared/auth', () => ({ getAuthenticatedUser: jest.fn() }))
jest.mock('@/lib/api/subscription/history', () => ({ getSubscriptionHistory: jest.fn() }))

import { getAuthenticatedUser } from '@/lib/api/shared/auth'
import { getSubscriptionHistory } from '@/lib/api/subscription/history'
import { _GET } from '@/app/api/profile/subscription-history/route'

const mAuth = getAuthenticatedUser as unknown as jest.Mock
const mHist = getSubscriptionHistory as unknown as jest.Mock
const req = (url = 'https://www.vence.es/api/profile/subscription-history') => new NextRequest(url)

describe('GET /api/profile/subscription-history', () => {
  afterEach(() => jest.clearAllMocks())

  it('sin sesión → 401 y no consulta la BD', async () => {
    mAuth.mockResolvedValue({ ok: false, response: NextResponse.json({}, { status: 401 }) })
    const res = await _GET(req())
    expect(res.status).toBe(401)
    expect(mHist).not.toHaveBeenCalled()
  })

  it('con sesión → 200 usando el userId del TOKEN, ignorando ?userId= del cliente (anti-IDOR)', async () => {
    mAuth.mockResolvedValue({ ok: true, user: { id: 'token-user' } })
    mHist.mockResolvedValue({ isPremium: true, current: null, timeline: [{ type: 'became_premium', date: '2026-06-02' }] })
    const res = await _GET(req('https://www.vence.es/api/profile/subscription-history?userId=OTRO-USUARIO'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.timeline).toHaveLength(1)
    expect(mHist).toHaveBeenCalledWith('token-user')
    expect(mHist).not.toHaveBeenCalledWith('OTRO-USUARIO')
  })
})
