import { rolloverStatus } from '@/lib/api/oposiciones/rollover'

// Guardrail anti-engaño (08/07/2026): un "pivote a medias" —poner exam_date=null
// SIN añadir el hito forward ni investigar la próxima OEP— NO debe hacer que la
// oposición desaparezca del radar de rollover. Estos tests fijan esa regla.
describe('rolloverStatus (guardrail de rollover)', () => {
  const now = new Date('2026-07-08T00:00:00Z')
  const futuro = new Date('2026-11-01T00:00:00Z')
  const pasado = new Date('2026-06-13T00:00:00Z')

  it('examen futuro → tiene horizonte, NO pendiente', () => {
    expect(rolloverStatus({ examDate: futuro, hasUpcomingHito: false, now })).toEqual({
      pending: false,
      motivo: null,
    })
  })

  it('examen pasado, sin hito upcoming → pendiente (examen_pasado)', () => {
    expect(rolloverStatus({ examDate: pasado, hasUpcomingHito: false, now })).toEqual({
      pending: true,
      motivo: 'examen_pasado',
    })
  })

  it('PIVOTE A MEDIAS: exam_date=null SIN hito forward → sigue pendiente (sin_horizonte)', () => {
    // Este es el caso del engaño: nulear exam_date NO basta; sin hito forward
    // la landing queda en callejón sin salida y debe seguir contando.
    expect(rolloverStatus({ examDate: null, hasUpcomingHito: false, now })).toEqual({
      pending: true,
      motivo: 'sin_horizonte',
    })
  })

  it('ROLLOVER BIEN HECHO: exam_date=null CON hito upcoming → NO pendiente', () => {
    expect(rolloverStatus({ examDate: null, hasUpcomingHito: true, now })).toEqual({
      pending: false,
      motivo: null,
    })
  })

  it('examen pasado PERO con hito upcoming (próxima OEP) → NO pendiente', () => {
    expect(rolloverStatus({ examDate: pasado, hasUpcomingHito: true, now })).toEqual({
      pending: false,
      motivo: null,
    })
  })
})
