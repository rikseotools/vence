const { detectaRegresion, clasificaCicloAutocuracion, veredicto } = require('@/lib/temario/pdf/canaryNoRender.cjs')

describe('detectaRegresion — la ruta pública tras la Fase 2 NO PUEDE emitir served=generated', () => {
  it('sin eventos, sin regresión', () => {
    expect(detectaRegresion([])).toEqual([])
  })

  it('eventos s3/encolado/too_large no son regresión', () => {
    const eventos = [{ served: 's3' }, { served: 'encolado' }, { served: 'too_large' }]
    expect(detectaRegresion(eventos)).toEqual([])
  })

  it('un solo served=generated ES regresión — es el valor que el código viejo emitía al renderizar en línea', () => {
    const eventos = [{ served: 's3' }, { served: 'generated' }]
    expect(detectaRegresion(eventos)).toEqual([{ served: 'generated' }])
  })

  it('filas sin campo served no revientan', () => {
    expect(detectaRegresion([{}, null, undefined])).toEqual([])
  })
})

describe('clasificaCicloAutocuracion — miss real -> encola -> worker -> done', () => {
  const AHORA = new Date('2026-08-06T20:00:00Z')

  it('sin misses, sin nada que clasificar', () => {
    expect(clasificaCicloAutocuracion([], [], 30, AHORA)).toEqual([])
  })

  it('el job terminó (done): completado', () => {
    const encolados = [{ hash: 'aaa', ts: '2026-08-06T19:50:00Z' }]
    const jobs = [{ content_hash: 'aaa', status: 'done' }]
    const [r] = clasificaCicloAutocuracion(encolados, jobs, 30, AHORA)
    expect(r.estado).toBe('completado')
  })

  it('el job existe pero sigue pendiente, DENTRO de la cadencia esperada: en_curso, no es fallo', () => {
    // encolado hace 10 min, cadencia 30 min -> normal que aún no haya terminado
    const encolados = [{ hash: 'aaa', ts: '2026-08-06T19:50:00Z' }]
    const jobs = [{ content_hash: 'aaa', status: 'pending' }]
    const [r] = clasificaCicloAutocuracion(encolados, jobs, 30, AHORA)
    expect(r.estado).toBe('en_curso')
  })

  it('el job existe pero lleva más de 2 cadencias sin resolver: atascado', () => {
    // encolado hace 70 min, cadencia 30 min * 2 = 60 min de margen -> ya se pasó
    const encolados = [{ hash: 'aaa', ts: '2026-08-06T18:50:00Z' }]
    const jobs = [{ content_hash: 'aaa', status: 'pending' }]
    const [r] = clasificaCicloAutocuracion(encolados, jobs, 30, AHORA)
    expect(r.estado).toBe('atascado')
    expect(r.detalle).toMatch(/min sin resolver/)
  })

  it('el job terminó en error: error, con el detalle', () => {
    const encolados = [{ hash: 'aaa', ts: '2026-08-06T19:50:00Z' }]
    const jobs = [{ content_hash: 'aaa', status: 'error', last_error: 'timeout renderizando' }]
    const [r] = clasificaCicloAutocuracion(encolados, jobs, 30, AHORA)
    expect(r.estado).toBe('error')
    expect(r.detalle).toBe('timeout renderizando')
  })

  it('se encoló pero NO hay fila en temario_pdf_jobs: sin_job — el enqueue no llegó a escribir', () => {
    const encolados = [{ hash: 'zzz', ts: '2026-08-06T19:50:00Z' }]
    const jobs = []
    const [r] = clasificaCicloAutocuracion(encolados, jobs, 30, AHORA)
    expect(r.estado).toBe('sin_job')
  })

  it('varios misses se clasifican de forma independiente', () => {
    const encolados = [
      { hash: 'a', ts: '2026-08-06T19:59:00Z' },
      { hash: 'b', ts: '2026-08-06T19:59:00Z' },
    ]
    const jobs = [{ content_hash: 'a', status: 'done' }, { content_hash: 'b', status: 'error', last_error: 'x' }]
    const r = clasificaCicloAutocuracion(encolados, jobs, 30, AHORA)
    expect(r.map((x) => x.estado)).toEqual(['completado', 'error'])
  })
})

describe('veredicto — el resumen que decide el exit code', () => {
  it('cualquier regresión (served=generated) es rojo, aunque el ciclo esté perfecto', () => {
    const v = veredicto([{ served: 'generated' }], [])
    expect(v.ok).toBe(false)
    expect(v.motivo).toMatch(/generated/)
  })

  it('sin regresión y sin misses: verde, y lo dice explícitamente (no es lo mismo que "no se comprobó")', () => {
    const v = veredicto([], [])
    expect(v.ok).toBe(true)
    expect(v.motivo).toMatch(/sin misses/)
  })

  it('sin regresión y todos los misses completados/en curso: verde', () => {
    const v = veredicto([], [{ estado: 'completado' }, { estado: 'en_curso' }])
    expect(v.ok).toBe(true)
  })

  it('sin regresión pero con un miss atascado: rojo', () => {
    const v = veredicto([], [{ estado: 'completado' }, { estado: 'atascado' }])
    expect(v.ok).toBe(false)
    expect(v.motivo).toMatch(/1 miss/)
  })

  it('sin regresión pero con un miss en error: rojo', () => {
    const v = veredicto([], [{ estado: 'error' }])
    expect(v.ok).toBe(false)
  })

  it('sin regresión pero con un miss sin_job: rojo — el enqueue falló en silencio', () => {
    const v = veredicto([], [{ estado: 'sin_job' }])
    expect(v.ok).toBe(false)
  })
})
