/**
 * @jest-environment node
 */
// «¿Qué tarea toca ahora?» (T-498). El criterio lo comparten `next` (cuando alguien pregunta) y la
// sugerencia que imprime `done` al cerrar (cuando el contexto está más cargado y a punto de
// tirarse). Dos copias del mismo juicio acaban contestando distinto a la misma pregunta — es como
// nacieron los cinco escritores de `seguimiento_url` de T-130.

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { candidatas } = require('@/lib/backlog/orden.cjs')

const AHORA = new Date('2026-08-03T10:00:00Z')
const t = (over: Record<string, any> = {}) => ({
  id: 'T-001', title: 'x', priority: 'media', status: 'open',
  claimed_by: null, lease_until: null, blocked_by: null, effort: 'rato', ...over,
})
const peso = (e: string) => ({ minutos: 0, rato: 1, larga: 2, sesion_propia: 3 } as any)[e] ?? 99
const run = (rows: any[], opts: Record<string, any> = {}) =>
  candidatas(rows, { ahora: AHORA, pesoEsfuerzo: peso, ...opts }).map((r: any) => r.id)

describe('el orden: prioridad, luego lo más corto, y lo no declarado al final', () => {
  it('la prioridad manda sobre el esfuerzo', () => {
    expect(run([
      t({ id: 'T-1', priority: 'media', effort: 'minutos' }),
      t({ id: 'T-2', priority: 'critica', effort: 'sesion_propia' }),
    ])).toEqual(['T-2', 'T-1'])
  })

  it('a igual prioridad, lo que se cierra antes', () => {
    expect(run([
      t({ id: 'T-1', effort: 'larga' }),
      t({ id: 'T-2', effort: 'minutos' }),
    ])).toEqual(['T-2', 'T-1'])
  })

  // No se puede afirmar que algo sea rápido si nadie lo ha mirado.
  it('lo NO declarado va al final de su prioridad, nunca al principio', () => {
    expect(run([
      t({ id: 'T-1', effort: null }),
      t({ id: 'T-2', effort: 'sesion_propia' }),
    ])).toEqual(['T-2', 'T-1'])
  })
})

describe('lo que NO se sugiere, y cada exclusión viene de un fallo pagado', () => {
  it('lo APARCADO no entra en el reparto', () => {
    expect(run([t({ id: 'T-1', priority: 'ninguna' }), t({ id: 'T-2' })])).toEqual(['T-2'])
  })

  it('lo que espera a un reloj o a un deploy: hoy no hay nada que hacer con ello', () => {
    const enEspera = (r: any) => r.id === 'T-1'
    expect(run([t({ id: 'T-1' }), t({ id: 'T-2' })], { enEspera })).toEqual(['T-2'])
  })

  it('lo bloqueado por otra tarea NUESTRA que sigue abierta', () => {
    expect(run([t({ id: 'T-1', blocked_by: ['T-2'] }), t({ id: 'T-2' })])).toEqual(['T-2'])
  })

  it('…pero si esa dependencia ya no está abierta, deja de bloquear', () => {
    expect(run([t({ id: 'T-1', blocked_by: ['T-999'] })])).toEqual(['T-1'])
  })

  it('el lease VIVO de otra sesión no se pisa', () => {
    const viva = new Date(AHORA.getTime() + 30 * 60_000).toISOString()
    expect(run([t({ id: 'T-1', claimed_by: 'otra', lease_until: viva }), t({ id: 'T-2' })])).toEqual(['T-2'])
  })

  it('…pero un lease VENCIDO vuelve al pool', () => {
    const muerta = new Date(AHORA.getTime() - 60 * 60_000).toISOString()
    expect(run([t({ id: 'T-1', claimed_by: 'otra', lease_until: muerta })])).toEqual(['T-1'])
  })

  it('la que tengo YO sí se sugiere: la tengo yo', () => {
    const viva = new Date(AHORA.getTime() + 30 * 60_000).toISOString()
    expect(run([t({ id: 'T-1', claimed_by: 'yo', lease_until: viva })], { sid: 'yo' })).toEqual(['T-1'])
  })

  // Sugerir al cerrar la tarea que se acaba de cerrar sería ridículo, y pasa si no se excluye.
  it('lo excluido no se sugiere (la recién cerrada)', () => {
    expect(run([t({ id: 'T-1' }), t({ id: 'T-2' })], { excluir: ['T-1'] })).toEqual(['T-2'])
  })
})

describe('robustez: sugerir no puede reventar', () => {
  it.each([[null], [undefined], [[]]])('sin filas devuelve lista vacía (%s)', (rows) => {
    expect(candidatas(rows as any, {})).toEqual([])
  })

  it('una prioridad desconocida no se cuela por delante de una crítica', () => {
    expect(run([t({ id: 'T-1', priority: 'inventada' }), t({ id: 'T-2', priority: 'critica' })])).toEqual(['T-2', 'T-1'])
  })
})
