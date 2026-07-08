import { estadoParaPromover } from '@/lib/api/oep-signals/queries'

// Guardrail SSOT (08/07): al promover una señal del radar a `convocatorias`, NO
// se puede escribir 'inscripcion_abierta'/'convocada' sin fecha de cierre — es el
// patrón que dejaba 83 tarjetas invisibles en la home (filtra por fechas).
describe('estadoParaPromover (guardrail estado sin deadline)', () => {
  it('inscripcion_abierta SIN deadline → null (advance-estado lo derivará)', () => {
    expect(estadoParaPromover('inscripcion_abierta', false)).toBeNull()
  })

  it('convocada SIN deadline → null', () => {
    expect(estadoParaPromover('convocada', false)).toBeNull()
  })

  it('inscripcion_abierta CON deadline → se conserva (está respaldado)', () => {
    expect(estadoParaPromover('inscripcion_abierta', true)).toBe('inscripcion_abierta')
  })

  it('convocada CON deadline → se conserva', () => {
    expect(estadoParaPromover('convocada', true)).toBe('convocada')
  })

  it('otros estados pasan tal cual, con o sin deadline', () => {
    for (const e of ['resultados', 'nombramientos', 'examen_realizado', 'oep_aprobada']) {
      expect(estadoParaPromover(e, false)).toBe(e)
      expect(estadoParaPromover(e, true)).toBe(e)
    }
  })

  it('null → null', () => {
    expect(estadoParaPromover(null, false)).toBeNull()
    expect(estadoParaPromover(null, true)).toBeNull()
  })
})
