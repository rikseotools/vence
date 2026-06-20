import { isInscripcionAbierta, todayMadrid } from '@/lib/oposiciones/inscripcion'

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
