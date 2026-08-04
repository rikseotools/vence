/**
 * La puerta que impide contestar una queja de temario contra un estado de BD que no respalda nada.
 *
 * Los casos salen del 04/08/2026 (impugnación `0b9d9f56`, Aux. Admin. Universidad de León): el
 * aviso existía, se leyó y se siguió igual, porque pedía clonar 21 epígrafes para contestar a una
 * pregunta sobre un artículo. Lo que estos tests fijan es el equilibrio que lo hace cumplible:
 * bloquear SOLO por el tema que sirve la pregunta, y avisar de lo demás.
 */

const {
  evaluarRevisionTemario,
  selladoFiable,
} = require('../../lib/temario/revisionEpigrafe.cjs')

const tema = (over: Record<string, unknown> = {}) => ({
  tema: 2,
  titulo: 'Ley 40/2015',
  epigrafeState: 'verified_literal',
  scopeState: 'verified_correct',
  scopeVerifiedBy: 'multi_agent',
  scopeRunId: 'verify_x_2026-08-04',
  ...over,
})

const codes = (r: { bloqueos: Array<{ code: string }> }) => r.bloqueos.map((b) => b.code)

describe('cuándo NO opina', () => {
  it('una queja que no va de temario la deja pasar sin mirar nada', () => {
    const r = evaluarRevisionTemario({ esQuejaDeScope: false, temasAfectados: [] })
    expect(r.aplica).toBe(false)
    expect(r.verde).toBe(true)
  })

  it('si no se sabe qué tema sirve la pregunta, AVISA pero no bloquea', () => {
    // Fail-open: exigir «arregla algo, no sé qué» es la peor versión de un guardarraíl.
    const r = evaluarRevisionTemario({ esQuejaDeScope: true, temasAfectados: [] })
    expect(r.verde).toBe(true)
    expect(r.avisos.map((a: { code: string }) => a.code)).toContain('tema_no_localizado')
  })

  it('el escape declarado abre la puerta y queda con su motivo', () => {
    const r = evaluarRevisionTemario({
      esQuejaDeScope: true,
      temasAfectados: [tema({ epigrafeState: 'never_sourced' })],
      igualmente: 'el usuario pregunta por otra cosa, el temario es incidental',
    })
    expect(r.verde).toBe(true)
    expect(r.clase).toBe('escape')
    expect(r.motivo).toMatch(/incidental/)
  })
})

describe('Paso 1 — el epígrafe del tema afectado tiene que ser el literal oficial', () => {
  it('bloquea si está never_sourced', () => {
    const r = evaluarRevisionTemario({
      esQuejaDeScope: true,
      temasAfectados: [tema({ epigrafeState: 'never_sourced' })],
    })
    expect(r.verde).toBe(false)
    expect(codes(r)).toContain('paso1_pendiente')
  })

  it('bloquea igual si está en drift o stale — no es solo el never_sourced', () => {
    for (const estado of ['drift_detected', 'stale', 'outdated_convocatoria', 'provisional_anterior']) {
      const r = evaluarRevisionTemario({
        esQuejaDeScope: true,
        temasAfectados: [tema({ epigrafeState: estado })],
      })
      expect(codes(r)).toContain('paso1_pendiente')
    }
  })

  it('con el epígrafe literal y el sellado bueno, pasa', () => {
    const r = evaluarRevisionTemario({ esQuejaDeScope: true, temasAfectados: [tema()] })
    expect(r.verde).toBe(true)
    expect(r.bloqueos).toHaveLength(0)
  })
})

describe('el falso verde: `verified_correct` que no vino del pipeline', () => {
  it('caza el sellado directo del 20-21/07 (claude_direct + agent_run_id "--run")', () => {
    const r = evaluarRevisionTemario({
      esQuejaDeScope: true,
      temasAfectados: [tema({ scopeVerifiedBy: 'claude_direct', scopeRunId: '--run' })],
    })
    expect(r.verde).toBe(false)
    expect(codes(r)).toContain('verde_sin_pipeline')
  })

  it('un run_id vacío tampoco identifica ninguna corrida', () => {
    expect(selladoFiable('multi_agent', '')).toBe(false)
    expect(selladoFiable('multi_agent', null)).toBe(false)
    expect(selladoFiable('multi_agent', '--run')).toBe(false)
  })

  it('los sellados legítimos siguen valiendo', () => {
    expect(selladoFiable('multi_agent', 'verify_x_2026-07-24')).toBe(true)
    expect(selladoFiable('multi_agent+curado', 'run-12')).toBe(true)
    expect(selladoFiable('manuel_human', 'decision-manual-2026')).toBe(true)
  })

  it('NO se queja del sellado si el tema no está en verified_correct: ahí no hay verde que desmentir', () => {
    const r = evaluarRevisionTemario({
      esQuejaDeScope: true,
      temasAfectados: [tema({ scopeState: 'verified_issues', scopeVerifiedBy: 'claude_direct', scopeRunId: '--run' })],
    })
    expect(codes(r)).not.toContain('verde_sin_pipeline')
  })
})

describe('deuda declarada vs mentira — no se tratan igual', () => {
  it('un Paso 2 never_verified/stale avisa, no bloquea', () => {
    const r = evaluarRevisionTemario({
      esQuejaDeScope: true,
      temasAfectados: [tema({ scopeState: 'never_verified' })],
    })
    expect(r.verde).toBe(true)
    expect(r.avisos.map((a: { code: string }) => a.code)).toContain('paso2_pendiente')
  })

  it('la deuda del RESTO de la oposición nunca bloquea esta respuesta', () => {
    // Es el defecto que hacía inservible al aviso anterior: pedía 21 epígrafes para contestar a uno.
    const r = evaluarRevisionTemario({
      esQuejaDeScope: true,
      temasAfectados: [tema()],
      oposicion: { temasTotales: 21, sinPaso1: 20, selladoSinPipeline: 17 },
    })
    expect(r.verde).toBe(true)
    expect(r.avisos.map((a: { code: string }) => a.code)).toEqual(
      expect.arrayContaining(['deuda_oposicion', 'deuda_sellado']),
    )
  })
})

describe('filas rotas', () => {
  it('bloquea si el tema afectado tiene una ley con article_numbers vacío', () => {
    const r = evaluarRevisionTemario({
      esQuejaDeScope: true,
      temasAfectados: [tema({ filaRota: true })],
    })
    expect(codes(r)).toContain('fila_rota')
  })
})

describe('el caso real que lo motiva', () => {
  it('León T2 el 04/08: epígrafe sin clonar Y verde sellado a mano → dos bloqueos, con su comando', () => {
    const r = evaluarRevisionTemario({
      esQuejaDeScope: true,
      temasAfectados: [
        tema({ epigrafeState: 'never_sourced', scopeVerifiedBy: 'claude_direct', scopeRunId: '--run' }),
      ],
      oposicion: { temasTotales: 21, sinPaso1: 21, selladoSinPipeline: 17 },
    })
    expect(r.verde).toBe(false)
    expect(codes(r).sort()).toEqual(['paso1_pendiente', 'verde_sin_pipeline'])
    expect(r.bloqueos.every((b: { comando?: string }) => !!b.comando)).toBe(true)
  })
})
