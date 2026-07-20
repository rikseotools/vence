import {
  BANNER_MIN_PLAZAS,
  hasSignificantPlazas,
  isBannerWorthy,
  isInscripcionAbierta,
  isOpenForDisplay,
  isShowableCatalogada,
  todayMadrid,
} from '@/lib/oposiciones/inscripcion'

describe('isInscripcionAbierta — fuente de verdad derivada de fechas', () => {
  const today = '2026-06-20'

  it('abierta: hoy dentro del intervalo', () => {
    expect(isInscripcionAbierta({ inscription_start: '2026-06-01', inscription_deadline: '2026-07-08' }, today)).toBe(true)
  })

  it('abierta: hoy == día de cierre (inclusive)', () => {
    expect(isInscripcionAbierta({ inscription_start: '2026-06-01', inscription_deadline: '2026-06-20' }, today)).toBe(true)
  })

  it('abierta: hoy == día de inicio (inclusive)', () => {
    expect(isInscripcionAbierta({ inscription_start: '2026-06-20', inscription_deadline: '2026-07-01' }, today)).toBe(true)
  })

  it('CERRADA: plazo vencido ayer (el bug de INGESA, cierre 2026-06-09)', () => {
    expect(isInscripcionAbierta({ inscription_start: '2026-05-01', inscription_deadline: '2026-06-09' }, today)).toBe(false)
  })

  it('CERRADA: aún no ha empezado', () => {
    expect(isInscripcionAbierta({ inscription_start: '2026-07-01', inscription_deadline: '2026-07-30' }, today)).toBe(false)
  })

  it('CERRADA: sin fecha de cierre (dato incompleto)', () => {
    expect(isInscripcionAbierta({ inscription_start: '2026-06-01', inscription_deadline: null }, today)).toBe(false)
  })

  it('CERRADA: sin fecha de inicio', () => {
    expect(isInscripcionAbierta({ inscription_start: null, inscription_deadline: '2026-07-08' }, today)).toBe(false)
  })

  it('tolera timestamps completos (corta a YYYY-MM-DD)', () => {
    expect(isInscripcionAbierta({ inscription_start: '2026-06-01T00:00:00Z', inscription_deadline: '2026-07-08T23:59:59Z' }, today)).toBe(true)
  })

  it('todayMadrid devuelve formato YYYY-MM-DD', () => {
    expect(todayMadrid()).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})

describe('isOpenForDisplay — puerta de inclusión home + SEO', () => {
  const today = '2026-06-20'
  const abierta = { inscription_start: '2026-06-01', inscription_deadline: '2026-07-08' }
  const vencida = { inscription_start: '2026-05-01', inscription_deadline: '2026-06-09' }

  it('PUBLICADA abierta → se muestra', () => {
    expect(isOpenForDisplay({ ...abierta, is_active: true, seguimiento_url: null }, today)).toBe(true)
  })

  it('PUBLICADA vencida → NO (aunque is_active)', () => {
    expect(isOpenForDisplay({ ...vencida, is_active: true, seguimiento_url: null }, today)).toBe(false)
  })

  it('CATALOGADA abierta CON url oficial → se muestra (sin test todavía)', () => {
    expect(isOpenForDisplay({ ...abierta, is_active: false, seguimiento_url: 'https://boe.es/x' }, today)).toBe(true)
  })

  it('CATALOGADA abierta SIN url → NO (no hay a dónde enlazar)', () => {
    expect(isOpenForDisplay({ ...abierta, is_active: false, seguimiento_url: null }, today)).toBe(false)
  })

  it('CATALOGADA vencida con url → NO', () => {
    expect(isOpenForDisplay({ ...vencida, is_active: false, seguimiento_url: 'https://boe.es/x' }, today)).toBe(false)
  })
})

describe('isShowableCatalogada — sección "sin test todavía" de la SEO', () => {
  const today = '2026-06-20'
  const abierta = { inscription_start: '2026-06-01', inscription_deadline: '2026-07-08' }

  it('catalogada abierta con url → sí', () => {
    expect(isShowableCatalogada({ ...abierta, is_active: false, seguimiento_url: 'https://x' }, today)).toBe(true)
  })

  it('PUBLICADA (is_active=true) → NO es catalogada, aunque esté abierta con url', () => {
    expect(isShowableCatalogada({ ...abierta, is_active: true, seguimiento_url: 'https://x' }, today)).toBe(false)
  })

  it('catalogada abierta sin url → no', () => {
    expect(isShowableCatalogada({ ...abierta, is_active: false, seguimiento_url: null }, today)).toBe(false)
  })
})


// Mínimo de plazas del escaparate (decisión producto, Manuel 20/07): en un BANNER nunca
// se muestra una convocatoria de menos de 10 plazas. Origen: de 51 vivas, 24 tenían ≤4
// plazas y 14 una sola; el teaser general de la home enseñaba 9 de 10 con ≤4.
describe('hasSignificantPlazas — mínimo de plazas del escaparate', () => {
  it('el mínimo de producto es 10', () => {
    expect(BANNER_MIN_PLAZAS).toBe(10)
  })

  it('pasa: justo en el mínimo (10)', () => {
    expect(hasSignificantPlazas({ plazas_libres: 10 })).toBe(true)
  })

  it('pasa: holgadamente por encima', () => {
    expect(hasSignificantPlazas({ plazas_libres: 673 })).toBe(true)
  })

  it('NO pasa: 9 (justo por debajo del mínimo)', () => {
    expect(hasSignificantPlazas({ plazas_libres: 9 })).toBe(false)
  })

  it('NO pasa: 1 plaza (el caso "Enólogo" que motivó la regla)', () => {
    expect(hasSignificantPlazas({ plazas_libres: 1 })).toBe(false)
  })

  it('NO pasa: NULL — plazas no acreditadas, no podemos afirmar que llegue al mínimo', () => {
    expect(hasSignificantPlazas({ plazas_libres: null })).toBe(false)
  })

  it('NO pasa: 0 plazas', () => {
    expect(hasSignificantPlazas({ plazas_libres: 0 })).toBe(false)
  })
})

describe('isBannerWorthy — puerta única de los banners (fechas Y plazas)', () => {
  const today = '2026-06-20'
  const abierta = { inscription_start: '2026-06-01', inscription_deadline: '2026-07-08' }

  it('publicada, abierta y con plazas suficientes → se muestra', () => {
    expect(isBannerWorthy({ ...abierta, is_active: true, seguimiento_url: null, plazas_libres: 46 }, today)).toBe(true)
  })

  it('catalogada con url, abierta y con plazas suficientes → se muestra', () => {
    expect(isBannerWorthy({ ...abierta, is_active: false, seguimiento_url: 'https://x', plazas_libres: 22 }, today)).toBe(true)
  })

  it('abierta pero de 1 plaza → NO (aunque esté publicada)', () => {
    expect(isBannerWorthy({ ...abierta, is_active: true, seguimiento_url: null, plazas_libres: 1 }, today)).toBe(false)
  })

  it('muchas plazas pero inscripción CERRADA → NO (las fechas siguen mandando)', () => {
    expect(isBannerWorthy(
      { inscription_start: '2026-05-01', inscription_deadline: '2026-06-09', is_active: true, seguimiento_url: null, plazas_libres: 500 },
      today,
    )).toBe(false)
  })

  it('catalogada SIN url oficial, aun con plazas de sobra → NO (regla previa intacta)', () => {
    expect(isBannerWorthy({ ...abierta, is_active: false, seguimiento_url: null, plazas_libres: 500 }, today)).toBe(false)
  })
})
