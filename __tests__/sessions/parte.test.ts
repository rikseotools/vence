/**
 * @jest-environment node
 */
// El PARTE de sesiones (T-494): «¿quién está parado?».
//
// Esa pregunta no vive en ninguna tabla — es el CRUCE de `backlog_tasks` (quién tiene qué) con
// `worktree_sessions` (quién da señal). `list` pintaba la tarea como cogida, `latidos` pintaba la
// sesión como dormida, y nadie ataba los dos cabos.

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { cruzarTrabajo, sesionesOciosas, veredicto, CALLADA_MIN } = require('@/lib/sessions/parte.cjs')

const AHORA = new Date('2026-08-02T20:00:00Z')
const haceMin = (m: number) => new Date(AHORA.getTime() - m * 60_000).toISOString()
const tarea = (over: Record<string, any> = {}) => ({
  id: 'T-1', title: 'Una tarea', claimed_by: 'sid-a', claimed_at: haceMin(60),
  lease_until: new Date(AHORA.getTime() + 30 * 60_000).toISOString(), ...over,
})
const sesion = (over: Record<string, any> = {}) => ({
  sid: 'sid-a', slug: 'wt-a', host: 'fedora', last_signal_at: haceMin(2), ...over,
})
const run = (t: any[], s: any[]) => cruzarTrabajo(t, s, { ahora: AHORA })

describe('cruzarTrabajo — lo normal no molesta', () => {
  it('sesión viva con su tarea: trabajando, no es un problema', () => {
    const { trabajando, paradas } = run([tarea()], [sesion()])
    expect(paradas).toEqual([])
    expect(trabajando).toHaveLength(1)
    expect(trabajando[0]).toMatchObject({ id: 'T-1', slug: 'wt-a', host: 'fedora' })
  })

  it('una tarea sin dueño no entra (no la tiene nadie)', () => {
    expect(run([tarea({ claimed_by: null })], [sesion()]).trabajando).toEqual([])
  })
})

describe('cruzarTrabajo — las TRES formas de estar parado, que no son la misma', () => {
  it('la sesión existe y calla → «parada»', () => {
    const { paradas } = run([tarea()], [sesion({ last_signal_at: haceMin(CALLADA_MIN + 10) })])
    expect(paradas[0]).toMatchObject({ motivo: 'parada' })
    expect(paradas[0].detalle).toContain('calla desde')
  })

  it('además con el lease vencido → dice que `reap` ya puede segarla', () => {
    const { paradas } = run(
      [tarea({ lease_until: haceMin(10) })],
      [sesion({ last_signal_at: haceMin(200) })],
    )
    expect(paradas[0].motivo).toBe('lease_vencido')
    expect(paradas[0].detalle).toContain('reap')
  })

  // Convertir un desconocido en veredicto es el error que este andamiaje evita en todas sus
  // piezas: puede ser un CLI viejo que no late, no necesariamente una sesión muerta.
  it('la sesión NUNCA latió → «desaparecida», y se dice, no se supone', () => {
    const { paradas } = run([tarea()], [])
    expect(paradas[0]).toMatchObject({ motivo: 'desaparecida' })
    expect(paradas[0].detalle).toContain('nunca ha dado señal')
  })

  it('las paradas salen ordenadas por lo que más llevan calladas', () => {
    const { paradas } = run(
      [tarea({ id: 'T-1' }), tarea({ id: 'T-2', claimed_by: 'sid-b' }), tarea({ id: 'T-3', claimed_by: 'sid-c' })],
      [
        sesion({ sid: 'sid-a', last_signal_at: haceMin(60) }),
        sesion({ sid: 'sid-b', last_signal_at: haceMin(600) }),
        sesion({ sid: 'sid-c', last_signal_at: haceMin(120) }),
      ],
    )
    expect(paradas.map((p: any) => p.id)).toEqual(['T-2', 'T-3', 'T-1'])
  })

  it('justo en el umbral todavía no es una parada (el corte no puede ser ansioso)', () => {
    expect(run([tarea()], [sesion({ last_signal_at: haceMin(CALLADA_MIN - 1) })]).paradas).toEqual([])
  })
})

describe('sesionesOciosas — brazos libres', () => {
  it('viva y sin tarea cogida', () => {
    const o = sesionesOciosas([tarea()], [sesion(), sesion({ sid: 'sid-libre', slug: 'wt-libre' })], { ahora: AHORA })
    expect(o.map((x: any) => x.sid)).toEqual(['sid-libre'])
  })

  it('una sesión dormida NO es un brazo libre: no está', () => {
    expect(sesionesOciosas([], [sesion({ sid: 'z', last_signal_at: haceMin(500) })], { ahora: AHORA })).toEqual([])
  })
})

describe('veredicto — la línea que se lee primero', () => {
  const base = { paradas: [], trabajando: [{}], preguntas: [], sesionesConSenal: 3 }

  it('lo que MANDA es una sesión parada esperando respuesta', () => {
    const v = veredicto({ ...base, preguntas: [{ status: 'open', blocking: true }] })
    expect(v.icono).toBe('🔴')
    expect(v.frase).toContain('esperando que contestes')
  })

  it('sin bloqueantes, manda lo que está sin señal', () => {
    expect(veredicto({ ...base, paradas: [{}, {}] }).icono).toBe('🟠')
  })

  it('preguntas sin bloquear: amarillo, y dice que nadie está parado', () => {
    expect(veredicto({ ...base, preguntas: [{ status: 'open' }] })).toMatchObject({ icono: '🟡' })
  })

  it('todo en marcha → verde', () => {
    expect(veredicto(base).icono).toBe('🟢')
  })

  // Un parte que dice «todo bien» cuando no ha podido mirar es la peor mentira posible: se lee
  // como calma y es ceguera.
  it('sin NINGUNA señal no dice verde: dice que no se sabe', () => {
    const v = veredicto({ ...base, sesionesConSenal: 0 })
    expect(v.icono).toBe('⚪')
    expect(v.frase).toContain('no se puede afirmar')
  })
})
