/**
 * @jest-environment node
 */
// Unitarios del resolvedor ÚNICO de session-id (T-407). Importan la función REAL que usan el
// backlog, la cola de impugnaciones, el latido, el push-guard y el marcador de deploys.
//
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { resolverSid, sid } = require('@/lib/sessions/sid.cjs')

const CWD = '/wt/mi-sesion'
const REPO = '/repo'

/** Simula un sistema de ficheros: solo existen las rutas del mapa. */
const fsFalso = (mapa: Record<string, string>) => (p: string) => {
  if (!(p in mapa)) { const e: any = new Error('ENOENT'); e.code = 'ENOENT'; throw e }
  return mapa[p]
}

const run = (over: Record<string, any> = {}) => resolverSid({
  argv: ['node', 'x'], cwd: CWD, repo: REPO, env: {}, leerFichero: fsFalso({}), ...over,
})

describe('resolverSid — orden de precedencia', () => {
  it('lo explícito manda: --sid gana a todo', () => {
    const r = run({
      argv: ['node', 'x', '--sid', 'explicito'],
      env: { CLAUDE_CODE_SESSION_ID: 'del-entorno' },
      leerFichero: fsFalso({ '/wt/mi-sesion/.session-id': 'del-fichero' }),
    })
    expect(r).toMatchObject({ sid: 'explicito', origen: 'flag' })
  })

  // El fichero es del WORKTREE (lo escribe crear-worktree.sh); la variable la pone el entorno del
  // proceso y puede venir heredada. Ante la duda manda el sitio donde está el trabajo.
  it('el fichero del worktree gana a la variable de entorno', () => {
    const r = run({
      env: { CLAUDE_CODE_SESSION_ID: 'del-entorno' },
      leerFichero: fsFalso({ '/wt/mi-sesion/.session-id': 'del-fichero' }),
    })
    expect(r).toMatchObject({ sid: 'del-fichero', origen: 'fichero', base: CWD })
  })

  it('si el directorio actual no tiene fichero, usa el del repo', () => {
    const r = run({ leerFichero: fsFalso({ '/repo/.session-id': 'del-repo' }) })
    expect(r).toMatchObject({ sid: 'del-repo', origen: 'fichero', base: REPO })
  })

  it('sin fichero, cae a la variable de entorno', () => {
    expect(run({ env: { CLAUDE_CODE_SESSION_ID: 'del-entorno' } }))
      .toMatchObject({ sid: 'del-entorno', origen: 'entorno' })
  })

  it('sin nada, null — y lo dice (no inventa una identidad)', () => {
    expect(run()).toMatchObject({ sid: null, origen: null })
  })
})

describe('resolverSid — higiene', () => {
  it('un fichero vacío o en blanco NO cuenta como identidad', () => {
    const r = run({
      env: { CLAUDE_CODE_SESSION_ID: 'del-entorno' },
      leerFichero: fsFalso({ '/wt/mi-sesion/.session-id': '   \n' }),
    })
    expect(r.sid).toBe('del-entorno')
  })

  it('recorta espacios y saltos de línea del fichero', () => {
    expect(run({ leerFichero: fsFalso({ '/wt/mi-sesion/.session-id': ' abc123 \n' }) }).sid).toBe('abc123')
  })

  it('una variable vacía tampoco cuenta', () => {
    expect(run({ env: { CLAUDE_CODE_SESSION_ID: '  ' } }).sid).toBeNull()
  })

  it('`--sid` sin valor (seguido de otro flag) no se toma por identidad', () => {
    expect(run({ argv: ['node', 'x', '--sid', '--json'], env: { CLAUDE_CODE_SESSION_ID: 'e' } }).sid).toBe('e')
  })

  it('`sid()` es el atajo que devuelve solo el id', () => {
    expect(sid({ argv: ['node', 'x', '--sid', 'z'], cwd: CWD, repo: REPO, env: {}, leerFichero: fsFalso({}) })).toBe('z')
  })
})

// El fallo que originó la tarea: dos herramientas del MISMO worktree resolviendo identidades
// distintas. `cola.cjs` reclamaba con el fichero y `revisar-impugnacion.cjs` comparaba contra la
// variable, así que el dossier avisaba de «otra sesión» siendo la misma. Un claim tomado bajo una
// identidad tampoco se puede soltar con la otra.
describe('REGRESIÓN — dos herramientas del mismo worktree coinciden', () => {
  it('con fichero Y variable a la vez, todas las herramientas resuelven LO MISMO', () => {
    const entorno = {
      cwd: CWD, repo: REPO,
      env: { CLAUDE_CODE_SESSION_ID: 'id-heredado-del-entorno' },
      leerFichero: fsFalso({ '/wt/mi-sesion/.session-id': 'id-de-esta-sesion' }),
    }
    const comoElBacklog = resolverSid({ ...entorno, argv: ['node', 'backlog.cjs', 'claim', 'T-1'] })
    const comoElDossier = resolverSid({ ...entorno, argv: ['node', 'revisar-impugnacion.cjs', 'abc'] })
    const comoElLatido = resolverSid({ ...entorno, argv: ['node', 'latir.cjs'] })
    expect(comoElDossier.sid).toBe(comoElBacklog.sid)
    expect(comoElLatido.sid).toBe(comoElBacklog.sid)
    expect(comoElBacklog.sid).toBe('id-de-esta-sesion')
  })

  it('el `origen` permite diagnosticar una discrepancia sin adivinar', () => {
    expect(run({ leerFichero: fsFalso({ '/repo/.session-id': 'x' }) }).origen).toBe('fichero')
    expect(run({ env: { CLAUDE_CODE_SESSION_ID: 'x' } }).origen).toBe('entorno')
  })
})

