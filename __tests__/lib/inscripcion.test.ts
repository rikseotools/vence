import {
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
