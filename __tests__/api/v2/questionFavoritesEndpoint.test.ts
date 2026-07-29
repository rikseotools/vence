/** @jest-environment node */
// __tests__/api/v2/questionFavoritesEndpoint.test.ts
//
// INTEGRACIÓN de /api/v2/question-favorites (T-261).
// Fija el contrato de SEGURIDAD (el usuario sale del token, no del body) y el de
// idempotencia que espera el cliente al pulsar el corazón dos veces.
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'mock-anon-key'

const mockSetFavorite = jest.fn()
const mockListFavoriteIds = jest.fn()
const mockVerifyAuth = jest.fn()
const mockEmit = jest.fn()

jest.mock('@/lib/api/question-favorites', () => {
  const real = jest.requireActual('@/lib/api/question-favorites/schemas')
  return {
    // Los CONTRATOS son los de verdad: mockearlos ocultaría la validación.
    safeParseToggleFavorite: real.safeParseToggleFavorite,
    setFavorite: (...a: unknown[]) => mockSetFavorite(...a),
    listFavoriteIds: (...a: unknown[]) => mockListFavoriteIds(...a),
  }
})

jest.mock('@/lib/api/auth/verifyAuth', () => ({
  verifyAuth: (...a: unknown[]) => mockVerifyAuth(...a),
}))

jest.mock('@/lib/observability/emit', () => ({
  emitFireAndForget: (...a: unknown[]) => mockEmit(...a),
}))

import { NextRequest } from 'next/server'

const QUESTION_ID = '3bdd3565-1111-4222-8333-444444444444'
const USER_ID = '79b8c727-0ed8-433c-8b64-a39e7d2b406e'

function req(method: 'GET' | 'POST' | 'DELETE', body?: unknown): NextRequest {
  return new NextRequest('https://www.vence.es/api/v2/question-favorites', {
    method,
    headers: { 'Content-Type': 'application/json', authorization: 'Bearer tok' },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  })
}

describe('/api/v2/question-favorites', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockVerifyAuth.mockResolvedValue({ success: true, userId: USER_ID, email: 'u@test.es' })
    mockSetFavorite.mockResolvedValue({ isFavorite: true, total: 1 })
    mockListFavoriteIds.mockResolvedValue([QUESTION_ID])
  })

  it('sin sesión NO deja marcar (401)', async () => {
    mockVerifyAuth.mockResolvedValue({ success: false, status: 401, reason: 'no_bearer_token' })
    const { POST } = await import('@/app/api/v2/question-favorites/route')

    const res = await POST(req('POST', { questionId: QUESTION_ID }))

    expect(res.status).toBe(401)
    expect(mockSetFavorite).not.toHaveBeenCalled()
  })

  it('marca la pregunta para el usuario DEL TOKEN, ignorando el userId del body', async () => {
    const { POST } = await import('@/app/api/v2/question-favorites/route')

    const res = await POST(req('POST', { questionId: QUESTION_ID, userId: 'usuario-ajeno' }))

    expect(res.status).toBe(200)
    expect(mockSetFavorite).toHaveBeenCalledWith(USER_ID, QUESTION_ID, true, {
      positionType: null,
      topicNumber: null,
    })
  })

  it('desmarca con DELETE', async () => {
    mockSetFavorite.mockResolvedValue({ isFavorite: false, total: 0 })
    const { DELETE } = await import('@/app/api/v2/question-favorites/route')

    const res = await DELETE(req('DELETE', { questionId: QUESTION_ID }))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(mockSetFavorite).toHaveBeenCalledWith(USER_ID, QUESTION_ID, false, {
      positionType: null,
      topicNumber: null,
    })
    expect(json.isFavorite).toBe(false)
  })

  it('rechaza un questionId inválido sin tocar la BD (400)', async () => {
    const { POST } = await import('@/app/api/v2/question-favorites/route')

    const res = await POST(req('POST', { questionId: 'no-es-uuid' }))

    expect(res.status).toBe(400)
    expect(mockSetFavorite).not.toHaveBeenCalled()
  })

  it('body ausente o ilegible → 400, no 500', async () => {
    const { POST } = await import('@/app/api/v2/question-favorites/route')

    const res = await POST(req('POST'))

    expect(res.status).toBe(400)
    expect(mockSetFavorite).not.toHaveBeenCalled()
  })

  it('emite evento de observabilidad al marcar (para saber si la función se usa)', async () => {
    const { POST } = await import('@/app/api/v2/question-favorites/route')

    await POST(req('POST', { questionId: QUESTION_ID }))

    expect(mockEmit).toHaveBeenCalledTimes(1)
    expect(mockEmit.mock.calls[0][0]).toMatchObject({
      eventType: 'question_favorite_toggled',
      userId: USER_ID,
      metadata: expect.objectContaining({ action: 'add', questionId: QUESTION_ID }),
    })
  })

  it('GET devuelve los ids del usuario del token', async () => {
    const { GET } = await import('@/app/api/v2/question-favorites/route')

    const res = await GET(req('GET'))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(mockListFavoriteIds).toHaveBeenCalledWith(USER_ID)
    expect(json).toMatchObject({ success: true, questionIds: [QUESTION_ID], total: 1 })
  })

  it('guarda el CONTEXTO (oposición y tema) que manda el cliente', async () => {
    // Sin esto no se puede agrupar después: una pregunta vive en temas distintos
    // según la oposición, así que el "dónde la guardé" no es reconstruible.
    const { POST } = await import('@/app/api/v2/question-favorites/route')

    await POST(req('POST', {
      questionId: QUESTION_ID,
      positionType: 'auxiliar_administrativo_madrid',
      topicNumber: 7,
    }))

    expect(mockSetFavorite).toHaveBeenCalledWith(USER_ID, QUESTION_ID, true, {
      positionType: 'auxiliar_administrativo_madrid',
      topicNumber: 7,
    })
  })

  it('rechaza un topicNumber absurdo sin tocar la BD', async () => {
    const { POST } = await import('@/app/api/v2/question-favorites/route')

    const res = await POST(req('POST', { questionId: QUESTION_ID, topicNumber: -3 }))

    expect(res.status).toBe(400)
    expect(mockSetFavorite).not.toHaveBeenCalled()
  })
})
