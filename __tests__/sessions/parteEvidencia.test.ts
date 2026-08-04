/**
 * @jest-environment node
 */
// «Verde porque lo comprobé» ≠ «verde porque estoy ciego». (T-539, pieza 3)
//
// El parte dice quién trabaja y quién calla. Lo que no podía decir es si lo que enseña es de FIAR:
// una sesión que no alcanza la BD de coordinación no aparece peor, aparece MENOS —ni siquiera
// late— y los guardarraíles que dependen de esa BD la dejan pasar sin comprobar nada.
//
// Con el `rol` en el latido y el veredicto del preflight en el bus, cruzarlos basta. La asimetría
// es deliberada: que una PERSONA no haya hecho preflight es lo normal y no se marca — un aviso que
// ladra a todo el mundo se deja de mirar en una tarde, que es como murieron tres guardarraíles el
// 31/07. Que un TRABAJADOR no lo haya hecho es justo lo que hay que ver.
//
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { evidenciaSesiones, diagnosticoEvidencia, EVIDENCIA_VALIDA_MIN } = require('@/lib/sessions/parte.cjs')

const AHORA = new Date('2026-08-04T12:00:00Z')
const haceMin = (m: number) => new Date(AHORA.getTime() - m * 60_000).toISOString()

const ses = (over: Record<string, any> = {}) => ({ sid: 's1', slug: 'una', rol: null, ...over })
const pre = (over: Record<string, any> = {}) => ({ sid: 's1', veredicto: 'completo', ts: haceMin(5), ...over })
const run = (sesiones: any[], preflights: any[] = []) =>
  evidenciaSesiones(sesiones, preflights, { ahora: AHORA })

describe('estado de evidencia', () => {
  it('preflight reciente y completo → verificada', () => {
    expect(run([ses()], [pre()])[0]).toMatchObject({ estado: 'verificada', alarma: false })
  })

  it('preflight que salió incompleto → incompleta', () => {
    expect(run([ses()], [pre({ veredicto: 'incompleto_avisado' })])[0]).toMatchObject({ estado: 'incompleta' })
  })

  it('sin preflight → «no se sabe», que NO es lo mismo que «mal»', () => {
    expect(run([ses()])[0]).toMatchObject({ estado: 'sin_evidencia', veredicto: null })
  })

  it('un preflight viejo ya no es evidencia: un veredicto de ayer no dice nada de hoy', () => {
    expect(run([ses()], [pre({ ts: haceMin(EVIDENCIA_VALIDA_MIN + 10) })])[0].estado).toBe('sin_evidencia')
  })

  it('de varios preflights se queda con el ÚLTIMO', () => {
    const r = run([ses()], [pre({ veredicto: 'incompleto_avisado', ts: haceMin(30) }), pre({ ts: haceMin(2) })])
    expect(r[0]).toMatchObject({ estado: 'verificada' })
  })
})

// La asimetría es la decisión de diseño, no un detalle de presentación.
describe('la ALARMA solo se enciende para un trabajador', () => {
  it('persona sin evidencia: NO es alarma (es lo normal)', () => {
    expect(run([ses({ rol: null })])[0].alarma).toBe(false)
    expect(diagnosticoEvidencia(run([ses({ rol: null })])[0])).toBeNull()
  })

  it('TRABAJADOR sin evidencia: alarma, porque nadie sabe si puede trabajar', () => {
    const e = run([ses({ rol: 'trabajador' })])[0]
    expect(e.alarma).toBe(true)
    expect(diagnosticoEvidencia(e)).toMatch(/sin preflight reciente/)
  })

  it('TRABAJADOR con preflight incompleto: alarma, está trabajando a ciegas', () => {
    const e = run([ses({ rol: 'trabajador' })], [pre({ veredicto: 'incompleto_bloqueante' })])[0]
    expect(e.alarma).toBe(true)
    expect(diagnosticoEvidencia(e)).toMatch(/a ciegas/)
  })

  it('TRABAJADOR verificado: ninguna alarma', () => {
    const e = run([ses({ rol: 'trabajador' })], [pre()])[0]
    expect(e.alarma).toBe(false)
    expect(diagnosticoEvidencia(e)).toBeNull()
  })

  // Una persona con preflight incompleto SÍ se dice (sabe que no está en el reparto), pero en
  // ámbar y sin alarma: puede trabajar, es su decisión.
  it('persona con preflight incompleto: se avisa, sin alarma', () => {
    const e = run([ses()], [pre({ veredicto: 'incompleto_avisado' })])[0]
    expect(e.alarma).toBe(false)
    expect(diagnosticoEvidencia(e)).toMatch(/NO está en el reparto/)
  })
})

describe('el rol se lee del latido, y NULL es persona', () => {
  it.each([[null], [undefined], ['persona']])('rol %s → persona', (r) => {
    expect(run([ses({ rol: r })])[0].rol).toBe('persona')
  })

  it('sin sesiones no inventa nada', () => {
    expect(run([])).toEqual([])
    expect(evidenciaSesiones(null, null)).toEqual([])
  })

  it('una fila sin sid se ignora en vez de romper el parte', () => {
    expect(run([{ slug: 'rota' } as any, ses()])).toHaveLength(1)
  })
})
