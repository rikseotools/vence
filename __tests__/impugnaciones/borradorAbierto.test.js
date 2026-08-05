// __tests__/impugnaciones/borradorAbierto.test.js — [T-588]
//
// Que repartir/analizar una impugnación avise si ya hay un borrador esperando OK en el embudo.
// Puro: recibe las filas de session_questions ya leídas, no toca la BD.
//
// Nace del 05/08: la impugnación 2477d39d (Outlook, Ctrl+Mayús+K vs Ctrl+T) la analizaron CUATRO
// sesiones distintas en 2h26min porque nada avisaba de que ya había borrador(es) abiertos.

const { borradoresQueCitan, lineasBorradorAbierto } = require('../../lib/impugnaciones/borradorAbierto.cjs')

const FILAS = [
  { id: 21, sid: 'l3-fedora-2b213d', status: 'open', draft_target: 'impugnación 2477d39d-6353-4389-8a0c-0c9a5d5b27c3 (respuesta_incorrecta, atajo Ctrl+Mayús+K)', asked_at: new Date(Date.now() - 3600_000).toISOString() },
  { id: 39, sid: 'l2-fedora-1d5f83', status: 'open', draft_target: 'impugnación 2477d39d (respuesta_incorrecta: atajo Ctrl+Mayús+K vs T)', asked_at: new Date(Date.now() - 1800_000).toISOString() },
  { id: 62, sid: 'w1-vence-flota-w1', status: 'withdrawn', draft_target: 'impugnación 2477d39d (usuario dice que Ctrl+Mayús+K...)', asked_at: new Date().toISOString() },
  { id: 99, sid: 'l1-otro', status: 'open', draft_target: 'impugnación 744f0db0 (otro caso totalmente distinto)', asked_at: new Date().toISOString() },
]

describe('borradoresQueCitan', () => {
  it('encuentra los borradores ABIERTOS que citan el id completo o el corto', () => {
    const r = borradoresQueCitan(FILAS, '2477d39d-6353-4389-8a0c-0c9a5d5b27c3')
    expect(r.map((x) => x.id).sort()).toEqual([21, 39])
  })

  it('NO cuenta los retirados (withdrawn): ya no son trabajo pendiente', () => {
    const r = borradoresQueCitan(FILAS, '2477d39d-6353-4389-8a0c-0c9a5d5b27c3')
    expect(r.find((x) => x.id === 62)).toBeUndefined()
  })

  it('no arrastra borradores de otro caso', () => {
    const r = borradoresQueCitan(FILAS, '2477d39d-6353-4389-8a0c-0c9a5d5b27c3')
    expect(r.find((x) => x.id === 99)).toBeUndefined()
  })

  it('exige frontera: un id corto dentro de otro hash NO cuenta', () => {
    const filas = [{ id: 1, sid: 's', status: 'open', draft_target: 'algo 2477d39daa11bb22 sin relación', asked_at: new Date().toISOString() }]
    expect(borradoresQueCitan(filas, '2477d39d-6353-4389-8a0c-0c9a5d5b27c3')).toEqual([])
  })

  it('sin id o filas vacías, no revienta', () => {
    expect(borradoresQueCitan([], '2477d39d-6353-4389-8a0c-0c9a5d5b27c3')).toEqual([])
    expect(borradoresQueCitan(FILAS, '')).toEqual([])
    expect(borradoresQueCitan(null, null)).toEqual([])
  })
})

describe('lineasBorradorAbierto', () => {
  it('sin borradores no imprime nada', () => {
    expect(lineasBorradorAbierto([])).toEqual([])
  })

  it('avisa de cuántos hay y de no rediagnosticar', () => {
    const r = borradoresQueCitan(FILAS, '2477d39d-6353-4389-8a0c-0c9a5d5b27c3')
    const txt = lineasBorradorAbierto(r).join('\n')
    expect(txt).toMatch(/2 BORRADORES ABIERTOS/)
    expect(txt).toMatch(/#21/)
    expect(txt).toMatch(/#39/)
    expect(txt).toMatch(/T-588/)
  })

  it('con un solo borrador usa singular y no menciona duplicados', () => {
    const r = borradoresQueCitan(FILAS.slice(0, 1), '2477d39d-6353-4389-8a0c-0c9a5d5b27c3')
    const txt = lineasBorradorAbierto(r).join('\n')
    expect(txt).toMatch(/1 BORRADOR ABIERTO EN/)
    expect(txt).not.toMatch(/T-588/)
  })
})
