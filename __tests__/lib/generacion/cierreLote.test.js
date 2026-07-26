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

// ── LA CONTRAPARTE DE ESCRITURA (26/07/2026) ──
// `estadoCierre` decide; faltaba validar lo que se ESCRIBE. La causa de fondo de que el Paso 9 se
// saltara es que no tenía herramienta: el manual lo documentaba como un insert a mano (y con el
// cliente de Supabase, obsoleto tras el cutover a RDS). Medido: los 11 lotes ATC del 26/07 tenían
// Paso 7 y ninguno Paso 9, aun habiéndose corrido el re-check en siete.
const { validarVeredictosPaso9, MIN_HALLAZGO } = require('@/lib/generacion/cierreLote')

const A = '11111111-1111-1111-1111-111111111111'
const B = '22222222-2222-2222-2222-222222222222'
const AJENO = '99999999-9999-9999-9999-999999999999'
const HALLAZGO = 'Clave literal y blockquote verbatim; ningún distractor defendible.'

describe('validarVeredictosPaso9', () => {
  it('acepta un veredicto completo con Paso 7 previo', () => {
    const r = validarVeredictosPaso9(
      [{ questionId: A, limpia: true, hallazgo: HALLAZGO }], [A], new Set([A]),
    )
    expect(r.ok).toBe(true)
    expect(r.escribibles).toHaveLength(1)
    expect(r.faltantes).toEqual([])
  })

  // La guarda que de verdad importa: los batch_id se componen a mano y ya hubo una colisión entre
  // sesiones, así que un registrador laxo acreditaría como auditado el trabajo de otra sesión.
  it('RECHAZA un veredicto de una pregunta que no es del lote', () => {
    const r = validarVeredictosPaso9(
      [{ questionId: AJENO, limpia: true, hallazgo: HALLAZGO }], [A], new Set([A, AJENO]),
    )
    expect(r.ok).toBe(false)
    expect(r.errores.join(' ')).toMatch(/no pertenece a este lote/)
    expect(r.escribibles).toEqual([])
  })

  it('RECHAZA acreditar un Paso 9 sobre una pregunta sin Paso 7', () => {
    const r = validarVeredictosPaso9(
      [{ questionId: A, limpia: true, hallazgo: HALLAZGO }], [A], new Set(),
    )
    expect(r.ok).toBe(false)
    expect(r.errores.join(' ')).toMatch(/no tiene Paso 7/)
  })

  it('RECHAZA un hallazgo trivial: registrar un paso no hecho debe costar mentir por escrito', () => {
    const r = validarVeredictosPaso9(
      [{ questionId: A, limpia: true, hallazgo: 'ok' }], [A], new Set([A]),
    )
    expect(r.ok).toBe(false)
    expect(r.errores.join(' ')).toMatch(new RegExp(String(MIN_HALLAZGO)))
  })

  it('RECHAZA el veredicto duplicado y el que viene sin veredicto booleano', () => {
    const dup = validarVeredictosPaso9(
      [{ questionId: A, limpia: true, hallazgo: HALLAZGO }, { questionId: A, limpia: false, hallazgo: HALLAZGO }],
      [A], new Set([A]),
    )
    expect(dup.errores.join(' ')).toMatch(/duplicado/)
    const sinV = validarVeredictosPaso9([{ questionId: A, hallazgo: HALLAZGO }], [A], new Set([A]))
    expect(sinV.errores.join(' ')).toMatch(/falta el veredicto/)
  })

  // El registro parcial es legítimo (el re-check suele mirar solo las reparadas) pero NUNCA
  // silencioso: si no se ven las que faltan, un lote a medias parece cerrado.
  it('permite el registro PARCIAL pero lista lo que queda sin acreditar', () => {
    const r = validarVeredictosPaso9(
      [{ questionId: A, limpia: true, hallazgo: HALLAZGO }], [A, B], new Set([A, B]),
    )
    expect(r.ok).toBe(true)
    expect(r.faltantes).toEqual([B])
  })

  it('un lote sin ningún veredicto escribible no es ok (no se escribe nada)', () => {
    expect(validarVeredictosPaso9([], [A], new Set([A])).ok).toBe(false)
  })
})
