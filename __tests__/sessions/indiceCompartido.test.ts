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
const { evaluarIndice, mensajeBloqueo, evaluarEscape, MOTIVO_MIN, VIVA_MIN } = require('@/lib/sessions/indiceCompartido.cjs')

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

// ── LA MÁQUINA (T-484) ────────────────────────────────────────────────────────────────────────
// Dos worktrees en la MISMA ruta de máquinas distintas no comparten índice de git: están en discos
// distintos. Comparando solo la ruta, este guard —que BLOQUEA— paraba el commit de una flota
// entera de contenedores clonados (todos en `/app/vence`) y empujaba al escape a diario, que es
// como se muere un guardarraíl (T-423). Pero solo se descarta a quien se puede AFIRMAR que está
// en otra máquina: sin el dato, este guard sigue protegiendo.
describe('otra MÁQUINA no comparte índice', () => {
  const remota = (over = {}) => ses({ host: 'koigrid-w2', ...over })

  it('misma ruta pero OTRA máquina → deja pasar', () => {
    expect(run([remota()], { host: 'koigrid-w1' }).permitido).toBe(true)
  })

  it('misma ruta y MISMA máquina → sigue bloqueando (es el caso que existe para cazar)', () => {
    expect(run([ses({ host: 'koigrid-w1' })], { host: 'koigrid-w1' }).permitido).toBe(false)
  })

  it('el nombre de máquina se compara sin sufijo de DNS ni mayúsculas', () => {
    // `koigrid-w1.local` y `KOIGRID-W1` son la misma máquina: creerse lo contrario dejaría pasar
    // dos sesiones que SÍ comparten índice, que es el fallo grave de los dos.
    expect(run([ses({ host: 'koigrid-w1.local' })], { host: 'KOIGRID-W1' }).permitido).toBe(false)
  })

  describe('«no lo sé» NO es «otra máquina»: ante la duda, protege', () => {
    it('la fila no dice de qué máquina es (latido viejo) → cuenta igual', () => {
      expect(run([ses({ host: null })], { host: 'koigrid-w1' }).permitido).toBe(false)
    })
    it('yo no sé en qué máquina estoy → cuenta igual', () => {
      expect(run([remota()], { host: null }).permitido).toBe(false)
    })
    it('sin el dato en ninguno de los dos lados → exactamente como antes de T-484', () => {
      expect(run([ses()]).permitido).toBe(false)
    })
  })

  it('otra máquina Y otra ruta: sigue sin estorbar', () => {
    expect(run([remota({ worktree_path: '/otro' })], { host: 'koigrid-w1' }).permitido).toBe(true)
  })
})

// Un bloqueo que no dice cómo salir se convierte en `--no-verify`, que apaga TODO el hook. Es la
// lección que este repo pagó tres veces el 31/07 (T-375).
describe('el mensaje dice cómo salir, no solo que pasó', () => {
  const txt = mensajeBloqueo({ companeras: ['abc123'], worktreePath: AQUI })

  it('propone el arreglo de verdad (un árbol propio), no solo el escape', () => {
    expect(txt).toMatch(/crear-worktree\.sh/)
  })
  it('nombra el escape explícito — que desde T-496 pide un MOTIVO, no un «1»', () => {
    expect(txt).toMatch(/INDICE_COMPARTIDO_OK="/)
  })
  it('explica POR QUÉ, para que no se lea como un capricho del hook', () => {
    expect(txt).toMatch(/índice de git es del REPOSITORIO/)
  })
})

// ── EL ESCAPE CUESTA UN MOTIVO (T-496) ──────────────────────────────────────────────────────
// Medido sobre 7 días: el guard se rodeaba el 67% (banda «muerto»), pero al desglosarlo **6 de
// los 10 escapes NUNCA fueron precedidos de un bloqueo a esa sesión** — dos sesiones escaparon
// dos veces cada una sin que el guard las hubiera parado jamás. No estorbaba: el `=1` se había
// vuelto un prefijo que se copia de un comando a otro.
describe('evaluarEscape — un «1» se escribe sin pensar; un motivo, no', () => {
  it.each([['1'], ['true'], ['yes'], ['si'], ['ok'], ['skip']])('«%s» ya no vale como escape', (v) => {
    const e = evaluarEscape(v)
    expect(e).toMatchObject({ usa: true, permitido: false })
    expect(e.problema).toBeTruthy()
  })

  it('un motivo de verdad pasa, y se conserva para registrarlo', () => {
    const e = evaluarEscape('commiteo solo la ficha; la otra sesión está en otro fichero')
    expect(e.permitido).toBe(true)
    expect(e.motivo).toContain('solo la ficha')
  })

  it('un motivo demasiado corto no cuela (sería un «1» con letras)', () => {
    expect(evaluarEscape('xx').permitido).toBe(false)
    expect(evaluarEscape('a'.repeat(MOTIVO_MIN)).permitido).toBe(true)
  })

  it('sin la variable no hay escape ni aviso: es el caso normal', () => {
    expect(evaluarEscape(undefined)).toMatchObject({ usa: false, permitido: false, problema: null })
    expect(evaluarEscape('   ')).toMatchObject({ usa: false })
  })

  // Que un valor no valga NO puede bloquear nada nuevo: el guard se limita a evaluarse, y en el
  // caso preventivo (nadie más en el directorio) el commit pasa igual.
  it('un escape inválido se marca como intento, para poder contarlo', () => {
    expect(evaluarEscape('1').usa).toBe(true)
  })
})

describe('el mensaje de bloqueo enseña la forma NUEVA del escape', () => {
  const txt = mensajeBloqueo({ companeras: ['abc'], worktreePath: '/x' })
  it('pide un motivo, no un 1', () => {
    expect(txt).toContain('INDICE_COMPARTIDO_OK="…tu motivo…"')
    expect(txt).not.toContain('INDICE_COMPARTIDO_OK=1')
  })
  it('sigue proponiendo primero el arreglo de verdad', () => {
    expect(txt.indexOf('crear-worktree.sh')).toBeLessThan(txt.indexOf('INDICE_COMPARTIDO_OK'))
  })
})
