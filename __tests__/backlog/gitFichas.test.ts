/**
 * @jest-environment node
 */
// Los HECHOS de git que alimentan al clasificador de fichas huérfanas, contra un repositorio de
// verdad. Sin BD y sin red: se monta un `origin` local en un directorio temporal.
//
// ## Por qué este fichero existe (T-427)
//
// El clasificador puro (`fichaHuerfana.cjs`) se escribió el 29/07 con seis unitarios en verde, y
// estaba en `main` dos días antes del incidente que tenía que cazar. El 31/07 el commit `a9797ae3a`
// borró cinco fichas ajenas de `main` y el `sync` las anunció como *«ℹ️ sin ficha aquí todavía
// (otra sesión sin pushear)»* — el aviso corrió y dio la respuesta tranquilizadora.
//
// **El núcleo puro acertaba con los datos que le daban; los datos estaban mal.** La parte que habla
// con git miraba solo el historial de la rama LOCAL, y un worktree nace de `origin/main` en un
// instante T0: no alcanza nada de lo que otra sesión pushee después. O sea, era ciego justo para
// las fichas AJENAS, que son las que el detector protege.
//
// Ningún test de la decisión pura podía ver eso. Este sí: recrea la topología exacta —tres sesiones,
// un worktree viejo y un push que borra— y ejercita las funciones de producción.
import { execFileSync } from 'child_process'
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

// eslint-disable-next-line @typescript-eslint/no-var-requires
const gitFichas = require('@/lib/backlog/gitFichas.cjs') as {
  estuvoEnElHistorialLocal: (id: string, o: Opciones) => boolean
  hechosDeOrigin: (id: string, o: Opciones) => { consultable: boolean; estaAhora: boolean; estuvo: boolean }
  commitQueLaQuito: (id: string, o: Opciones) => string | null
  gitOut: (args: string[], o: { cwd: string }) => string | null
}
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { clasificarHuerfana } = require('@/lib/backlog/fichaHuerfana.cjs') as {
  clasificarHuerfana: (h: unknown) => { motivo: string; esRegresion: boolean; alcance: string }
}

type Opciones = { cwd: string; mdRel?: string; ref?: string }

const MD = 'docs/roadmap/tareas-pendientes.md'
const IDENTIDAD = ['-c', 'user.email=sim@vence.test', '-c', 'user.name=sim']

/**
 * Entorno SIN ninguna variable `GIT_*`, y no es paranoia: costó un incidente el mismo día.
 *
 * Este fichero monta repositorios de mentira y hace `commit` en ellos. La suite unit la ejecuta el
 * hook `pre-commit`… y **git exporta `GIT_DIR`, `GIT_INDEX_FILE` y `GIT_WORK_TREE` a sus hooks**.
 * Esas variables GANAN al `cwd`, así que los cuatro commits de los fixtures se escribieron sobre la
 * rama del worktree real, dejándola apuntando al árbol del fixture (se recuperó con `reset`, pero
 * el susto es evidente: un test no puede tocar el repo desde el que se ejecuta).
 *
 * Se limpia el entorno UNA vez y se usa en TODAS las invocaciones, incluidas `init` y `clone`.
 */
const ENV_LIMPIO: NodeJS.ProcessEnv = (() => {
  const env = { ...process.env }
  for (const k of Object.keys(env)) if (k.startsWith('GIT_')) delete env[k]
  return env
})()

