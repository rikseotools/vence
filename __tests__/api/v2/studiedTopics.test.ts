/** @jest-environment node */
// GET /api/v2/studied-topics — temas completados del PROPIO usuario (fetchMantenerRacha).

import { NextRequest } from 'next/server'

const mockVerifyAuth = jest.fn()
const mockExecute = jest.fn()

jest.mock('@/lib/api/auth/verifyAuth', () => ({ verifyAuth: (...a: unknown[]) => mockVerifyAuth(...a) }))
jest.mock('@/db/client', () => ({ getAdminDb: () => ({ execute: mockExecute }) }))
jest.mock('@/lib/api/withErrorLogging', () => ({ withErrorLogging: (_p: string, h: unknown) => h }))

import { GET } from '@/app/api/v2/studied-topics/route'

function req(url = 'https://x') { return { headers: { get: () => null }, url } as unknown as NextRequest }
const AUTH = { success: true, userId: 'U_TOKEN', email: 'a@b.c' }

beforeEach(() => { jest.clearAllMocks(); mockExecute.mockResolvedValue({ rows: [] }) })

test('401 sin auth', async () => {
  mockVerifyAuth.mockResolvedValue({ success: false, status: 401 })
  expect((await GET(req())).status).toBe(401)
})

test('filtra por user del token + is_completed y devuelve temas numéricos', async () => {
  mockVerifyAuth.mockResolvedValue(AUTH)
  mockExecute.mockResolvedValue({ rows: [{ tema_number: 0 }, { tema_number: 3 }, { tema_number: null }] })
  const j = await (await GET(req())).json()
  expect(j.temas).toEqual([0, 3]) // null descartado
  const s = JSON.stringify(mockExecute.mock.calls[0][0])
  expect(s).toContain('U_TOKEN')
  expect(s).toContain('is_completed')
})
