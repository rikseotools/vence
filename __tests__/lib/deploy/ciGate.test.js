// Tests del veredicto de CI que decide si un commit puede desplegarse.
//
// Cada caso viene de un deploy REAL que se bloqueó o se coló. La regla de oro: `rojo` solo cuando
// el código falla de verdad — si el veredicto se equivoca hacia rojo, paraliza a todas las sesiones
// (pasó tres veces el 27/07); si se equivoca hacia verde, despliega algo que no compila.

const { clasificarCiCodigo, puedeDesplegar, accionSugerida } = require('../../../lib/deploy/ciGate')

const run = (name, status, conclusion) => ({ name, status, conclusion })
const verde = () => [
  run('Unit tests', 'completed', 'success'),
  run('Typecheck', 'completed', 'success'),
  run('Lint', 'completed', 'success'),
]

describe('clasificarCiCodigo', () => {
  it('VERDE con los tres checks de código en success', () => {
    const r = clasificarCiCodigo(verde())
    expect(r.estado).toBe('verde')
    expect(puedeDesplegar(verde())).toBe(true)
  })

  it('`integration` en rojo NO bloquea: es señal aparte (pega a la BD real)', () => {
    const runs = [...verde(), run('Integration / perf / security', 'completed', 'failure')]
    expect(clasificarCiCodigo(runs).estado).toBe('verde')
  })

  it('ROJO cuando un check de código falla', () => {
    const runs = [run('Unit tests', 'completed', 'success'), run('Typecheck', 'completed', 'failure'), run('Lint', 'completed', 'success')]
    const r = clasificarCiCodigo(runs)
    expect(r.estado).toBe('rojo')
    expect(r.detalle).toContain('typecheck')
  })

  it('ROJO también con timed_out (un check que no termina es un check que no pasa)', () => {
    const runs = [run('Unit tests', 'completed', 'timed_out'), run('Typecheck', 'completed', 'success'), run('Lint', 'completed', 'success')]
    expect(clasificarCiCodigo(runs).estado).toBe('rojo')
  })

  // EL CASO QUE COSTÓ TRES DEPLOYS (27/07) Y UNO MÁS EL 28/07.
  it('CANCELADO ≠ rojo: GitHub cancela el run cuando llega otro push', () => {
    const runs = [run('Unit tests', 'completed', 'cancelled'), run('Typecheck', 'completed', 'success'), run('Lint', 'completed', 'success')]
    const r = clasificarCiCodigo(runs)
    expect(r.estado).toBe('cancelado')
    expect(r.estado).not.toBe('rojo')
    expect(r.motivo).toMatch(/NO es un fallo/)
    // …y la reacción correcta NO es abortar, es volver a apuntar al HEAD nuevo.
    expect(accionSugerida(r.estado)).toEqual({ accion: 'resincronizar', reintentable: true })
  })

  it('un fallo REAL manda sobre un cancelado (precedencia rojo > cancelado)', () => {
    const runs = [run('Unit tests', 'completed', 'cancelled'), run('Typecheck', 'completed', 'failure'), run('Lint', 'completed', 'success')]
    expect(clasificarCiCodigo(runs).estado).toBe('rojo')
  })

  it('EN CURSO mientras algún check siga corriendo', () => {
    const runs = [run('Unit tests', 'in_progress', null), run('Typecheck', 'completed', 'success'), run('Lint', 'completed', 'success')]
    const r = clasificarCiCodigo(runs)
    expect(r.estado).toBe('curso')
    expect(accionSugerida(r.estado).accion).toBe('esperar')
  })

  it('FALTAN si el commit no está pusheado (sin runs) — no se despliega a ciegas', () => {
    expect(clasificarCiCodigo([]).estado).toBe('faltan')
    expect(clasificarCiCodigo(undefined).estado).toBe('faltan')
    expect(puedeDesplegar([])).toBe(false)
  })

  it('FALTAN si publica solo parte de los checks de código', () => {
    const r = clasificarCiCodigo([run('Unit tests', 'completed', 'success')])
    expect(r.estado).toBe('faltan')
    expect(r.detalle).toEqual(expect.arrayContaining(['typecheck', 'lint']))
  })

  it('casa por substring y se queda con el ÚLTIMO run (igual que el jq del script)', () => {
    // GitHub publica varios runs con el mismo nombre al reintentar: manda el último.
    const runs = [
      run('Unit tests', 'completed', 'failure'),
      run('Unit tests', 'completed', 'success'),
      run('Typecheck (node 22)', 'completed', 'success'),
      run('Lint', 'completed', 'success'),
    ]
    expect(clasificarCiCodigo(runs).estado).toBe('verde')
  })

  it('ante un estado desconocido NO despliega (fail-safe)', () => {
    expect(accionSugerida('marciano')).toEqual({ accion: 'abortar', reintentable: false })
  })
})
