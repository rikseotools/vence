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
