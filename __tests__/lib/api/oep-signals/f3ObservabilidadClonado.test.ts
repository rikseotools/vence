/** @jest-environment node */
// __tests__/lib/api/oep-signals/f3ObservabilidadClonado.test.ts
//
// [T-238] El bloque F3 de `promoteSignalToConvocatoria` (lib/api/oep-signals/queries.ts) clona el
// decreto de la OEP al hub cuando la fuente es un boletín reconocido. Hasta ahora, si eso fallaba
// —tanto "boletin_doc_key_reconocido=true pero ensure_convocatoria_documento devuelve NULL" como
// una excepción real dentro del bloque— el único rastro era un `console.warn`, que no aterriza en
// ningún sitio consultable (verificado contra producción: CERO filas en `convocatoria_documentos`
// con `fuente='oep-radar'`, y CERO eventos de error/warn con esas palabras clave en
// `observable_events`, pese a haber al menos 2 casos reales medidos el 06/08 con una URL de BOE
// que SÍ pasa `boletin_doc_key_reconocido`). Este test ejercita el CÓDIGO REAL (no reimplementa
// SQL) contra un mock de `db.execute` que responde por CONTENIDO de la consulta (no por orden de
// llamada, para no ser frágil ante reordenamientos inocuos), y comprueba que las dos rutas de
// fallo ahora SÍ emiten telemetría.

const mockEmit = jest.fn().mockResolvedValue(undefined)
jest.mock('@/lib/observability/emit', () => ({ emit: (...a: unknown[]) => mockEmit(...a) }))

jest.mock('@/db/schema', () => ({
  oepDetectionSignals: { id: 'oep_detection_signals.id' },
  convocatoriaHitos: {},
}))
jest.mock('@/db/oposicionesSsot', () => ({ oposicionesSsot: {} }))
jest.mock('next/cache', () => ({ revalidateTag: jest.fn() }))

// Texto de la consulta SIN los valores de los parámetros (drizzle-orm coloca cada `${...}` como
// un chunk `Param` separado de los chunks de texto `{value:[...]}`) — suficiente para dirigir el
// mock por CONTENIDO en vez de por orden, que es lo que hace al test robusto a reordenamientos.
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
const OEP_ID = '44444444-4444-4444-4444-444444444444'
const SRC_URL = 'https://www.boe.es/diario_boe/txt.php?id=BOE-A-2026-15052'

/** Construye el mock de `db.execute`. `ensureDocumentoResult` decide qué hace la llamada a
 * `ensure_convocatoria_documento` (vía el SELECT CASE de `registrarDocumentoDeSenal`): 'null' →
 * responde `{id: null}` (rec=true pero no sale documento), 'throw' → la llamada entera de F3
 * revienta antes de llegar ahí (simula una excepción real dentro del bloque). */
function crearExecuteMock(modo: 'docId_null' | 'excepcion_en_f3') {
  return jest.fn(async (sqlObj: unknown) => {
    const t = textoSql(sqlObj)
    if (t.includes('FROM oep_detection_signals WHERE id')) {
      return [{
        oposicion_id: OPOSICION_ID, detected_year: 2024, detected_plazas_libre: null,
        detected_plazas_discapacidad: null, detected_plazas_promocion_interna: null,
        detected_boc_ref: null, source_url: SRC_URL,
        detected_fecha_publicacion: null, detected_fecha_inscripcion_fin: null, detected_fecha_examen: null,
        detected_estado: null, detected_sistema: null, signal_summary: 'OEP 2024', sensor_type: 'test',
      }]
    }
    if (t.includes('FROM convocatorias WHERE oposicion_id') && t.includes('is_current')) {
      return [{ id: CONV_ID, anio: 2026 }]
    }
    if (t.includes('UPDATE convocatorias SET')) return []
    if (t.includes('UPDATE oposiciones SET')) return []
    if (t.includes('FROM oep WHERE oposicion_id')) {
      if (modo === 'excepcion_en_f3') throw new Error('conexión perdida a mitad del upsert de oep')
      return [] // sin fila existente -> rama INSERT
    }
    if (t.includes('INSERT INTO oep (')) return [{ id: OEP_ID }]
    if (t.includes('INSERT INTO convocatoria_oep')) return []
    if (t.includes('boletin_doc_key_reconocido') && !t.includes('ensure_convocatoria_documento')) {
      return [{ rec: true }] // la URL SÍ es un boletín reconocido — éste es justo el caso que antes se perdía
    }
    if (t.includes('ensure_convocatoria_documento')) {
      return [{ id: modo === 'docId_null' ? null : null }] // ambos escenarios: no sale documento
    }
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

describe('F3 (oep-signals) — el fallo de clonado ahora deja rastro (T-238)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockEmit.mockClear()
  })

  it('boletín reconocido pero ensure_convocatoria_documento devuelve NULL → emite oep_f3_clonado_fallido', async () => {
    jest.resetModules()
    const execute = crearExecuteMock('docId_null')
    jest.doMock('@/db/client', () => ({ getDb: () => crearDbMock(execute) }))
    const { reviewSignal } = await import('@/lib/api/oep-signals/queries')

    const res = await reviewSignal({ signalId: SIGNAL_ID, action: 'apply', adminNotes: null })

    expect(res.success).toBe(true)
    const llamada = mockEmit.mock.calls.find((c) => c[0]?.eventType === 'oep_f3_clonado_fallido')
    expect(llamada).toBeDefined()
    expect(llamada![0]).toMatchObject({
      severity: 'warn',
      eventType: 'oep_f3_clonado_fallido',
      metadata: expect.objectContaining({
        oposicionId: OPOSICION_ID,
        sourceUrl: SRC_URL,
        year: 2024,
        causa: 'ensure_convocatoria_documento_null',
      }),
    })
  })

  it('una excepción real dentro del bloque F3 → emite oep_f3_upsert_fallo con el mensaje de error', async () => {
    jest.resetModules()
    const execute = crearExecuteMock('excepcion_en_f3')
    jest.doMock('@/db/client', () => ({ getDb: () => crearDbMock(execute) }))
    const { reviewSignal } = await import('@/lib/api/oep-signals/queries')

    const res = await reviewSignal({ signalId: SIGNAL_ID, action: 'apply', adminNotes: null })

    // F3 es "aditivo y no bloqueante" (comentario del propio código): la promoción entera
    // sigue teniendo éxito aunque F3 reviente — solo cambia que ahora SÍ queda rastro.
    expect(res.success).toBe(true)
    const llamada = mockEmit.mock.calls.find((c) => c[0]?.eventType === 'oep_f3_upsert_fallo')
    expect(llamada).toBeDefined()
    expect(llamada![0].metadata.error).toMatch(/conexión perdida/)
    expect(llamada![0].metadata.oposicionId).toBe(OPOSICION_ID)
    // Y NO debería, de paso, emitir también el de "docId null" — son fallos distintos.
    expect(mockEmit.mock.calls.some((c) => c[0]?.eventType === 'oep_f3_clonado_fallido')).toBe(false)
  })
})
