// Guardarraíl del detector de divergencia de dual-write (legacy oposiciones ↔
// convocatoria SSOT). Casos REALES del barrido 24/07/2026.
const { dualWriteDivergences, norm } = require('../../scripts/lib/dual-write-divergence.cjs')

describe('norm — comparación robusta', () => {
  it('Date → YYYY-MM-DD (UTC, la fecha almacenada)', () => {
    expect(norm(new Date('2026-08-20T00:00:00Z'))).toBe('2026-08-20')
  })
  it('número → string; string vacío → null', () => {
    expect(norm(2)).toBe('2')
    expect(norm('   ')).toBeNull()
    expect(norm(null)).toBeNull()
  })
})

describe('dualWriteDivergences — casos reales del barrido', () => {
  it('jaén: legacy oep_aprobada/plazas null vs conv inscripcion_abierta/2 → divergencia de estado', () => {
    const d = dualWriteDivergences(
      { estado_proceso: 'oep_aprobada', plazas_libres: null },
      { estado_proceso: 'inscripcion_abierta', plazas_libres: 2 },
    )
    expect(d).toEqual([{ field: 'estado_proceso', legacy: 'oep_aprobada', convocatoria: 'inscripcion_abierta' }])
    // plazas_libres NO diverge: legacy null = hueco (lo cubre el check de incompleto)
  })

  it('girona: convocatoria por delante (oep_aprobada vs nombramientos)', () => {
    const d = dualWriteDivergences(
      { estado_proceso: 'oep_aprobada' },
      { estado_proceso: 'nombramientos' },
    )
    expect(d.map((x) => x.field)).toEqual(['estado_proceso'])
  })

  it('córdoba: LEGACY por delante y más completa (inscripcion_abierta vs convocada); deadline solo en legacy = hueco, no divergencia', () => {
    const d = dualWriteDivergences(
      { estado_proceso: 'inscripcion_abierta', inscription_deadline: new Date('2026-08-20T00:00:00Z') },
      { estado_proceso: 'convocada', inscription_deadline: null },
    )
    expect(d).toEqual([{ field: 'estado_proceso', legacy: 'inscripcion_abierta', convocatoria: 'convocada' }])
  })

  it('plazas divergentes (murcia: 20 vs 18)', () => {
    const d = dualWriteDivergences({ plazas_libres: 20 }, { plazas_libres: 18 })
    expect(d).toEqual([{ field: 'plazas_libres', legacy: '20', convocatoria: '18' }])
  })

  it('coherente: mismos valores (incl. fechas iguales) → sin divergencia', () => {
    const d = dualWriteDivergences(
      { estado_proceso: 'inscripcion_cerrada', plazas_libres: 26, inscription_deadline: new Date('2026-04-27T00:00:00Z') },
      { estado_proceso: 'inscripcion_cerrada', plazas_libres: 26, inscription_deadline: new Date('2026-04-27T00:00:00Z') },
    )
    expect(d).toEqual([])
  })

  it('sin convocatoria → array vacío (no revienta)', () => {
    expect(dualWriteDivergences({ estado_proceso: 'convocada' }, null)).toEqual([])
  })
})
