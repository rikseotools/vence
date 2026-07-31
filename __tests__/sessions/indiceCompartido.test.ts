/**
 * @jest-environment node
 */
// Una sesión por índice de git (T-415).
//
// El índice es del REPOSITORIO, no de la sesión: si dos trabajan en el mismo directorio, el
// `git add` de una entra en el commit de la otra y ni ellas ni git pueden saberlo. Pasó el 31/07
// —el trabajo de una sesión acabó en main bajo el mensaje de otra— y no hay guardarraíl sobre el
// CONTENIDO que lo arregle: solo dejar de compartir directorio.
//
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { evaluarIndice, mensajeBloqueo, VIVA_MIN } = require('@/lib/sessions/indiceCompartido.cjs')

const AHORA = new Date('2026-07-31T21:00:00Z')
const haceMin = (m: number) => new Date(AHORA.getTime() - m * 60_000).toISOString()
const YO = 'sid-yo'
const AQUI = '/home/manuel/repo'

const ses = (over: Record<string, any> = {}) => ({
  sid: 'sid-otra', worktree_path: AQUI, last_signal_at: haceMin(5), ...over,
})
const run = (sesiones: any[], over: Record<string, any> = {}) =>
  evaluarIndice({ sesiones, sid: YO, worktreePath: AQUI, ahora: AHORA, ...over })

describe('bloquea justo lo que tiene que bloquear', () => {
  it('OTRA sesión viva en MI directorio → bloquea', () => {
    const v = run([ses()])
    expect(v.permitido).toBe(false)
    expect(v.companeras).toEqual(['sid-otra'])
  })

  it('varias compañeras: las lista todas (hay que saber con quién coordinar)', () => {
    const v = run([ses({ sid: 'a' }), ses({ sid: 'b' }), ses({ sid: 'c' })])
    expect(v.companeras.sort()).toEqual(['a', 'b', 'c'])
  })
})

describe('lo que NO molesta, a propósito', () => {
  // El problema no es el SITIO, es la concurrencia. Una sola sesión en el checkout principal es
  // lo normal (la que coordina, la que despliega). Si esto ladrara ahí, se apagaría el primer día.
  it('ser la ÚNICA sesión viva aquí → pasa, aunque sea el checkout principal', () => {
    expect(run([ses({ sid: YO })]).permitido).toBe(true)
    expect(run([]).permitido).toBe(true)
  })

  it('otra sesión en OTRO directorio no estorba (es justo la solución que se propone)', () => {
    expect(run([ses({ worktree_path: '/home/manuel/vence-sessions/otra' })]).permitido).toBe(true)
  })

  it('una sesión que ya no da señal no cuenta', () => {
    expect(run([ses({ last_signal_at: haceMin(VIVA_MIN + 5) })]).permitido).toBe(true)
  })

  it('yo mismo, aunque aparezca varias veces, no soy mi propia compañera', () => {
    expect(run([ses({ sid: YO }), ses({ sid: YO })]).permitido).toBe(true)
  })
})

// Que la telemetría no responda no puede impedirle a nadie commitear: sería la avería de un
// sistema de observación bloqueando trabajo, que es exactamente lo que este repo evita en el
// latido y en el push-guard.
describe('fail-open: no saber NUNCA bloquea', () => {
  it.each([
    ['sin sid', { sid: null }],
    ['sin ruta', { worktreePath: null }],
  ])('%s → deja pasar', (_caso, over) => {
    expect(run([ses()], over).permitido).toBe(true)
  })

  it('sin datos de sesiones → deja pasar', () => {
    expect(evaluarIndice({ sesiones: null, sid: YO, worktreePath: AQUI }).permitido).toBe(true)
    expect(evaluarIndice({}).permitido).toBe(true)
  })
})

// Un bloqueo que no dice cómo salir se convierte en `--no-verify`, que apaga TODO el hook. Es la
// lección que este repo pagó tres veces el 31/07 (T-375).
describe('el mensaje dice cómo salir, no solo que pasó', () => {
  const txt = mensajeBloqueo({ companeras: ['abc123'], worktreePath: AQUI })

  it('propone el arreglo de verdad (un árbol propio), no solo el escape', () => {
    expect(txt).toMatch(/crear-worktree\.sh/)
  })
  it('nombra el escape explícito', () => {
    expect(txt).toMatch(/INDICE_COMPARTIDO_OK=1/)
  })
  it('explica POR QUÉ, para que no se lea como un capricho del hook', () => {
    expect(txt).toMatch(/índice de git es del REPOSITORIO/)
  })
})
