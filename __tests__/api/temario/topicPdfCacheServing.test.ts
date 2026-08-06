/**
 * @jest-environment node
 */
// Integración del SERVIDO con caché S3 del PDF del temario
// (GET /api/temario/[oposicion]/[topic]/pdf).
//
// Es el corazón del fix de Julen (T-084): los temas GRANDES (Access/ofimática) 504eaban al
// generarse síncronos bajo el ALB de 60s.
//
// ⚠️ Desde T-159/T-270 Fase 2 (06/08/2026) esta ruta YA NO RENDERIZA NADA — el incidente del
// 29/07 (event-loop bloqueado 215s, `answer-and-save` a p95 25s) fue justo por renderizar en
// línea en el proceso que sirve tráfico. Ahora:
//   1) Si el PDF ya está pre-generado en S3 (content-addressed) → se sirve al instante.
//   2) Miss + cabe en un PDF → se ENCOLA para el worker y responde 503 `pdf_en_preparacion`
//      al instante (el cliente ya degrada un 503 a `window.print()`, sin cambios).
//   3) Miss + NO cabe (artículo-cajón >60k) → 413 gracioso (el 504 exacto de Julen) + encola igual.
//   4) Gate premium intacto.
//
// Mockeamos S3, la cola del worker y premium; mantenemos REALES los helpers de tamaño
// (countContentChars/maxArticleChars/fitsSyncPdf) — que son justo lo que decide 413 vs encolar.

jest.mock('@/lib/api/withErrorLogging', () => ({ withErrorLogging: (_p: string, h: unknown) => h }))
jest.mock('@/lib/observability/emit', () => ({ emitFireAndForget: jest.fn() }))

let mockPremium = true
jest.mock('@/lib/premium/isPremiumPlan', () => ({ isPremiumPlan: () => mockPremium }))
jest.mock('@/lib/api/auth/verifyAuth', () => ({ verifyAuthOptional: async () => ({ userId: 'u1' }) }))
jest.mock('@/lib/referrals/queries', () => ({ getUserPlanType: async () => 'premium' }))

const mockGetTopicContent = jest.fn()
jest.mock('@/lib/api/temario/queries', () => ({
  getTopicContent: (...a: unknown[]) => mockGetTopicContent(...a),
}))

const mockDownload = jest.fn()
const mockUpload = jest.fn(async () => ({ success: true, publicUrl: 'x', path: 'p' }))
jest.mock('@/lib/storage/s3-adapter', () => ({
  S3StorageAdapter: jest.fn().mockImplementation(() => ({ download: mockDownload, upload: mockUpload })),
}))

// `encolarParaElWorker` hace `await import(...)` de estos dos en caliente — sin mockearlos, el
// test intentaría abrir una conexión real de BD (`db/client.ts` crea el pool al importarse).
const mockEnqueuePdfJob = jest.fn(async () => true)
jest.mock('@/db/client', () => ({ getDb: () => ({}) }))
jest.mock('@/lib/temario/pdf/pdfJobQueue', () => ({ enqueuePdfJob: (...a: unknown[]) => mockEnqueuePdfJob(...a) }))

import { GET } from '@/app/api/temario/[oposicion]/[topic]/pdf/route'

const OPO = 'auxiliar-administrativo-estado'
function call(topic = '1') {
  const req = { url: 'https://www.vence.es/api/temario/auxiliar-administrativo-estado/7/pdf' } as never
  return GET(req, { params: Promise.resolve({ oposicion: OPO, topic }) } as never) as Promise<Response>
}
// Espera a que el `encolarParaElWorker` fire-and-forget (una promesa suelta) haya corrido.
const flush = () => new Promise((r) => setTimeout(r, 10))
// Contenido con un único artículo de N chars (controla chars totales y máximo por-artículo).
const contentOf = (chars: number) => ({ laws: [{ law: { id: 'l1' }, articles: [{ articleNumber: '1', content: 'x'.repeat(chars) }] }] })

describe('GET PDF temario — servido con caché S3, sin render en línea (T-159/T-270 Fase 2)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockPremium = true
    mockEnqueuePdfJob.mockResolvedValue(true)
    mockGetTopicContent.mockResolvedValue(contentOf(1000)) // por defecto, tema pequeño que cabe
  })

  it('HIT de caché S3 → sirve al instante, X-Pdf-Source=s3, no encola nada', async () => {
    mockDownload.mockResolvedValue({ success: true, data: Buffer.from('%PDF-cacheado'), contentType: 'application/pdf' })
    const res = await call('18')
    expect(res.status).toBe(200)
    expect(res.headers.get('X-Pdf-Source')).toBe('s3')
    expect(res.headers.get('Content-Type')).toBe('application/pdf')
    await flush()
    expect(mockEnqueuePdfJob).not.toHaveBeenCalled()
    expect(mockUpload).not.toHaveBeenCalled()
  })

  it('MISS + cabe en un PDF → ENCOLA para el worker y responde 503 al instante (no renderiza)', async () => {
    mockDownload.mockResolvedValue({ success: false, notFound: true })
    const res = await call('1')
    expect(res.status).toBe(503)
    expect(res.headers.get('Retry-After')).toBe('1800') // 30 min, la cadencia REAL del worker
    const body = await res.json()
    expect(body.error).toBe('pdf_en_preparacion')
    await flush()
    expect(mockEnqueuePdfJob).toHaveBeenCalledTimes(1)
    // No hay render que subir a la caché: el worker es quien la puebla.
    expect(mockUpload).not.toHaveBeenCalled()
  })

  it('MISS + artículo-cajón (>60k) → 413 gracioso, NO 504 (caso Julen), y TAMBIÉN encola', async () => {
    mockDownload.mockResolvedValue({ success: false, notFound: true })
    mockGetTopicContent.mockResolvedValue(contentOf(61_000)) // un solo artículo de 61k → no cabe síncrono
    const res = await call('19')
    expect(res.status).toBe(413)
    const body = await res.json()
    expect(body.error).toBe('tema_demasiado_grande')
    await flush()
    // Auto-curación (T-273/T-159): el 413 encola igual, para que la PRÓXIMA visita sí lo tenga.
    expect(mockEnqueuePdfJob).toHaveBeenCalledTimes(1)
  })

  it('fallo transitorio de S3 en la lectura NO rompe: cae al camino de encolar', async () => {
    mockDownload.mockRejectedValue(new Error('S3 timeout'))
    const res = await call('1')
    expect(res.status).toBe(503)
    expect((await res.json()).error).toBe('pdf_en_preparacion')
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
    const req = { url: 'https://www.vence.es/api/temario/auxiliar-administrativo-estado/7/pdf' } as never
    const res = (await (GET as never as (r: unknown, c: unknown) => Promise<Response>)(
      req, { params: Promise.resolve({ oposicion: 'no-existe-xyz', topic: '1' }) },
    ))
    expect(res.status).toBe(404)
  })
})
