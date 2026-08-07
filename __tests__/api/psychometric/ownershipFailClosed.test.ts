/**
 * [T-565, hallazgo de revisión 07/08] Cobertura equivalente a la de
 * `__tests__/api/exam/resumeRoute.test.ts` para las tres rutas `psychometric/*` que
 * dependen de `getSessionOwnerId` (resume, complete, discard). El fix vive en la
 * función compartida (ver `__tests__/lib/api/ownerQueriesFailClosed.test.ts`: si la
 * consulta LANZA, ya no se traga el error como `null`), pero eso no demuestra que CADA
 * ruta se comporte bien — solo que la pieza de la que dependen ya no miente. Aquí se
 * fija, ruta por ruta, que un rechazo de `getSessionOwnerId` responde 500 y NUNCA
 * llega a `requireDuenoDelRecurso` (que leería el `null` que ya no existe) ni a la
 * acción real (leer/completar/descartar la sesión de quien sea).
 */

jest.mock('@/lib/api/psychometric-session', () => {
  const real = jest.requireActual('@/lib/api/psychometric-session')
  return {
    ...real,
    getSessionOwnerId: jest.fn(),
    getResumedPsychometricSessionData: jest.fn(),
    completePsychometricSession: jest.fn(),
    discardPsychometricSession: jest.fn(),
  }
})

jest.mock('@/lib/api/shared/auth', () => ({
  requireDuenoDelRecurso: jest.fn(),
}))

jest.mock('next/server', () => {
  class MockHeaders {
    private _headers: Record<string, string> = {}
    get() { return null }
  }
  class MockNextRequest {
    url: string
    method: string
    headers = new MockHeaders()
    private _body: unknown
    constructor(url: string, init?: { method?: string; body?: unknown }) {
      this.url = url
      this.method = init?.method || 'GET'
      this._body = init?.body
    }
    async json() { return this._body }
  }
  class MockNextResponse {
    private _body: string
    status: number
    constructor(body: string, init?: { status?: number }) {
      this._body = body
      this.status = init?.status || 200
    }
    async json() { return JSON.parse(this._body) }
    static json(data: unknown, init?: { status?: number }) {
      return new MockNextResponse(JSON.stringify(data), init)
    }
  }
  return { NextRequest: MockNextRequest, NextResponse: MockNextResponse, after: jest.fn() }
})

import type { NextRequest } from 'next/server'
import {
  getSessionOwnerId,
  getResumedPsychometricSessionData,
  completePsychometricSession,
  discardPsychometricSession,
} from '@/lib/api/psychometric-session'
import { requireDuenoDelRecurso } from '@/lib/api/shared/auth'
import { GET as resumeGET } from '@/app/api/psychometric/resume/route'
import { POST as completePOST } from '@/app/api/psychometric/complete/route'
import { POST as discardPOST } from '@/app/api/psychometric/discard/route'

const SESSION_ID = '11111111-1111-4111-8111-111111111111'
const USER_ID = '22222222-2222-4222-8222-222222222222'

function getReq(sessionId: string): NextRequest {
  const { NextRequest: MockNextRequest } = jest.requireMock('next/server')
  return new MockNextRequest(`http://localhost/x?sessionId=${sessionId}`) as unknown as NextRequest
}

function postReq(body: unknown): NextRequest {
  const { NextRequest: MockNextRequest } = jest.requireMock('next/server')
  return new MockNextRequest('http://localhost/x', { method: 'POST', body }) as unknown as NextRequest
}

beforeEach(() => {
  jest.clearAllMocks()
})

describe('psychometric/* — si getSessionOwnerId LANZA, 500 y nunca llega a leer/tocar la sesión', () => {
  it('GET /api/psychometric/resume', async () => {
    ;(getSessionOwnerId as jest.Mock).mockRejectedValue(new Error('connection reset'))

    const res = await resumeGET(getReq(SESSION_ID))
    const data = await res.json()

    expect(res.status).toBe(500)
    expect(data.success).toBe(false)
    expect(requireDuenoDelRecurso).not.toHaveBeenCalled()
    expect(getResumedPsychometricSessionData).not.toHaveBeenCalled()
  })

  it('POST /api/psychometric/complete', async () => {
    ;(getSessionOwnerId as jest.Mock).mockRejectedValue(new Error('connection reset'))

    const res = await completePOST(postReq({
      sessionId: SESSION_ID, userId: USER_ID, correctAnswers: 3, totalQuestions: 5,
    }))
    const data = await res.json()

    expect(res.status).toBe(500)
    expect(data.success).toBe(false)
    expect(requireDuenoDelRecurso).not.toHaveBeenCalled()
    expect(completePsychometricSession).not.toHaveBeenCalled()
  })

  it('POST /api/psychometric/discard', async () => {
    ;(getSessionOwnerId as jest.Mock).mockRejectedValue(new Error('connection reset'))

    const res = await discardPOST(postReq({ sessionId: SESSION_ID, userId: USER_ID }))
    const data = await res.json()

    expect(res.status).toBe(500)
    expect(data.success).toBe(false)
    expect(requireDuenoDelRecurso).not.toHaveBeenCalled()
    expect(discardPsychometricSession).not.toHaveBeenCalled()
  })
})

describe('psychometric/* — control: dueño real sigue funcionando (el mock no rompe el camino feliz)', () => {
  it('GET /api/psychometric/resume con dueño válido continúa al normal', async () => {
    ;(getSessionOwnerId as jest.Mock).mockResolvedValue(USER_ID)
    ;(requireDuenoDelRecurso as jest.Mock).mockResolvedValue({ ok: true, callerUserId: USER_ID })
    ;(getResumedPsychometricSessionData as jest.Mock).mockResolvedValue({ success: true, sessionId: SESSION_ID })

    const res = await resumeGET(getReq(SESSION_ID))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.success).toBe(true)
    expect(getResumedPsychometricSessionData).toHaveBeenCalledWith(SESSION_ID, USER_ID)
  })
})