// ── LA MÁQUINA (T-484) ────────────────────────────────────────────────────────────────────────
// Con sesiones en servidores remotos además del portátil, «quién soy» deja de bastar: hace falta
// «quién soy Y DÓNDE». Dos worktrees en `/app/vence` de dos contenedores no comparten nada, y dos
// sesiones con el mismo sid en máquinas distintas comparten claim, lease y huella.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { maquina, nuevoSid, mismaMaquina } = require('@/lib/sessions/sid.cjs')

describe('maquina() — dónde corro', () => {
  it('lo explícito manda: VENCE_SESSION_HOST gana al hostname', () => {
    // En un contenedor el hostname es un hash que cambia en cada arranque; sin poder fijarlo, un
    // trabajador sería una máquina nueva cada vez que se reinicia y el mapa se llenaría de fantasmas.
    expect(maquina({ env: { VENCE_SESSION_HOST: 'koigrid-w1' }, hostname: () => 'a1b2c3d4e5f6' })).toBe('koigrid-w1')
  })

  it('normaliza a nombre corto y minúsculas', () => {
    // Si no, `koigrid-w1` y `koigrid-w1.local` pasarían por dos máquinas y el guard del índice
    // dejaría pasar a dos sesiones que SÍ comparten disco.
    expect(maquina({ env: {}, hostname: 'KOIGRID-W1.local' })).toBe('koigrid-w1')
  })

  it('si no se puede saber, dice null — no se inventa un valor por defecto', () => {
    // Quien compara tiene que poder distinguir «otra máquina» de «no lo sé»: un default silencioso
    // haría que todas las sesiones sin dato pareciesen la MISMA máquina.
    expect(maquina({ env: {}, hostname: () => '' })).toBe(null)
  })
})

describe('mismaMaquina() — tres estados, no dos', () => {
  it('iguales / distintas', () => {
    expect(mismaMaquina('koigrid-w1', 'koigrid-w1')).toBe(true)
    expect(mismaMaquina('koigrid-w1', 'koigrid-w2')).toBe(false)
  })
  it.each([[null, 'x'], ['x', null], [null, null], ['', 'x']])('sin dato (%s, %s) → null, nunca false', (a, b) => {
    expect(mismaMaquina(a as any, b as any)).toBe(null)
  })
  it('es la MISMA función para todos: un solo criterio, aunque cada uno decida distinto con el null', () => {
    // Dos comparadores del mismo hecho con criterios distintos no protegen, se contradicen: es la
    // lección de los cinco escritores de seguimiento_url (T-130).
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const idx = require('@/lib/sessions/indiceCompartido.cjs')
    expect(idx.mismaMaquina).toBe(mismaMaquina)
  })
})

describe('nuevoSid() — único por construcción', () => {
  it('lleva la máquina dentro, así que dos servidores no pueden coincidir', () => {
    const a = nuevoSid('flota', { env: { VENCE_SESSION_HOST: 'koigrid-w1' }, azar: () => 'aaaaaa' })
    const b = nuevoSid('flota', { env: { VENCE_SESSION_HOST: 'koigrid-w2' }, azar: () => 'aaaaaa' })
    expect(a).toBe('flota-koigrid-w1-aaaaaa')
    expect(b).not.toBe(a)
  })

  it('sin máquina conocida sigue acuñando (formato de antes): perderla es peor informe, no un fallo', () => {
    expect(nuevoSid('flota', { host: null, azar: () => 'aaaaaa' })).toBe('flota-aaaaaa')
  })

  it('el slug se sanea: el sid viaja en rutas, tablas y mensajes de git', () => {
    expect(nuevoSid('Flota /w1!', { host: null, azar: () => 'aaaaaa' })).toBe('flota-w1-aaaaaa')
    expect(nuevoSid('', { host: null, azar: () => 'aaaaaa' })).toBe('sesion-aaaaaa')
  })

  it('el azar sigue estando: dos sesiones de la MISMA máquina tampoco chocan', () => {
    const a = nuevoSid('x', { host: 'h' })
    const b = nuevoSid('x', { host: 'h' })
    expect(a).not.toBe(b)
  })
})

describe('resolverSid() publica la máquina junto al sid', () => {
  it('el sid NO se reescribe con la máquina: un claim tomado con una identidad no se suelta con otra', () => {
    // Es justo la avería de T-407. Por eso la máquina viaja AL LADO y solo se estampa en los sid
    // que nacen a partir de ahora (nuevoSid).
    const r = resolverSid({
      argv: ['node', 'x'], cwd: CWD, repo: REPO,
      env: { VENCE_SESSION_HOST: 'koigrid-w1' },
      leerFichero: fsFalso({ '/wt/mi-sesion/.session-id': 'sesion-de-siempre' }),
    })
    expect(r.sid).toBe('sesion-de-siempre')
    expect(r.host).toBe('koigrid-w1')
  })

  it('sin sid, el host se sigue publicando (hace falta para decir «no lo sé» del otro lado)', () => {
    expect(resolverSid({ argv: [], cwd: CWD, repo: REPO, env: { VENCE_SESSION_HOST: 'h' }, leerFichero: fsFalso({}) }))
      .toMatchObject({ sid: null, host: 'h' })
  })
})
