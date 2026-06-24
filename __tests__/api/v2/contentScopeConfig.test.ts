/** @jest-environment node */
// Tests de GET /api/v2/content-scope-config (Fase C1, migración de test-personalizado).
// Contenido público (sin auth): sección + scope + IDs de artículos resueltos server-side.

import { NextRequest } from 'next/server'

const mockExecute = jest.fn()

jest.mock('@/db/client', () => ({
  getAdminDb: () => ({ execute: mockExecute }),
}))
jest.mock('@/lib/api/withErrorLogging', () => ({
  withErrorLogging: (_p: string, h: unknown) => h,
}))

import { GET } from '@/app/api/v2/content-scope-config/route'

function req(url: string) {
  return { headers: { get: () => null }, url } as unknown as NextRequest
}

beforeEach(() => {
  jest.clearAllMocks()
  mockExecute.mockResolvedValue({ rows: [] })
})

describe('GET /api/v2/content-scope-config', () => {
  test('400 sin seccion', async () => {
    expect((await GET(req('https://x'))).status).toBe(400)
  })

  test('404 si sección no existe', async () => {
    mockExecute.mockResolvedValueOnce({ rows: [] }) // section
    expect((await GET(req('https://x?seccion=foo'))).status).toBe(404)
  })

  test('resuelve sección + scope + articleIds', async () => {
    mockExecute
      .mockResolvedValueOnce({ rows: [{ id: 'sec1', name: 'Sec' }] })           // section
      .mockResolvedValueOnce({ rows: [{ law_id: 'law1', article_numbers: ['1', '2'] }] }) // scope
      .mockResolvedValueOnce({ rows: [{ id: 'art1' }, { id: 'art2' }] })        // articles
    const res = await GET(req('https://x?seccion=temario'))
    expect(res.status).toBe(200)
    const j = await res.json()
    expect(j.sectionInfo.id).toBe('sec1')
    expect(j.articleIds).toEqual(['art1', 'art2'])
    expect(j.questionsMode).toBe('content_scope')
  })

  test('scope sin article_numbers no rompe', async () => {
    mockExecute
      .mockResolvedValueOnce({ rows: [{ id: 'sec1' }] })
      .mockResolvedValueOnce({ rows: [{ law_id: 'law1', article_numbers: [] }] })
    const j = await (await GET(req('https://x?seccion=t'))).json()
    expect(j.articleIds).toEqual([])
    // No debe consultar articles para un scope vacío (solo section + scope)
    expect(mockExecute).toHaveBeenCalledTimes(2)
  })
})
