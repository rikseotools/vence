/**
 * @jest-environment node
 */
// Integración del SERVIDO con caché S3 del PDF del temario
// (GET /api/temario/[oposicion]/[topic]/pdf).
//
// Es el corazón del fix de Julen (T-084): los temas GRANDES (Access/ofimática) 504eaban al
// generarse síncronos bajo el ALB de 60s. Ahora:
//   1) Si el PDF ya está pre-generado en S3 (content-addressed) → se sirve al instante, SIN render.
//   2) Miss + cabe síncrono → se genera y se POBLA la caché para la próxima.
//   3) Miss + NO cabe (artículo-cajón >60k) → 413 gracioso (el 504 exacto de Julen), en vez de colgar.
//   4) Gate premium intacto.
//
// Mockeamos S3, el motor de PDF y premium; mantenemos REALES los helpers de tamaño
// (countContentChars/maxArticleChars/fitsSyncPdf) — que son justo lo que decide 413 vs generar.

jest.mock('@/lib/api/withErrorLogging', () => ({ withErrorLogging: (_p: string, h: unknown) => h }))
jest.mock('@react-pdf/renderer', () => ({
  renderToBuffer: jest.fn(async () => Buffer.from('%PDF-generado')),
  Document: {}, Page: {}, Text: {}, View: {}, StyleSheet: { create: (s: unknown) => s }, Font: { register: jest.fn() },
}), { virtual: true })
jest.mock('@/lib/temario/pdf/TopicPdfDocument', () => ({ TopicPdfDocument: () => null }))
jest.mock('@/lib/observability/emit', () => ({ emitFireAndForget: jest.fn() }))

// Mantiene REALES los helpers de tamaño/hash; solo neutraliza el builder del modelo.
jest.mock('@/lib/temario/pdf/topicPdfModel', () => ({
  ...jest.requireActual('@/lib/temario/pdf/topicPdfModel'),
  buildTopicPdfModel: jest.fn(() => ({ sections: [] })),
}))

let mockPremium = true
jest.mock('@/lib/premium/isPremiumPlan', () => ({ isPremiumPlan: () => mockPremium }))
jest.mock('@/lib/api/auth/verifyAuth', () => ({ verifyAuthOptional: async () => ({ userId: 'u1' }) }))
jest.mock('@/lib/referrals/queries', () => ({ getUserPlanType: async () => 'premium' }))

const mockGetTopicContent = jest.fn()
jest.mock('@/lib/api/temario/queries', () => ({
  getTopicContent: (...a: unknown[]) => mockGetTopicContent(...a),
  getLawSectionNames: async () => ({}),
}))

const mockDownload = jest.fn()
const mockUpload = jest.fn(async () => ({ success: true, publicUrl: 'x', path: 'p' }))
jest.mock('@/lib/storage/s3-adapter', () => ({
  S3StorageAdapter: jest.fn().mockImplementation(() => ({ download: mockDownload, upload: mockUpload })),
}))

import { renderToBuffer } from '@react-pdf/renderer'
import { GET } from '@/app/api/temario/[oposicion]/[topic]/pdf/route'

const OPO = 'auxiliar-administrativo-estado'
function call(topic = '1') {
  const req = {} as never
  return GET(req, { params: Promise.resolve({ oposicion: OPO, topic }) } as never) as Promise<Response>
}
// Contenido con un único artículo de N chars (controla chars totales y máximo por-artículo).
const contentOf = (chars: number) => ({ laws: [{ law: { id: 'l1' }, articles: [{ articleNumber: '1', content: 'x'.repeat(chars) }] }] })

describe('GET PDF temario — servido con caché S3', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockPremium = true
    mockGetTopicContent.mockResolvedValue(contentOf(1000)) // por defecto, tema pequeño que cabe
  })

  it('HIT de caché S3 → sirve al instante, X-Pdf-Source=s3, SIN render', async () => {
    mockDownload.mockResolvedValue({ success: true, data: Buffer.from('%PDF-cacheado'), contentType: 'application/pdf' })
    const res = await call('18')
    expect(res.status).toBe(200)
    expect(res.headers.get('X-Pdf-Source')).toBe('s3')
    expect(res.headers.get('Content-Type')).toBe('application/pdf')
    expect(renderToBuffer).not.toHaveBeenCalled() // el punto: no se re-renderiza lo pre-generado
    expect(mockUpload).not.toHaveBeenCalled()
  })

  it('MISS + cabe síncrono → genera y POBLA la caché (X-Pdf-Source=generated)', async () => {
    mockDownload.mockResolvedValue({ success: false, notFound: true })
    const res = await call('1')
    expect(res.status).toBe(200)
    expect(res.headers.get('X-Pdf-Source')).toBe('generated')
    expect(renderToBuffer).toHaveBeenCalledTimes(1)
    // best-effort: se sube a caché para la próxima (la subida es fire-and-forget → dejar correr).
    await new Promise((r) => setTimeout(r, 10))
    expect(mockUpload).toHaveBeenCalledTimes(1)
  })

  it('MISS + artículo-cajón (>60k) → 413 gracioso, NO 504, NO render (caso Julen)', async () => {
    mockDownload.mockResolvedValue({ success: false, notFound: true })
    mockGetTopicContent.mockResolvedValue(contentOf(61_000)) // un solo artículo de 61k → no cabe síncrono
    const res = await call('19')
    expect(res.status).toBe(413)
    const body = await res.json()
    expect(body.error).toBe('tema_demasiado_grande')
    expect(renderToBuffer).not.toHaveBeenCalled() // no se intenta el render que colgaría
  })

  it('fallo transitorio de S3 en la lectura NO rompe: cae a generar', async () => {
    mockDownload.mockRejectedValue(new Error('S3 timeout'))
    const res = await call('1')
    expect(res.status).toBe(200)
    expect(res.headers.get('X-Pdf-Source')).toBe('generated')
  })

  it('gate premium: no-premium → 403 y ni siquiera consulta el contenido', async () => {
    mockPremium = false
    const res = await call('1')
    expect(res.status).toBe(403)
    expect((await res.json()).error).toBe('premium_required')
    expect(mockGetTopicContent).not.toHaveBeenCalled()
    expect(mockDownload).not.toHaveBeenCalled()
  })

  it('oposición inexistente → 404 (control negativo)', async () => {
    const req = {} as never
    const res = (await (GET as never as (r: unknown, c: unknown) => Promise<Response>)(
      req, { params: Promise.resolve({ oposicion: 'no-existe-xyz', topic: '1' }) },
    ))
    expect(res.status).toBe(404)
  })
})
