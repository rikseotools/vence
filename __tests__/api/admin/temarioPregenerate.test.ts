/**
 * @jest-environment node
 */
// Contrato + guardarraíl del endpoint admin de PRE-GENERACIÓN de PDFs del temario
// (POST /api/admin/temario/pregenerate).
//
// Qué garantiza:
//  - AUTH: sin admin NO se genera nada (defensa: dispara render pesado + escribe S3).
//  - VALIDACIÓN: json inválido / targets ausentes o vacíos / batch descomunal → 4xx, sin tocar el motor.
//  - CONTRATO 202: admin + targets válidos → 202 inmediato y la generación corre EN BACKGROUND
//    (pregenerateTopicPdf se invoca 1 vez por target, tras responder) + evento de cierre de lote.
//  - SANEO: descarta entries malformadas (oposicion no-string, tema no-entero) sin romper.
//
// Mockeamos pregenerate → el test NO arrastra @react-pdf ni pega a S3; verifica el CABLEADO
// del endpoint (auth, validación, fan-out en background, observabilidad), no el render.

// requireAdmin controlable por test.
let mockAdminOk = true
jest.mock('@/lib/api/shared/auth', () => ({
  requireAdmin: jest.fn(async () =>
    mockAdminOk
      ? { ok: true, user: { email: 'admin@vence.es' } }
      : { ok: false, response: require('next/server').NextResponse.json({ error: 'unauthorized' }, { status: 401 }) },
  ),
}))

const mockPregenerate = jest.fn(async (oposicion: string, tema: number) => ({
  oposicion, tema, ok: true, outcome: 'uploaded' as const, bytes: 1234, ms: 5,
}))
jest.mock('@/lib/temario/pdf/pregenerate', () => ({
  pregenerateTopicPdf: (...a: unknown[]) => mockPregenerate(...(a as [string, number])),
}))

const mockEmit = jest.fn()
jest.mock('@/lib/observability/emit', () => ({ emitFireAndForget: (...a: unknown[]) => mockEmit(...a) }))

import { POST } from '@/app/api/admin/temario/pregenerate/route'
import type { NextRequest } from 'next/server'

function call(body: unknown, opts: { badJson?: boolean } = {}) {
  const req = {
    json: async () => {
      if (opts.badJson) throw new Error('json roto')
      return body
    },
  } as unknown as NextRequest
  return POST(req) as Promise<Response>
}

// Deja correr la promise DESACOPLADA del handler (el fan-out en background).
const flush = () => new Promise((r) => setTimeout(r, 25))

describe('POST /api/admin/temario/pregenerate — auth', () => {
  beforeEach(() => { jest.clearAllMocks(); mockAdminOk = true })

  it('sin admin → 401 y NO genera nada', async () => {
    mockAdminOk = false
    const res = await call({ targets: [{ oposicion: 'auxiliar-administrativo-madrid', tema: 19 }] })
    expect(res.status).toBe(401)
    await flush()
    expect(mockPregenerate).not.toHaveBeenCalled()
  })
})

describe('POST /api/admin/temario/pregenerate — validación (sin tocar el motor)', () => {
  beforeEach(() => { jest.clearAllMocks(); mockAdminOk = true })

  it('json inválido → 400', async () => {
    const res = await call(null, { badJson: true })
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('json_invalido')
    await flush()
    expect(mockPregenerate).not.toHaveBeenCalled()
  })

  it('sin targets → 400', async () => {
    const res = await call({})
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('falta targets[]')
  })

  it('targets vacío → 400', async () => {
    const res = await call({ targets: [] })
    expect(res.status).toBe(400)
  })

  it('batch descomunal (>MAX) → 413', async () => {
    const targets = Array.from({ length: 4001 }, (_, i) => ({ oposicion: 'x', tema: i + 1 }))
    const res = await call({ targets })
    expect(res.status).toBe(413)
    expect((await res.json()).error).toBe('demasiados_targets')
    await flush()
    expect(mockPregenerate).not.toHaveBeenCalled()
  })
})

describe('POST /api/admin/temario/pregenerate — 202 + fan-out en background', () => {
  beforeEach(() => { jest.clearAllMocks(); mockAdminOk = true })

  it('admin + targets válidos → 202 inmediato y genera 1 vez por target en background', async () => {
    const res = await call({
      targets: [
        { oposicion: 'auxiliar-administrativo-madrid', tema: 18 },
        { oposicion: 'auxiliar-administrativo-madrid', tema: 19 },
      ],
    })
    expect(res.status).toBe(202)
    const body = await res.json()
    expect(body.accepted).toBe(2)

    // El motor NO se ha tocado todavía cuando ya hemos respondido (es background).
    // Tras dejar correr la promise desacoplada, sí se invoca 1 vez por target.
    await flush()
    expect(mockPregenerate).toHaveBeenCalledTimes(2)
    expect(mockPregenerate).toHaveBeenCalledWith('auxiliar-administrativo-madrid', 18, { force: false })
    expect(mockPregenerate).toHaveBeenCalledWith('auxiliar-administrativo-madrid', 19, { force: false })

    // Evento de cierre de lote con el conteo.
    const batch = mockEmit.mock.calls.find((c) => (c[0] as { eventType: string }).eventType === 'temario_pdf_pregenerate_batch')
    expect(batch).toBeTruthy()
    expect((batch![0] as { metadata: { uploaded: number; total: number } }).metadata).toMatchObject({ total: 2, uploaded: 2 })
  })

  it('propaga force:true al motor', async () => {
    await call({ targets: [{ oposicion: 'x-opo', tema: 3 }], force: true })
    await flush()
    expect(mockPregenerate).toHaveBeenCalledWith('x-opo', 3, { force: true })
  })

  it('descarta entries malformadas (tema no-entero / oposicion no-string)', async () => {
    const res = await call({
      targets: [
        { oposicion: 'buena-opo', tema: 5 },
        { oposicion: 'mala-opo', tema: 5.5 },   // no entero → fuera
        { oposicion: 123, tema: 7 },            // no string → fuera
      ],
    })
    expect(res.status).toBe(202)
    expect((await res.json()).accepted).toBe(1)
    await flush()
    expect(mockPregenerate).toHaveBeenCalledTimes(1)
    expect(mockPregenerate).toHaveBeenCalledWith('buena-opo', 5, { force: false })
  })

  it('todos malformados → 400 sin_targets', async () => {
    const res = await call({ targets: [{ oposicion: 5, tema: 'x' }] })
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('sin_targets')
  })
})
