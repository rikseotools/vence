/**
 * @jest-environment node
 */
// Unitarios del núcleo que contesta «¿hay alguien desplegando?» (T-404). Importan la función REAL
// que usa `scripts/deploy-estado.cjs`, no una copia.
//
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { clasificarRun, veredicto, procesoVivo } = require('@/lib/deploy/estado.cjs')

const AHORA = new Date('2026-07-31T12:00:00Z')
const hace = (min: number) => new Date(AHORA.getTime() - min * 60_000).toISOString()
const HOST = 'fedora'

const run = (over: Record<string, any> = {}) => ({
  id: 1, surface: 'backend', sha: 'abc1234', slug: 'vence',
  host: HOST, pid: 999, started_at: hace(3), ...over,
})

const vivo = () => undefined                       // process.kill(pid,0) no lanza → vive
const muerto = () => { throw Object.assign(new Error('ESRCH'), { code: 'ESRCH' }) }

describe('procesoVivo — solo se puede afirmar desde la misma máquina', () => {
  it('dice true si el proceso responde', () => {
    expect(procesoVivo({ pid: 1, host: HOST, hostActual: HOST, matar: vivo })).toBe(true)
  })
  it('dice false si ya no está', () => {
    expect(procesoVivo({ pid: 1, host: HOST, hostActual: HOST, matar: muerto })).toBe(false)
  })
  it('EPERM también es "vive" (existe, pero es de otro usuario)', () => {
    const eperm = () => { throw Object.assign(new Error('EPERM'), { code: 'EPERM' }) }
    expect(procesoVivo({ pid: 1, host: HOST, hostActual: HOST, matar: eperm })).toBe(true)
  })
  // «No sé» y «no» no son lo mismo: confundirlos es lo que hace que un marcador rancio se lea
  // como «ocupado» y mande a esperar a alguien que no existe (la lección de los claims zombi).
  it('devuelve null —no false— si el deploy salió de OTRA máquina', () => {
    expect(procesoVivo({ pid: 1, host: 'otra', hostActual: HOST, matar: muerto })).toBeNull()
  })
  it('devuelve null si no hay pid o no se sabe el host', () => {
    expect(procesoVivo({ pid: null, host: HOST, hostActual: HOST })).toBeNull()
    expect(procesoVivo({ pid: 1, host: HOST, hostActual: null })).toBeNull()
  })
})

describe('clasificarRun', () => {
  const opts = (matar: any) => ({ ahora: AHORA, hostActual: HOST, matar })

  it('proceso vivo → en curso, por muy largo que se esté haciendo', () => {
    // Un frontend medido tardó más de 30 min: la antigüedad NO puede desmentir a un proceso vivo.
    const r = clasificarRun(run({ started_at: hace(120) }), opts(vivo))
    expect(r.estado).toBe('en_curso')
    expect(r.minutos).toBe(120)
  })

  it('proceso ausente en la MISMA máquina → muerto (se puede afirmar)', () => {
    expect(clasificarRun(run(), opts(muerto)).estado).toBe('muerto')
  })

  it('sin poder comprobar el proceso y reciente → se le da crédito', () => {
    expect(clasificarRun(run({ host: 'otra', started_at: hace(5) }), opts(muerto)).estado).toBe('en_curso')
  })

  it('sin poder comprobar el proceso y pasado el tiempo de un deploy → sospechoso, no muerto', () => {
    const r = clasificarRun(run({ host: 'otra', started_at: hace(90) }), opts(muerto))
    expect(r.estado).toBe('sospechoso')
    expect(r.motivo).toMatch(/no se puede comprobar/)
  })
})

describe('veredicto — lo que necesita quien va a desplegar', () => {
  const opts = (matar: any) => ({ ahora: AHORA, hostActual: HOST, matar })

  it('sin ejecuciones abiertas → libre', () => {
    expect(veredicto([], opts(vivo)).estado).toBe('libre')
  })

  it('con un deploy vivo → ocupado, y dice cuál y desde cuándo', () => {
    const v = veredicto([run({ started_at: hace(8) })], opts(vivo))
    expect(v.estado).toBe('ocupado')
    expect(v.resumen).toMatch(/backend \(8 min\)/)
  })

  it('filas huérfanas de deploys muertos NO cuentan como ocupado', () => {
    const v = veredicto([run()], opts(muerto))
    expect(v.estado).toBe('libre')
    expect(v.muertos).toHaveLength(1)
    expect(v.resumen).toMatch(/huérfanas/)
  })

  it('lo que no se puede confirmar sale DUDOSO, nunca libre', () => {
    // Prefiere mandarte a mirar antes que dar un verde que no puede sostener. Y no bloquea a
    // nadie: quien impide de verdad el solape sigue siendo el flock.
    const v = veredicto([run({ host: 'otra', started_at: hace(90) })], opts(muerto))
    expect(v.estado).toBe('dudoso')
  })

  it('un vivo manda sobre un sospechoso: si hay alguien seguro, es ocupado', () => {
    const v = veredicto([
      run({ id: 1, host: 'otra', started_at: hace(90) }),
      run({ id: 2, pid: 5, started_at: hace(2) }),
    ], opts(vivo))
    expect(v.estado).toBe('ocupado')
  })

  it('tolera que no le pasen nada', () => {
    expect(veredicto(null, opts(vivo)).estado).toBe('libre')
  })
})
