/** @jest-environment node */
// Tests de los endpoints que reemplazan los .from de hooks/useDisputeNotifications.ts (C1):
//   GET  /api/v2/disputes/notifications  (normales con embed + psicotécnicas)
//   POST /api/v2/disputes/mark-all-read  (2 UPDATE)
//   POST /api/v2/disputes/appeal         (UPDATE solo si propia + rejected)
// Seguridad (sustituye RLS): user_id SIEMPRE del token; appeal exige status='rejected'.

import { NextRequest } from 'next/server'

const mockVerifyAuth = jest.fn()
const mockExecute = jest.fn()

jest.mock('@/lib/api/auth/verifyAuth', () => ({
  verifyAuth: (...a: unknown[]) => mockVerifyAuth(...a),
}))
jest.mock('@/db/client', () => ({
  getAdminDb: () => ({ execute: mockExecute }),
}))
jest.mock('@/lib/api/withErrorLogging', () => ({
  withErrorLogging: (_p: string, h: unknown) => h,
}))

import { GET as NOTIFS } from '@/app/api/v2/disputes/notifications/route'
import { POST as MARK_ALL } from '@/app/api/v2/disputes/mark-all-read/route'
import { POST as APPEAL } from '@/app/api/v2/disputes/appeal/route'

function reqUrl() {
  return { headers: { get: () => null }, url: 'https://x' } as unknown as NextRequest
}
function reqBody(body: unknown) {
  return { headers: { get: () => null }, url: 'https://x', json: async () => body } as unknown as NextRequest
}
const QID = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'

beforeEach(() => {
  jest.clearAllMocks()
  mockExecute.mockResolvedValue({ rows: [] })
})

describe('GET /api/v2/disputes/notifications', () => {
  test('401 sin auth', async () => {
    mockVerifyAuth.mockResolvedValue({ success: false, status: 401 })
    expect((await NOTIFS(reqUrl())).status).toBe(401)
    expect(mockExecute).not.toHaveBeenCalled()
  })

  test('200 devuelve disputes + psychoDisputes', async () => {
    mockVerifyAuth.mockResolvedValue({ success: true, userId: 'U_TOKEN', email: 'a@b.c' })
    mockExecute
      .mockResolvedValueOnce({ rows: [{ id: 'd1', questions: { articles: { laws: { short_name: 'CE' } } } }] })
      .mockResolvedValueOnce({ rows: [{ id: 'p1' }] })
    const res = await NOTIFS(reqUrl())
    expect(res.status).toBe(200)
    const j = await res.json()
    expect(j.disputes).toHaveLength(1)
    expect(j.psychoDisputes).toHaveLength(1)
  })

  test('AISLAMIENTO: ambas queries filtran por el userId del TOKEN', async () => {
    mockVerifyAuth.mockResolvedValue({ success: true, userId: 'U_TOKEN', email: 'a@b.c' })
    await NOTIFS(reqUrl())
    expect(JSON.stringify(mockExecute.mock.calls[0][0])).toContain('U_TOKEN')
    expect(JSON.stringify(mockExecute.mock.calls[1][0])).toContain('U_TOKEN')
  })
})

describe('POST /api/v2/disputes/mark-all-read', () => {
  test('401 sin auth', async () => {
    mockVerifyAuth.mockResolvedValue({ success: false, status: 401 })
    expect((await MARK_ALL(reqUrl())).status).toBe(401)
  })

  test('200 ejecuta 2 UPDATE con el userId del TOKEN', async () => {
    mockVerifyAuth.mockResolvedValue({ success: true, userId: 'U_TOKEN', email: 'a@b.c' })
    const res = await MARK_ALL(reqUrl())
    expect(res.status).toBe(200)
    expect(mockExecute).toHaveBeenCalledTimes(2)
    expect(JSON.stringify(mockExecute.mock.calls[0][0])).toContain('U_TOKEN')
    expect(JSON.stringify(mockExecute.mock.calls[1][0])).toContain('U_TOKEN')
  })
})

describe('POST /api/v2/disputes/appeal', () => {
  test('401 sin auth', async () => {
    mockVerifyAuth.mockResolvedValue({ success: false, status: 401 })
    expect((await APPEAL(reqBody({ disputeId: QID, appealText: 'x' }))).status).toBe(401)
  })

  test('400 si payload inválido', async () => {
    mockVerifyAuth.mockResolvedValue({ success: true, userId: 'U_TOKEN', email: 'a@b.c' })
    expect((await APPEAL(reqBody({ disputeId: 'no-uuid', appealText: 'x' }))).status).toBe(400)
    expect((await APPEAL(reqBody({ disputeId: QID, appealText: '' }))).status).toBe(400)
  })

  test('updated=true si actualizó una fila', async () => {
    mockVerifyAuth.mockResolvedValue({ success: true, userId: 'U_TOKEN', email: 'a@b.c' })
    mockExecute.mockResolvedValue({ rows: [{ id: QID }] })
    expect(await (await APPEAL(reqBody({ disputeId: QID, appealText: 'mi alegación' }))).json())
      .toEqual({ success: true, updated: true })
  })

  test('updated=false si no había fila propia+rejected', async () => {
    mockVerifyAuth.mockResolvedValue({ success: true, userId: 'U_TOKEN', email: 'a@b.c' })
    mockExecute.mockResolvedValue({ rows: [] })
    expect(await (await APPEAL(reqBody({ disputeId: QID, appealText: 'x' }))).json())
      .toEqual({ success: false, updated: false })
  })

  test('AISLAMIENTO: el UPDATE usa userId del TOKEN + status rejected', async () => {
    mockVerifyAuth.mockResolvedValue({ success: true, userId: 'U_TOKEN', email: 'a@b.c' })
    mockExecute.mockResolvedValue({ rows: [{ id: QID }] })
    await APPEAL(reqBody({ disputeId: QID, appealText: 'x' }))
    const s = JSON.stringify(mockExecute.mock.calls[0][0])
    expect(s).toContain('U_TOKEN')
    expect(s).toContain('rejected')
  })
})
