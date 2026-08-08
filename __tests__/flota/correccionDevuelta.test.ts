/**
 * [T-700] Una entrega devuelta con `problemas` tiene que poder llegarle a alguien.
 *
 * El defecto que esto fija no era un fallo: era una AUSENCIA. El reparto tenía tres ramas
 * (revisar / retomar lo propio / tarea nueva) y una devolución se caía de las tres a la vez, así
 * que 20 tareas se quedaron paradas hasta 28,5 h sin que nada fallara ni avisara. Por eso lo que
 * se prueba aquí no es «el código nuevo funciona», sino **que ese estado es alcanzable**.
 */
const ENC = require('../../lib/flota/encargo.cjs')
const REV = require('../../lib/backlog/revision.cjs')

const ENTREGADA = {
  id: 'T-999',
  title: 'Una tarea cualquiera',
  review_requested_at: new Date('2026-08-07T10:00:00Z'),
  review_note: 'entrego esto y aquello, con su medida',
}
const DEVUELTA = {
  ...ENTREGADA,
  reviewed_at: new Date('2026-08-07T18:00:00Z'),
  reviewed_by: 'w2-vence-flota',
  review_verdict: 'problemas',
  review_findings: 'falta la capa de test\ny la cifra no se reprodujo',
  claimed_by: null,
}

describe('[T-700] esCorreccionPendiente — el criterio del reparto', () => {
  it('reconoce la devuelta con problemas y sin dueño', () => {
    expect(ENC.esCorreccionPendiente(DEVUELTA)).toBe(true)
  })

  it('NO delega en un criterio propio: coincide con `devueltaConProblemas` en todos los casos', () => {
    // Es el punto de la ficha: cuatro sitios decidiendo por su cuenta qué es una devolución es
    // como nacieron las dos puertas que se contradicen de [T-665].
    const casos = [
      DEVUELTA,
      { ...DEVUELTA, review_verdict: 'ok' },
      { ...ENTREGADA, claimed_by: null },          // entregada, aún sin veredicto
      { ...DEVUELTA, review_requested_at: null },  // veredicto huérfano, sin entrega
    ]
    for (const c of casos) {
      expect(ENC.esCorreccionPendiente(c)).toBe(REV.devueltaConProblemas(c))
    }
  })

  it('no se la quita a quien ya la tiene cogida', () => {
    expect(REV.devueltaConProblemas({ ...DEVUELTA, claimed_by: 'w4-vence-flota' })).toBe(true)
    expect(ENC.esCorreccionPendiente({ ...DEVUELTA, claimed_by: 'w4-vence-flota' })).toBe(false)
  })

  it('no revienta con una fila vacía ni con null', () => {
    expect(ENC.esCorreccionPendiente(null)).toBe(false)
    expect(ENC.esCorreccionPendiente({})).toBe(false)
  })
})

describe('[T-700] encargoCorreccion — que no la rehaga desde cero', () => {
  const texto = ENC.encargoCorreccion({
    trabajador: 'w3', tarea: DEVUELTA,
    hallazgos: DEVUELTA.review_findings, revisor: DEVUELTA.reviewed_by,
  })

  it('dice explícitamente que NO es una tarea nueva', () => {
    expect(texto).toMatch(/no es una tarea nueva/i)
    expect(texto).toMatch(/No empieces de cero/i)
  })

  it('lleva los hallazgos ENTEROS, que son su lista de trabajo', () => {
    // Recortarlos por el final es cortar justo los problemas: un veredicto empieza por lo que
    // está bien y termina por lo que falla ([T-518]).
    for (const linea of DEVUELTA.review_findings.split('\n')) {
      expect(texto).toContain(linea)
    }
  })

  it('sobrevive a un veredicto largo sin truncarlo', () => {
    const largo = 'x'.repeat(4600)
    const t = ENC.encargoCorreccion({ trabajador: 'w1', tarea: DEVUELTA, hallazgos: largo })
    expect(t).toContain(largo)
  })

  it('dice quién la revisó y cómo volver a entregarla', () => {
    expect(texto).toContain('w2-vence-flota')
    expect(texto).toContain(`revision ${DEVUELTA.id}`)
  })

  it('permite discrepar, pero con prueba — no en silencio', () => {
    expect(texto).toMatch(/NO es cierto[\s\S]*prueba/i)
  })

  it('trae el método de la casa, igual que los otros dos encargos', () => {
    const { METODO } = require('../../lib/sessions/recordatorio.cjs')
    expect(texto).toContain(METODO[0])
  })

  it('no se queda mudo si el veredicto llegó vacío', () => {
    const t = ENC.encargoCorreccion({ trabajador: 'w1', tarea: DEVUELTA, hallazgos: '' })
    expect(t).toMatch(/sin hallazgos registrados/i)
  })
})

describe('[T-700] el reparto tiene una rama para ellas', () => {
  const fs = require('fs')
  const path = require('path')
  const fuente = fs.readFileSync(
    path.join(__dirname, '..', '..', 'scripts', 'flota', 'flota.cjs'), 'utf8')

  it('usa el criterio compartido y el encargo propio, no el normal', () => {
    expect(fuente).toContain('ENC.esCorreccionPendiente')
    expect(fuente).toContain('ENC.encargoCorreccion')
  })

  it('la busca SIN exigir `status = open`, que es lo que la dejaba fuera', () => {
    // La devuelta se queda en `in_progress`: si la consulta nueva copiara ese filtro de
    // `candidatas`, el arreglo no arreglaría nada y los tests seguirían en verde.
    const bloque = fuente.slice(fuente.indexOf("review_verdict = 'problemas'"))
      .slice(0, 400)
    expect(bloque).not.toMatch(/status\s*=\s*'open'/)
  })
})
