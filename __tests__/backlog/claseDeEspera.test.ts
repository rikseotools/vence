/**
 * @jest-environment node
 *
 * [T-629] El cajón 🙋 se presenta entero como «esperando tu decisión», y no lo está.
 *
 * Medido el 06/08/2026: de 24 revisadas, **6 no esperaban ninguna decisión** — decían «CÓDIGO
 * COMPLETO… PERO NO SE HA PODIDO PUSHEAR», o sea que esperaban una tubería ([T-628]), no un
 * criterio. Mientras estén mezcladas, la cola no se puede vaciar por partes.
 *
 * La asimetría manda el sentido del corte: un falso «solo mergear» cuesta una mirada; un falso
 * «solo cerrar» cierra algo cuyo código no está vivo.
 */
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { claseDeEspera } = require('../../lib/backlog/revision.cjs')
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { idsDeclarados } = require('../../lib/backlog/ramasDeTarea.cjs')

describe('[T-629] claseDeEspera', () => {
  it('un veredicto con PROBLEMAS es criterio, aunque no haya ramas', () => {
    expect(claseDeEspera({ review_verdict: 'problemas' }, { ramasSinFusionar: 0 }).clase).toBe('criterio')
  })

  it('superficie servida es criterio aunque el merge sea trivial', () => {
    // Mismo criterio que la puerta del `done` (T-392): lo que llega al usuario lo decide alguien.
    expect(claseDeEspera({ review_verdict: 'ok' }, { ramasSinFusionar: 0, tocaServido: true }).clase).toBe('criterio')
  })

  it('con ramas sin fusionar que la declaran → solo_mergear', () => {
    const c = claseDeEspera({ review_verdict: 'ok' }, { ramasSinFusionar: 2 })
    expect(c.clase).toBe('solo_mergear')
    expect(c.motivo).toMatch(/2 rama/)
  })

  it('sin ninguna rama que la declare → solo_cerrar', () => {
    expect(claseDeEspera({ review_verdict: 'ok' }, { ramasSinFusionar: 0 }).clase).toBe('solo_cerrar')
  })

  it('SIN MEDIR va a criterio, no a «solo cerrar»', () => {
    // Es el criterio de [T-615]: cuando no se ha podido comprobar, no se emite el veredicto
    // tranquilizador. Aquí el tranquilizador sería «solo falta cerrarla».
    const c = claseDeEspera({ review_verdict: 'ok' }, {})
    expect(c.clase).toBe('criterio')
    expect(c.motivo).toMatch(/no se ha podido mirar/)
  })

  it('el motivo NO afirma más de lo comprobado', () => {
    // Se comprueba que una rama sin fusionar la DECLARA; no que su código falte en main (la rama
    // puede traer trabajo de otras tareas). Redactarlo de más es cómo un panel empieza a mentir.
    const c = claseDeEspera({ review_verdict: 'ok' }, { ramasSinFusionar: 1 })
    expect(c.motivo).toMatch(/declaran/)
    expect(c.motivo).not.toMatch(/no está en main/)
  })
})

describe('[T-629] idsDeclarados — la tarea la dice el ASUNTO del commit', () => {
  it('EL FALLO MEDIDO: el nombre de la rama no basta', () => {
    // La primera versión buscaba el id en el NOMBRE de la rama y dio 25 «solo cerrar» falsos:
    // las ramas rescatadas del VPS se llaman `rescate/vps-sesion-w4-<sha>` y no llevan el id.
    // Lo fiable es la convención del repo: el asunto declara la tarea.
    expect([...idsDeclarados('fix(T-543): el detector no emitía nada')]).toEqual(['T-543'])
  })

  it('coge varias y no se inventa ninguna', () => {
    expect([...idsDeclarados('fix(T-1, T-22): x\ndocs(T-333): y')].sort()).toEqual(['T-1', 'T-22', 'T-333'])
    expect([...idsDeclarados('sin ids aquí')]).toEqual([])
  })

  it('no casa dentro de otra palabra', () => {
    expect([...idsDeclarados('XT-543y')]).toEqual([])
  })
})

// ── EL REPARTO DE LAS REVISADAS (T-720) ─────────────────────────────────────────────────────
// `reviewed_at` se pone y no se quita nunca, así que una tarea mergeada al minuto siguiente
// seguía saliendo como pendiente para siempre: medido el 08/08, **29 de 36 ya estaban en main**.
// Lo que se prueba aquí es el REPARTO, no el criterio (ese ya está probado arriba) — y sobre todo
// que la asimetría se respeta: sin poder medir, NADA se da por integrado.
describe('repartirRevisadas — separa lo ya integrado de lo que pide mirar el merge', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { repartirRevisadas } = require('@/lib/backlog/revision.cjs')
  const revisada = (id: string, verdict = 'ok') => ({ id, review_verdict: verdict })

  it('sin rama que la declare → integrada', () => {
    const r = repartirRevisadas([revisada('T-1')], () => ({ ramasSinFusionar: 0 }))
    expect(r.integradas.map((t: { id: string }) => t.id)).toEqual(['T-1'])
    expect(r.pendientes).toEqual([])
  })

  it('con rama sin fusionar → pendiente de mirar el merge', () => {
    const r = repartirRevisadas([revisada('T-2')], () => ({ ramasSinFusionar: 2, ramas: ['a', 'b'] }))
    expect(r.pendientes.map((t: { id: string }) => t.id)).toEqual(['T-2'])
    expect(r.integradas).toEqual([])
  })

  it('SIN PODER MEDIR no se da por integrada — la asimetría manda', () => {
    // Un falso «pendiente» cuesta una mirada; un falso «ya está en main» cierra algo cuyo código
    // no está vivo. Por eso «no se pudo mirar git» cae SIEMPRE del lado que mira una persona.
    for (const hechos of [{}, undefined, null]) {
      const r = repartirRevisadas([revisada('T-3')], () => hechos)
      expect(r.integradas).toEqual([])
      expect(r.pendientes.map((t: { id: string }) => t.id)).toEqual(['T-3'])
    }
  })

  it('una devuelta con PROBLEMAS nunca se da por integrada, tenga rama o no', () => {
    // Lo que pide no es un merge: es que alguien lea el veredicto.
    const r = repartirRevisadas([revisada('T-4', 'problemas')], () => ({ ramasSinFusionar: 0 }))
    expect(r.integradas).toEqual([])
    expect(r.pendientes.map((t: { id: string }) => t.id)).toEqual(['T-4'])
  })

  it('si la consulta a git revienta, la tarea no se pierde ni se da por integrada', () => {
    const r = repartirRevisadas([revisada('T-5')], () => { throw new Error('git roto') })
    expect(r.integradas).toEqual([])
    expect(r.pendientes.map((t: { id: string }) => t.id)).toEqual(['T-5'])
  })

  it('reparte TODAS: ninguna se queda fuera de los dos montones', () => {
    const tareas = ['T-6', 'T-7', 'T-8'].map((id) => revisada(id))
    const r = repartirRevisadas(tareas, (id: string) => ({ ramasSinFusionar: id === 'T-7' ? 1 : 0 }))
    expect(r.integradas.length + r.pendientes.length).toBe(3)
    expect(r.integradas.map((t: { id: string }) => t.id)).toEqual(['T-6', 'T-8'])
  })

  it('lista vacía o nula no revienta', () => {
    expect(repartirRevisadas([], () => ({}))).toEqual({ integradas: [], pendientes: [] })
    expect(repartirRevisadas(null, () => ({}))).toEqual({ integradas: [], pendientes: [] })
  })
})
