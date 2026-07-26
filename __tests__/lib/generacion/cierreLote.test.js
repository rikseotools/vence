const { estadoCierre } = require('../../../lib/generacion/cierreLote')

const ids = ['q1', 'q2', 'q3']
const v = (questionId, provider) => ({ questionId, provider })

describe('estadoCierre', () => {
  it('cierra cuando las tres preguntas tienen Paso 7 y Paso 9', () => {
    const r = estadoCierre(
      ids.flatMap((id) => [v(id, 'claude_code'), v(id, 'claude_code_recheck')]), ids)
    expect(r.cerrado).toBe(true)
    expect(r.motivo).toBeNull()
  })

  it('NO cierra si falta el Paso 9 — que es exactamente lo que pasó con las 69 de T-146', () => {
    // El manual dice «sin este paso el lote NO se cierra», pero nada lo comprobaba:
    // se aprobaron 69 preguntas sin Paso 9 y la re-verificación posterior encontró
    // 15 defectos que las 12 auditorías ciegas del Paso 7 no habían cazado.
    const r = estadoCierre(ids.map((id) => v(id, 'claude_code')), ids)
    expect(r.cerrado).toBe(false)
    expect(r.sinPaso9).toEqual(ids)
    expect(r.sinPaso7).toEqual([])
    expect(r.motivo).toMatch(/re-verificación post-aplicación/)
  })

  it('NO cierra si falta la auditoría ciega', () => {
    const r = estadoCierre(ids.map((id) => v(id, 'claude_code_recheck')), ids)
    expect(r.cerrado).toBe(false)
    expect(r.sinPaso7).toEqual(ids)
    expect(r.motivo).toMatch(/auditoría ciega/)
  })

  it('acepta las ITERACIONES del Paso 9 (_v2, _v3): reparar y repasar es lo que manda el manual', () => {
    // Cuatro de los ocho lotes de T-146 necesitaron una segunda pasada, y uno una tercera.
    for (const p of ['claude_code_recheck_v2', 'claude_code_recheck_v3']) {
      const r = estadoCierre(ids.flatMap((id) => [v(id, 'claude_code'), v(id, p)]), ids)
      expect([p, r.cerrado]).toEqual([p, true])
    }
  })

  it('un proveedor ajeno no acredita ningún paso', () => {
    const r = estadoCierre(ids.flatMap((id) => [v(id, 'openai_gpt'), v(id, 'claude_code_otro')]), ids)
    expect(r.cerrado).toBe(false)
    expect(r.sinPaso7).toEqual(ids)
    expect(r.sinPaso9).toEqual(ids)
  })

  it('señala SOLO las preguntas que faltan, no el lote entero', () => {
    const verif = [v('q1', 'claude_code'), v('q1', 'claude_code_recheck'),
                   v('q2', 'claude_code'), v('q2', 'claude_code_recheck'),
                   v('q3', 'claude_code')]
    const r = estadoCierre(verif, ids)
    expect(r.cerrado).toBe(false)
    expect(r.sinPaso9).toEqual(['q3'])
  })

  it('un lote vacío no se da por cerrado por vacuidad… pero tampoco falla', () => {
    const r = estadoCierre([], [])
    expect(r.cerrado).toBe(true)
    expect(r.motivo).toBeNull()
  })
})
