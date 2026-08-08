/** @jest-environment node */
// __tests__/lib/api/oep-signals/provenanceExcepcionSenal.test.ts
//
// [T-221, 08/08] El bloque "PROVENANCE DE TODA SEÑAL APLICADA" de `promoteSignalToConvocatoria`
// (lib/api/oep-signals/queries.ts) registra el documento de CUALQUIER señal aplicada, no solo las
// que traen año OEP (eso lo hace el bloque F3, hermano, ya cubierto por T-238). Hasta ahora, si
// `registrarDocumentoDeSenal` LANZABA (en vez de devolver `null` limpio), el único rastro era un
// `console.warn` — la MISMA clase de hueco que T-238 cerró para F3, pero que aquí seguía abierta.
//
// Medido en producción (08/08): 45 señales aplicadas desde el 29/07 (el deploy del fix original),
// 0 con `source_documento_id`, 21 de ellas con una URL que SÍ reconoce `boletin_doc_key_reconocido`
// (documento esperable) y aun así CERO eventos `senal_aplicada_sin_documento` en `observable_events`
// (0 histórico) — solo cuadra con una excepción real cayendo en el catch mudo. Este test ejercita
// el CÓDIGO REAL (no reimplementa SQL) contra un mock de `db.execute` por CONTENIDO de la consulta,
// mismo patrón que `f3ObservabilidadClonado.test.ts`.

const mockEmit = jest.fn().mockResolvedValue(undefined)
jest.mock('@/lib/observability/emit', () => ({ emit: (...a: unknown[]) => mockEmit(...a) }))

jest.mock('@/db/schema', () => ({
  oepDetectionSignals: { id: 'oep_detection_signals.id' },
  convocatoriaHitos: {},
}))
jest.mock('@/db/oposicionesSsot', () => ({ oposicionesSsot: {} }))
jest.mock('next/cache', () => ({ revalidateTag: jest.fn() }))

function textoSql(x: unknown): string {
  const chunks = (x as { queryChunks?: unknown[] })?.queryChunks
  if (!Array.isArray(chunks)) return ''
  return chunks
    .map((c) => (c && typeof c === 'object' && Array.isArray((c as { value?: unknown[] }).value)
      ? (c as { value: unknown[] }).value.join('')
      : ''))
    .join(' ')
}

const SIGNAL_ID = '11111111-1111-1111-1111-111111111111'
const OPOSICION_ID = '22222222-2222-2222-2222-222222222222'
const CONV_ID = '33333333-3333-3333-3333-333333333333'
const SRC_URL = 'https://bocyl.jcyl.es/html/2026/07/30/html/BOCYL-D-30072026-146-28.do'

/** `modo` decide qué hace la llamada de `registrarDocumentoDeSenal` (el SELECT CASE con
 * `boletin_doc_key_reconocido`/`ensure_convocatoria_documento`): 'excepcion' → esa consulta
 * revienta (simula el caso real: rec=true y aun así una excepción real, no un null limpio).
 * Sin `detected_year` a propósito: así el bloque F3 (que exige año) no se ejecuta, y lo único
 * que puede dejar rastro es el bloque de provenance general que este test ejercita. */
function crearExecuteMock(modo: 'excepcion' | 'ok') {
  return jest.fn(async (sqlObj: unknown) => {
    const t = textoSql(sqlObj)
    if (t.includes('FROM oep_detection_signals WHERE id')) {
      return [{
        oposicion_id: OPOSICION_ID, detected_year: null, detected_plazas_libre: 3,
        detected_plazas_discapacidad: null, detected_plazas_promocion_interna: null,
        detected_boc_ref: null, source_url: SRC_URL,
        detected_fecha_publicacion: null, detected_fecha_inscripcion_fin: null, detected_fecha_examen: null,
        detected_estado: null, detected_sistema: null, signal_summary: 'convocatoria BOCYL', sensor_type: 'regional_scan',
      }]
    }
    if (t.includes('FROM convocatorias WHERE oposicion_id') && t.includes('is_current')) {
      return [{ id: CONV_ID, anio: 2026 }]
    }
    if (t.includes('UPDATE convocatorias SET')) return []
    if (t.includes('UPDATE oposiciones SET')) return []
    if (t.includes('ensure_convocatoria_documento') || (t.includes('boletin_doc_key_reconocido') && t.includes('CASE'))) {
      if (modo === 'excepcion') throw new Error('ensure_convocatoria_documento: doc_key requerido (canonicaliza la URL antes con canonicalizeBoletinUrl)')
      return [{ id: 'doc-id-real' }]
    }
    if (t.includes('UPDATE oep_detection_signals SET source_documento_id')) return []
    return []
  })
}

function crearDbMock(execute: jest.Mock) {
  return {
    execute,
    update: () => ({
      set: () => ({
        where: () => ({
          returning: async () => [{ id: SIGNAL_ID }],
        }),
      }),
    }),
  }
}

describe('provenance de toda señal aplicada — la excepción real ya deja rastro (T-221, 08/08)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockEmit.mockClear()
  })

  it('una excepción real en registrarDocumentoDeSenal → emite senal_provenance_excepcion con el mensaje', async () => {
    jest.resetModules()
    const execute = crearExecuteMock('excepcion')
    jest.doMock('@/db/client', () => ({ getDb: () => crearDbMock(execute) }))
    const { reviewSignal } = await import('@/lib/api/oep-signals/queries')

    const res = await reviewSignal({ signalId: SIGNAL_ID, action: 'apply', adminNotes: null })

    // El bloque es "no bloqueante" por diseño: la promoción entera sigue teniendo éxito aunque
    // el registro de documento reviente — solo cambia que ahora SÍ queda rastro.
    expect(res.success).toBe(true)
    const llamada = mockEmit.mock.calls.find((c) => c[0]?.eventType === 'senal_provenance_excepcion')
    expect(llamada).toBeDefined()
    expect(llamada![0]).toMatchObject({
      severity: 'warn',
      eventType: 'senal_provenance_excepcion',
      metadata: expect.objectContaining({
        signalId: SIGNAL_ID,
        oposicionId: OPOSICION_ID,
        sensorType: 'regional_scan',
        sourceUrl: SRC_URL,
        error: expect.stringContaining('doc_key requerido'),
      }),
    })
    // Y NO debería emitir también el de "null limpio" — son fallos distintos (T-238 los separa
    // igual para el bloque F3: excepción real vs docId null son dos causas, no una).
    expect(mockEmit.mock.calls.some((c) => c[0]?.eventType === 'senal_aplicada_sin_documento')).toBe(false)
  })

  it('cuando SÍ sale documento, no emite nada de esto (caso sano)', async () => {
    jest.resetModules()
    const execute = crearExecuteMock('ok')
    jest.doMock('@/db/client', () => ({ getDb: () => crearDbMock(execute) }))
    const { reviewSignal } = await import('@/lib/api/oep-signals/queries')

    const res = await reviewSignal({ signalId: SIGNAL_ID, action: 'apply', adminNotes: null })

    expect(res.success).toBe(true)
    expect(mockEmit.mock.calls.some((c) => c[0]?.eventType === 'senal_provenance_excepcion')).toBe(false)
    expect(mockEmit.mock.calls.some((c) => c[0]?.eventType === 'senal_aplicada_sin_documento')).toBe(false)
  })
})
