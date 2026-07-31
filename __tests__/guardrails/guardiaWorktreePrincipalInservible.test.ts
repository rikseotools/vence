/**
 * Guardarraíl de `scripts/lib/guardia-worktree.sh` (T-437).
 *
 * La guarda avisa a quien despliega desde un worktree y le dice DÓNDE hacerlo. Ese consejo se
 * apoyaba en `git -C <principal> status --porcelain`, que en un repo **bare** falla por stderr y
 * devuelve vacío — exactamente igual que un árbol impecable. Resultado: un principal INSERVIBLE se
 * anunciaba como «ahora mismo está limpio» y mandaba a desplegar donde es imposible.
 *
 * Medido el 31/07/2026 a las 22:45 (T-436): alguien puso `core.bare=true` en el principal y la
 * guarda siguió recomendándolo. Es el mismo patrón que este proyecto persigue en otros sitios —
 * «no poder mirar» leído como «está bien» (los canarios que salían verdes sin conectar a la BD,
 * el `seguimiento_url` que responde 200 sin vigilar nada).
 *
 * El test es de COMPORTAMIENTO, no de texto: monta repos de verdad y ejecuta la función.
 */
import { execFileSync } from 'child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

const GUARDA = join(__dirname, '..', '..', 'scripts', 'lib', 'guardia-worktree.sh')

/**
 * ⚠️ ENTORNO LIMPIO — sin esto, este test CORROMPE EL REPO al correr desde un hook de git.
 *
 * Un hook (`pre-commit`, `pre-push`…) se ejecuta con `GIT_DIR`, `GIT_INDEX_FILE` y `GIT_PREFIX`
 * EXPORTADOS, y todo `git` hijo los hereda. Esas variables **pisan el `cwd`**: da igual que le
 * pases `{ cwd: <repo temporal> }`, el comando va al repositorio del hook y a SU índice.
 *
 * Pasó de verdad el 31/07/2026 al commitear este mismo fichero: el `pre-commit` lanzó la suite
 * unit, este test corrió dentro, y su `git commit -qm 'inicial'` se llevó los ficheros que yo
 * tenía en el índice y los commiteó con ESE mensaje, más un `f.txt` de fixture, encima de `main`.
 * Se recuperó con `reset --soft`, pero es exactamente el modo de fallo que un test no puede tener.
 *
 * Los otros dos tests que invocan git (`rutasSensiblesAMayusculas`, `lawTestCtaNoBareLink`) solo
 * LEEN del repo real, así que no les afecta. Por eso el saneado vive aquí y no en un helper
 * compartido: un solo consumidor no justifica una capa nueva.
 */
const ENV_SIN_GIT: NodeJS.ProcessEnv = Object.fromEntries(
  Object.entries(process.env).filter(([k]) => !k.startsWith('GIT_')),
)

/** Monta principal + worktree enlazado y devuelve sus rutas. */
function montarRepo(): { raiz: string; principal: string; worktree: string } {
  const raiz = mkdtempSync(join(tmpdir(), 'guardia-wt-'))
  const principal = join(raiz, 'main')
  const worktree = join(raiz, 'wt')
  const git = (cwd: string, ...args: string[]) =>
    execFileSync('git', args, {
      cwd,
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'pipe'],
      env: ENV_SIN_GIT,
    })

  execFileSync('git', ['init', '-q', '-b', 'main', principal], {
    encoding: 'utf-8',
    env: ENV_SIN_GIT,
  })
  git(principal, 'config', 'user.email', 'test@example.com')
  git(principal, 'config', 'user.name', 'Test')
  writeFileSync(join(principal, 'f.txt'), 'hola\n')
  git(principal, 'add', 'f.txt')
  git(principal, 'commit', '-qm', 'inicial')
  git(principal, 'worktree', 'add', '-q', '--detach', worktree)

  // Autocomprobación: si alguna vez se vuelve a escapar al repo de verdad, que REVIENTE aquí en
  // vez de commitear a escondidas. El fixture tiene que haber aterrizado en el repo temporal.
  const asunto = git(principal, 'log', '-1', '--format=%s').trim()
  if (asunto !== 'inicial') {
    throw new Error(
      `El fixture no aterrizó en el repo temporal (HEAD dice "${asunto}"). ` +
        '¿Se ha colado GIT_DIR/GIT_INDEX_FILE del entorno? Ver la nota de ENV_SIN_GIT.',
    )
  }
  return { raiz, principal, worktree }
}

/** Ejecuta `guardia_worktree` desde el worktree y devuelve lo que imprime. */
function correrGuarda(worktree: string): string {
  return execFileSync(
    'bash',
    ['-c', `. "${GUARDA}"; guardia_worktree "hace cosas"`],
    {
      cwd: worktree,
      encoding: 'utf-8',
      // El escape evita el `exit 2`: aquí se examina el CONSEJO, no el corte (que ya está probado).
      env: { ...ENV_SIN_GIT, DEPLOY_DESDE_WORKTREE: '1' },
    },
  )
}

describe('guardia-worktree — un principal inservible no puede leerse como limpio (T-437)', () => {
  let repo: ReturnType<typeof montarRepo>

  beforeAll(() => {
    repo = montarRepo()
  })
  afterAll(() => {
    rmSync(repo.raiz, { recursive: true, force: true })
  })

  it('con el principal SANO y limpio, sí lo recomienda (contraste: el aviso no grita siempre)', () => {
    const salida = correrGuarda(repo.worktree)
    expect(salida).toMatch(/está limpio/)
    expect(salida).not.toMatch(/NO SIRVE/)
  })

  // `env: ENV_SIN_GIT` NO es opcional aquí: sin él, corriendo desde un hook, este `config
  // core.bare true` iría al repositorio DE VERDAD y lo dejaría inservible a mitad de un commit.
  const ponerBare = (valor: 'true' | 'false') =>
    execFileSync('git', ['-C', repo.principal, 'config', 'core.bare', valor], {
      encoding: 'utf-8',
      env: ENV_SIN_GIT,
    })

  it('con el principal en `bare`, NO dice que esté limpio y explica que no sirve', () => {
    ponerBare('true')
    try {
      const salida = correrGuarda(repo.worktree)
      // Lo que NO puede pasar: anunciarlo como sitio válido.
      expect(salida).not.toMatch(/está limpio/)
      // Y lo que sí: decir el problema y cómo salir.
      expect(salida).toMatch(/NO SIRVE/)
      expect(salida).toMatch(/core\.bare/)
      expect(salida).toMatch(/DEDICADO/)
    } finally {
      ponerBare('false')
    }
  })

  it('con el principal SUCIO sigue avisando de lo suyo (no se ha roto el caso que ya funcionaba)', () => {
    writeFileSync(join(repo.principal, 'sucio.txt'), 'trabajo de otra sesión\n')
    try {
      const salida = correrGuarda(repo.worktree)
      expect(salida).toMatch(/TAMPOCO sirve/)
      expect(salida).toMatch(/sucio\.txt/)
      expect(salida).not.toMatch(/está limpio/)
    } finally {
      rmSync(join(repo.principal, 'sucio.txt'), { force: true })
    }
  })
})
