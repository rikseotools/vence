// El orden en que se atiende la cola de feedback (fijado por Manuel, 30/07/2026).
//
// Bugs → free en pre-venta → resto de premium → bajas.
//
// El puesto que sorprende es el segundo, y es el que más importa: **un free preguntando
// antes de comprar va por delante de un premium**. No se fía todavía y está midiendo dos
// cosas a la vez, si el producto es serio y cuánto tardamos en contestar. Quien ya paga
// tiene margen para esperar unas horas; quien está decidiendo se va a otro sitio y no
// vuelve.
//
// Estaba solo en prosa dentro del manual, y un orden escrito en prosa se aplica «casi
// siempre».
const { clasificar, ordenarCola, tieneSenalDeCompra } = require('@/lib/feedback/prioridadCola')

const f = (o) => ({ created_at: '2026-07-30T09:00:00Z', ...o })

describe('clasificar un feedback', () => {
  it('un bug es bug, pague o no pague', () => {
    expect(clasificar(f({ type: 'bug', plan: 'free' }))).toBe('bug')
    expect(clasificar(f({ type: 'bug', plan: 'premium' }))).toBe('bug')
  })

  it('la baja de cuenta es baja aunque sea de un premium', () => {
    expect(clasificar(f({ type: 'account_deletion', plan: 'premium' }))).toBe('baja')
  })

  it('un free que no reporta fallo es PRE-VENTA, dé señal explícita o no', () => {
    expect(clasificar(f({ type: 'suggestion', plan: 'free', message: '¿tenéis la oposición de Correos?' }))).toBe('preventa')
    expect(clasificar(f({ type: 'other', plan: 'free', message: 'hola, una duda del tema 3' }))).toBe('preventa')
  })

  it('un premium que no reporta fallo es premium', () => {
    expect(clasificar(f({ type: 'suggestion', plan: 'premium', message: 'estaría bien poder filtrar' }))).toBe('premium')
  })
})

describe('el orden de la cola', () => {
  it('bug → pre-venta → premium → baja, por encima de la antigüedad', () => {
    const cola = ordenarCola([
      f({ id: 'baja', type: 'account_deletion', plan: 'premium', created_at: '2026-07-01' }),
      f({ id: 'premium', type: 'suggestion', plan: 'premium', created_at: '2026-07-02' }),
      f({ id: 'preventa', type: 'other', plan: 'free', message: '¿cuánto cuesta?', created_at: '2026-07-03' }),
      f({ id: 'bug', type: 'bug', plan: 'free', created_at: '2026-07-04' }),
    ])
    expect(cola.map((x) => x.id)).toEqual(['bug', 'preventa', 'premium', 'baja'])
  })

  it('un free que pregunta antes de comprar adelanta a un premium más antiguo', () => {
    const cola = ordenarCola([
      f({ id: 'premium-viejo', type: 'other', plan: 'premium', created_at: '2026-07-01' }),
      f({ id: 'free-nuevo', type: 'other', plan: 'free', message: '¿el temario está completo?', created_at: '2026-07-29' }),
    ])
    expect(cola[0].id).toBe('free-nuevo')
  })

  it('dentro del mismo grupo manda quien lleva más esperando', () => {
    const cola = ordenarCola([
      f({ id: 'nuevo', type: 'bug', plan: 'premium', created_at: '2026-07-30' }),
      f({ id: 'viejo', type: 'bug', plan: 'premium', created_at: '2026-07-28' }),
    ])
    expect(cola.map((x) => x.id)).toEqual(['viejo', 'nuevo'])
  })

  it('dentro de pre-venta, quien dice que está sopesando comprar va primero', () => {
    const cola = ordenarCola([
      f({ id: 'duda', type: 'other', plan: 'free', message: 'no encuentro el tema 4', created_at: '2026-07-01' }),
      f({ id: 'compra', type: 'other', plan: 'free', message: '¿tenéis test de mi oposición?', created_at: '2026-07-29' }),
    ])
    expect(cola[0].id).toBe('compra')
  })

  it('la baja va la última aunque sea la más antigua de todas', () => {
    const cola = ordenarCola([
      f({ id: 'baja', type: 'account_deletion', plan: 'premium', created_at: '2020-01-01' }),
      f({ id: 'otro', type: 'other', plan: 'premium', created_at: '2026-07-30' }),
    ])
    expect(cola.map((x) => x.id)).toEqual(['otro', 'baja'])
  })

  it('cola vacía o nula no rompe', () => {
    expect(ordenarCola([])).toEqual([])
    expect(ordenarCola(null)).toEqual([])
  })

  it('las señales de compra reconocen las preguntas típicas de quien aún no paga', () => {
    for (const t of [
      '¿tenéis la oposición de auxiliar administrativo?',
      '¿cuánto cuesta la suscripción?',
      '¿el temario está completo?',
      '¿tenéis supuestos prácticos?',
      'antes de pagar quería saber si me sirve',
    ]) {
      expect(tieneSenalDeCompra(t)).toBe(true)
    }
    expect(tieneSenalDeCompra('la pregunta 34 del tema 2 está mal')).toBe(false)
  })
})