/** git dentro de un repo de prueba. Nunca sin `cwd` y nunca con el entorno heredado. */
function git(cwd: string, ...args: string[]): string {
  return execFileSync('git', [...IDENTIDAD, ...args],
    { cwd, env: ENV_LIMPIO, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
}

/** Para `init`/`clone`, que aún no tienen repo al que apuntar. Mismo aislamiento. */
function gitSuelto(...args: string[]): void {
  execFileSync('git', args, { env: ENV_LIMPIO, stdio: ['ignore', 'pipe', 'pipe'] })
}

/** Una ficha con la forma real: la cabecera es lo que se busca, el cuerpo es ruido a propósito. */
const ficha = (id: string, titulo: string) =>
  `### [${id}] 🟠 [ABIERTO 31/07] ${titulo}\n\n- Cuerpo de la ficha, con su contexto.\n`

function escribirMd(repo: string, fichas: string[]) {
  execFileSync('mkdir', ['-p', join(repo, 'docs', 'roadmap')])
  writeFileSync(join(repo, MD), `# Tareas\n\n## Abiertas\n\n${fichas.join('\n')}`)
}

function commitear(repo: string, mensaje: string) {
  git(repo, 'add', '-A')
  git(repo, 'commit', '-m', mensaje)
}

describe('AISLAMIENTO — este fichero no puede tocar el repositorio desde el que se ejecuta', () => {
  // Pasó de verdad, el mismo día que se escribió (31/07): el hook `pre-commit` lanza la suite unit,
  // git exporta `GIT_DIR`/`GIT_INDEX_FILE`/`GIT_WORK_TREE` a sus hooks, y esas variables GANAN al
  // `cwd` — así que los cuatro `commit` de los fixtures se escribieron sobre la rama del worktree
  // real y la dejaron apuntando al árbol del fixture. Se recuperó con un `reset`, pero un test que
  // reescribe la rama de quien lo ejecuta es un test peligroso, no un test lento.
  //
  // Estas dos comprobaciones son el trinquete: la primera vigila la causa, la segunda el efecto.
  const HEAD_REAL = execFileSync('git', ['rev-parse', 'HEAD'],
    { cwd: join(__dirname, '..', '..'), env: ENV_LIMPIO, encoding: 'utf8' }).trim()

  it('el entorno de los git de prueba no lleva NINGUNA variable GIT_*', () => {
    expect(Object.keys(ENV_LIMPIO).filter((k) => k.startsWith('GIT_'))).toEqual([])
  })

  it('el HEAD del repositorio real sigue donde estaba después de montar los fixtures', () => {
    // Se lee al final, cuando los `beforeAll` de abajo ya han creado y commiteado sus repos.
    const ahora = execFileSync('git', ['rev-parse', 'HEAD'],
      { cwd: join(__dirname, '..', '..'), env: ENV_LIMPIO, encoding: 'utf8' }).trim()
    expect(ahora).toBe(HEAD_REAL)
  })
})

describe('gitFichas — el incidente del 31/07, reproducido contra git de verdad', () => {
  let raiz: string
  let origin: string
  let sesionVieja: string   // el worktree que corre `sync`: nació ANTES de la ficha ajena
  let borrado: string       // hash del commit que se lleva la ficha por delante

  beforeAll(() => {
    raiz = mkdtempSync(join(tmpdir(), 'vence-fichas-'))
    origin = join(raiz, 'origin.git')
    const sesionA = join(raiz, 'sesion-a')
    const sesionC = join(raiz, 'sesion-c')
    sesionVieja = join(raiz, 'sesion-vieja')

    // T0 — el estado del que nacen los worktrees: una sola ficha.
    gitSuelto('init', '--bare', '-b', 'main', origin)
    gitSuelto('clone', '-q', origin, sesionA)
    escribirMd(sesionA, [ficha('T-400', 'ver en vivo qué ficheros toca cada sesión')])
    commitear(sesionA, 'docs(T-400): ficha inicial')
    git(sesionA, 'push', '-q', 'origin', 'main')

    // La sesión que va a correr el `sync` clona AQUÍ: su historial se queda en T0.
    gitSuelto('clone', '-q', origin, sesionVieja)

    // Otra sesión (ajena) escribe su ficha y la PUSHEA. Esto es lo que la sesión vieja no alcanza.
    gitSuelto('clone', '-q', origin, sesionC)
    escribirMd(sesionC, [
      ficha('T-400', 'ver en vivo qué ficheros toca cada sesión'),
      ficha('T-418', 'el usuario free agotado sigue respondiendo preguntas'),
    ])
    commitear(sesionC, 'docs(T-418): el triaje de errores de cliente')
    git(sesionC, 'push', '-q', 'origin', 'main')

    // Y la sesión A, con su copia RANCIA del markdown, commitea encima y se lleva la ficha ajena.
    // Es literalmente lo que hizo `a9797ae3a`: 180 líneas fuera, 42 dentro. Ojo al detalle: A se
    // pone al día con origin (así que el commit que AÑADE la ficha sí está en su historia) y aun
    // así la borra, porque lo que escribe es su copia vieja del fichero.
    git(sesionA, 'pull', '-q', '--rebase', 'origin', 'main')
    escribirMd(sesionA, [ficha('T-400', 'ver en vivo qué ficheros toca cada sesión')])
    commitear(sesionA, 'feat(T-423): medir cuándo se RODEA un guardarraíl')
    git(sesionA, 'push', '-q', 'origin', 'main')
    borrado = git(sesionA, 'rev-parse', '--short', 'HEAD').trim()

    // La sesión vieja hace lo que hace `sync`: refrescar la ref compartida antes de opinar.
    git(sesionVieja, 'fetch', '-q', 'origin', 'main')
  })

  afterAll(() => rmSync(raiz, { recursive: true, force: true }))

  it('la topología es la del incidente: la ficha ajena YA NO está en origin/main', () => {
    const md = gitFichas.gitOut(['show', `origin/main:${MD}`], { cwd: sesionVieja })
    expect(md).toContain('### [T-400]')
    expect(md).not.toContain('### [T-418]')
  })

  it('EL PUNTO CIEGO: el historial LOCAL no vio nunca la ficha ajena', () => {
    // Éste es el dato con el que se decidía antes, y por sí solo es indistinguible de «otra sesión
    // aún no la ha pusheado». De aquí salía el verde falso.
    expect(gitFichas.estuvoEnElHistorialLocal('T-418', { cwd: sesionVieja, mdRel: MD })).toBe(false)
  })

  it('origin/main SÍ sabe que existió → la clasificación es BORRADA, no «sin pushear»', () => {
    const origen = gitFichas.hechosDeOrigin('T-418', { cwd: sesionVieja, mdRel: MD })
    expect(origen).toEqual({ consultable: true, estaAhora: false, estuvo: true })

    const veredicto = clasificarHuerfana({
      id: 'T-418',
      estuvoEnElMarkdown: gitFichas.estuvoEnElHistorialLocal('T-418', { cwd: sesionVieja, mdRel: MD }),
      origen,
    })
    expect(veredicto.motivo).toBe('borrada')
    expect(veredicto.esRegresion).toBe(true)
    expect(veredicto.alcance).toBe('origin')
  })

  it('nombra el commit que se la llevó, para no tener que investigar antes de arreglar', () => {
    const culpable = gitFichas.commitQueLaQuito('T-418', { cwd: sesionVieja, mdRel: MD })
    expect(culpable).toContain(borrado)
    expect(culpable).toContain('T-423')   // el mensaje del commit que la borró, tal cual
  })

  it('la ficha que SÍ sigue en origin no produce ningún aviso de regresión', () => {
    const origen = gitFichas.hechosDeOrigin('T-400', { cwd: sesionVieja, mdRel: MD })
    expect(origen.estaAhora).toBe(true)
    expect(clasificarHuerfana({ id: 'T-400', estuvoEnElMarkdown: true, origen }).esRegresion).toBe(false)
  })

  it('una ficha que no existe en ninguna parte sigue siendo trabajo en vuelo, no una alarma', () => {
    // El día normal con 2-10 sesiones: el id está reservado en la tabla y la ficha viaja en otro
    // worktree. Si esto gritara, el aviso se gastaría y volveríamos al punto de partida.
    const origen = gitFichas.hechosDeOrigin('T-999', { cwd: sesionVieja, mdRel: MD })
    expect(origen).toEqual({ consultable: true, estaAhora: false, estuvo: false })
    expect(clasificarHuerfana({ id: 'T-999', estuvoEnElMarkdown: false, origen }).motivo).toBe('sin_pushear')
  })
})

describe('gitFichas — «mi rama va por detrás» no es una ficha perdida', () => {
  let raiz: string, clon: string

  beforeAll(() => {
    raiz = mkdtempSync(join(tmpdir(), 'vence-fichas-atras-'))
    const origin = join(raiz, 'origin.git')
    const otra = join(raiz, 'otra')
    clon = join(raiz, 'clon')
    gitSuelto('init', '--bare', '-b', 'main', origin)
    gitSuelto('clone', '-q', origin, otra)
    escribirMd(otra, [ficha('T-400', 'base')])
    commitear(otra, 'docs: base')
    git(otra, 'push', '-q', 'origin', 'main')
    gitSuelto('clone', '-q', origin, clon)
    escribirMd(otra, [ficha('T-400', 'base'), ficha('T-430', 'ficha nueva de otra sesión')])
    commitear(otra, 'docs(T-430): ficha nueva')
    git(otra, 'push', '-q', 'origin', 'main')
    git(clon, 'fetch', '-q', 'origin', 'main')
  })

  afterAll(() => rmSync(raiz, { recursive: true, force: true }))

  it('la ficha está VIVA en origin/main: hay que actualizar la rama, no escribirla otra vez', () => {
    // Antes esto se disfrazaba de `sin_pushear`, que manda a la sesión a redactar una ficha que ya
    // existe — y así es como acaban dos fichas con el mismo id.
    expect(readFileSync(join(clon, MD), 'utf8')).not.toContain('### [T-430]')
    const origen = gitFichas.hechosDeOrigin('T-430', { cwd: clon, mdRel: MD })
    expect(origen.estaAhora).toBe(true)
    const v = clasificarHuerfana({ id: 'T-430', estuvoEnElMarkdown: false, origen })
    expect(v.motivo).toBe('desactualizada')
    expect(v.esRegresion).toBe(false)
  })
})

describe('gitFichas — el markdown REAL pesa megas, y eso rompía el detector', () => {
  // REGRESIÓN del estreno (31/07). Los tests de arriba pasaban con un markdown de tres líneas; al
  // correr el `sync` de verdad, la PRIMERA ficha huérfana salió acusada de «BORRADA» teniéndola
  // delante en `origin/main`. Causa: `docs/roadmap/tareas-pendientes.md` pesa 2,2 MB con 415 fichas
  // y el `maxBuffer` por defecto de execFileSync es 1 MB → `git show` moría con ENOBUFS, `gitOut`
  // devolvía null y eso se leía como «no contiene la ficha».
  //
  // Un detector que grita en falso se ignora en una semana. Por eso este test usa un fichero por
  // encima del límite viejo: si alguien quita el `maxBuffer`, se pone rojo aquí y no en producción.
  let raiz: string, clon: string

  beforeAll(() => {
    raiz = mkdtempSync(join(tmpdir(), 'vence-fichas-grande-'))
    const origin = join(raiz, 'origin.git')
    const otra = join(raiz, 'otra')
    clon = join(raiz, 'clon')
    gitSuelto('init', '--bare', '-b', 'main', origin)
    gitSuelto('clone', '-q', origin, otra)
    // ~1,5 MB de relleno + la ficha al final: por encima del maxBuffer viejo, como el fichero real.
    const relleno = Array.from({ length: 400 }, (_, i) =>
      ficha(`T-${100 + i}`, 'x'.repeat(3800)))
    escribirMd(otra, [...relleno, ficha('T-431', 'un worktree abandonado es invisible')])
    commitear(otra, 'docs: backlog gordo, como el de verdad')
    git(otra, 'push', '-q', 'origin', 'main')
    gitSuelto('clone', '-q', origin, clon)
    // La sesión va por detrás: borra su copia local de la ficha, que es como llega a ser huérfana.
    escribirMd(clon, relleno)
    commitear(clon, 'docs: mi copia sin esa ficha')
  })

  afterAll(() => rmSync(raiz, { recursive: true, force: true }))

  it('el fichero de prueba supera de verdad el límite viejo de 1 MB', () => {
    const bytes = Buffer.byteLength(gitFichas.gitOut(['show', `origin/main:${MD}`], { cwd: clon }) || '')
    expect(bytes).toBeGreaterThan(1024 * 1024)
  })

  it('NO acusa de borrada a una ficha que está en origin/main (el falso positivo de T-431)', () => {
    const origen = gitFichas.hechosDeOrigin('T-431', { cwd: clon, mdRel: MD })
    expect(origen).toEqual({ consultable: true, estaAhora: true, estuvo: true })
    expect(clasificarHuerfana({ id: 'T-431', estuvoEnElMarkdown: false, origen }).motivo)
      .toBe('desactualizada')
  })
})

describe('gitFichas — sin origin no se contesta «está bien»', () => {
  let raiz: string, suelto: string

  beforeAll(() => {
    raiz = mkdtempSync(join(tmpdir(), 'vence-fichas-sinorigin-'))
    suelto = join(raiz, 'suelto')
    gitSuelto('init', '-q', '-b', 'main', suelto)
    escribirMd(suelto, [ficha('T-400', 'base')])
    commitear(suelto, 'docs: base')
  })

  afterAll(() => rmSync(raiz, { recursive: true, force: true }))

  it('un repo sin remoto se declara NO VERIFICABLE, no sano', () => {
    const origen = gitFichas.hechosDeOrigin('T-418', { cwd: suelto, mdRel: MD })
    expect(origen.consultable).toBe(false)
    expect(clasificarHuerfana({ id: 'T-418', estuvoEnElMarkdown: false, origen }).motivo).toBe('no_verificable')
  })

  it('fuera de un repo git tampoco inventa una regresión', () => {
    const fuera = mkdtempSync(join(tmpdir(), 'vence-nada-'))
    expect(gitFichas.estuvoEnElHistorialLocal('T-418', { cwd: fuera, mdRel: MD })).toBe(false)
    expect(gitFichas.hechosDeOrigin('T-418', { cwd: fuera, mdRel: MD }).consultable).toBe(false)
    rmSync(fuera, { recursive: true, force: true })
  })
})
