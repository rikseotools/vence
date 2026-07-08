import { deriveOportunidad } from '@/lib/oposiciones/oportunidad'

// Candidato del modelo OPORTUNIDAD: sugiere fase + vendibilidad desde los hechos.
// Es un PROXY (no verdad); estos tests fijan la lógica de sugerencia.
const HOY = '2026-07-08'

describe('deriveOportunidad (candidato)', () => {
  it('sin evidencia de nada → sin_oep, no vendible', () => {
    const r = deriveOportunidad({}, HOY)
    expect(r.fase).toBe('sin_oep')
    expect(r.vendible).toBe(false)
    expect(r.sinEvidenciaOep).toBe(true)
  })

  it('OEP (plazas) pero sin convocatoria → oep_aprobada, VENDIBLE (ciclo abierto)', () => {
    const r = deriveOportunidad({ plazasLibres: 20 }, HOY)
    expect(r.fase).toBe('oep_aprobada')
    expect(r.vendible).toBe(true)
    expect(r.sinEvidenciaOep).toBe(false)
  })

  it('convocatoria publicada sin fechas usables → convocada', () => {
    expect(deriveOportunidad({ plazasLibres: 10, boeReference: 'BOE-x' }, HOY).fase).toBe('convocada')
  })

  it('inscripción con start futuro → convocada (aún no abre)', () => {
    expect(
      deriveOportunidad({ plazasLibres: 10, inscriptionStart: '2026-08-01', inscriptionDeadline: '2026-08-20' }, HOY).fase,
    ).toBe('convocada')
  })

  it('start ≤ hoy ≤ deadline → inscripcion_abierta, vendible', () => {
    const r = deriveOportunidad(
      { plazasLibres: 10, inscriptionStart: '2026-07-01', inscriptionDeadline: '2026-07-20' },
      HOY,
    )
    expect(r.fase).toBe('inscripcion_abierta')
    expect(r.vendible).toBe(true)
  })

  it('deadline pasado → inscripcion_cerrada', () => {
    expect(
      deriveOportunidad({ plazasLibres: 10, inscriptionStart: '2026-06-01', inscriptionDeadline: '2026-06-20' }, HOY).fase,
    ).toBe('inscripcion_cerrada')
  })

  it('examen pasado FIRME → examen_realizado, NO vendible', () => {
    const r = deriveOportunidad({ plazasLibres: 10, examDate: '2026-06-01', examDateApproximate: false }, HOY)
    expect(r.fase).toBe('examen_realizado')
    expect(r.vendible).toBe(false)
  })

  it('examen pasado APROXIMADO → NO afirma examen_realizado (sigue vendible si el proxy no lo cierra)', () => {
    const r = deriveOportunidad({ plazasLibres: 10, examDate: '2026-06-01', examDateApproximate: true }, HOY)
    expect(r.fase).not.toBe('examen_realizado')
    expect(r.vendible).toBe(true) // examen aproximado no cierra la oportunidad
  })

  it('examen FUTURO → sigue vendible (oportunidad viva)', () => {
    expect(deriveOportunidad({ plazasLibres: 10, examDate: '2026-11-01' }, HOY).vendible).toBe(true)
  })

  it('sin OEP nunca es vendible aunque haya fechas sueltas', () => {
    expect(deriveOportunidad({ inscriptionDeadline: '2026-07-20' }, HOY).vendible).toBe(false)
  })
})
