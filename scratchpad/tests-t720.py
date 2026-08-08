import pathlib

BLOQUE = '''

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
'''

p = pathlib.Path('/home/manuel/vence-sessions/movil3/__tests__/backlog/claseDeEspera.test.ts')
p.write_text(p.read_text().rstrip() + BLOQUE)
print('tests añadidos')
