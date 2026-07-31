/**
 * @jest-environment node
 */
// T-445: «commiteada en la rama de otra sesión» y «escrita y perdida sin commitear» se veían
// IDÉNTICAS, y una es el día normal mientras la otra es trabajo destruido.
//
// El 31/07 ocurrieron LAS DOS el mismo día: T-435 estaba en `sesion/esquina-superior-derecha`
// (falsa alarma) y T-407 se había perdido de verdad, y hubo que reescribirla a mano. Quien lo
// sufría no podía saber cuál le había tocado porque el detector daba el mismo veredicto.
//
// Igual que `gitFichas.test.ts`, esto se prueba contra git DE VERDAD y con la topología real —
// worktrees hermanos del MISMO repositorio, que es por lo que las ramas ajenas son refs locales—.
// Un mock de git no habría cazado el fallo original, que estaba justo en lo que git contesta.
import { execFileSync } from 'child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

// eslint-disable-next-line @typescript-eslint/no-var-requires
const gitFichas = require('@/lib/backlog/gitFichas.cjs') as {
  hechosDeOrigin: (id: string, o: Opciones) => { consultable: boolean; estaAhora: boolean; estuvo: boolean }
  enAlgunaRama: (id: string, o: Opciones) => { consultable: boolean; estuvo: boolean; donde: string | null }
}
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { clasificarHuerfana } = require('@/lib/backlog/fichaHuerfana.cjs') as {
  clasificarHuerfana: (h: unknown) => { motivo: string; esRegresion: boolean; alcance: string; donde?: string | null }
}

type Opciones = { cwd: string; mdRel?: string; ref?: string }

const MD = 'docs/roadmap/tareas-pendientes.md'
const IDENTIDAD = ['-c', 'user.email=sim@vence.test', '-c', 'user.name=sim']

// Sin NINGUNA variable GIT_*: la suite la lanza el hook `pre-commit`, y git exporta `GIT_DIR` /
// `GIT_INDEX_FILE` / `GIT_WORK_TREE` a sus hooks. Esas variables GANAN al `cwd`, así que sin esto
// los commits del fixture se escriben sobre la rama de quien ejecuta el test. Ya pasó el 31/07.
const ENV_LIMPIO: NodeJS.ProcessEnv = (() => {
  const env = { ...process.env }
  for (const k of Object.keys(env)) if (k.startsWith('GIT_')) delete env[k]
  return env
})()

function git(cwd: string, ...args: string[]): string {
  return execFileSync('git', [...IDENTIDAD, ...args],
    { cwd, env: ENV_LIMPIO, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
}
function gitSuelto(...args: string[]): void {
  execFileSync('git', args, { env: ENV_LIMPIO, stdio: ['ignore', 'pipe', 'pipe'] })
}
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

describe('en vuelo vs perdida — las dos huérfanas que no se distinguían (T-445)', () => {
  let raiz: string
  let origin: string
  let miSesion: string      // el worktree que corre `sync`
  let otraSesion: string    // worktree HERMANO: su rama es una ref LOCAL del mismo repo

  beforeAll(() => {
    raiz = mkdtempSync(join(tmpdir(), 'vence-enrama-'))
    origin = join(raiz, 'origin.git')
    miSesion = join(raiz, 'mi-sesion')
    otraSesion = join(raiz, 'otra-sesion')

    gitSuelto('init', '--bare', '-b', 'main', origin)
    gitSuelto('clone', '-q', origin, miSesion)
    escribirMd(miSesion, [ficha('T-400', 'ver en vivo qué ficheros toca cada sesión')])
    commitear(miSesion, 'docs(T-400): ficha inicial')
    git(miSesion, 'push', '-q', 'origin', 'main')

    // La otra sesión trabaja en un WORKTREE del mismo repositorio —que es como se montan aquí— y
    // commitea su ficha en su rama. NO la fusiona ni la pushea: es trabajo en vuelo.
    git(miSesion, 'worktree', 'add', '-q', '-b', 'sesion/otra', otraSesion, 'main')
    escribirMd(otraSesion, [
      ficha('T-400', 'ver en vivo qué ficheros toca cada sesión'),
      ficha('T-435', 'la ficha que se dio por perdida y estaba aquí'),
    ])
    commitear(otraSesion, 'docs(T-435): reescribir la ficha, que se perdió antes')

    git(miSesion, 'fetch', '-q', 'origin', 'main')
  })

  afterAll(() => {
    try { git(miSesion, 'worktree', 'remove', '--force', otraSesion) } catch { /* se borra con la raíz */ }
    rmSync(raiz, { recursive: true, force: true })
  })

  it('la topología es la del caso: la ficha NO está en origin/main, pero SÍ existe commiteada', () => {
    const origen = gitFichas.hechosDeOrigin('T-435', { cwd: miSesion, mdRel: MD })
    expect(origen).toEqual({ consultable: true, estaAhora: false, estuvo: false })
    expect(gitFichas.enAlgunaRama('T-435', { cwd: miSesion, mdRel: MD }).estuvo).toBe(true)
  })

  it('EN VUELO: la ficha commiteada en la rama de otra sesión NO es una regresión, y se dice dónde está', () => {
    const veredicto = clasificarHuerfana({
      id: 'T-435',
      estuvoEnElMarkdown: false,
      origen: gitFichas.hechosDeOrigin('T-435', { cwd: miSesion, mdRel: MD }),
      ramas: gitFichas.enAlgunaRama('T-435', { cwd: miSesion, mdRel: MD }),
    })
    expect(veredicto.motivo).toBe('en_otra_rama')
    expect(veredicto.esRegresion).toBe(false)
    // Sin la ref, el aviso obliga a repetir la búsqueda a mano para poder actuar.
    expect(veredicto.donde).toContain('sesion/otra')
  })

  it('PERDIDA: un id que no está en NINGUNA rama se separa del caso anterior', () => {
    const ramas = gitFichas.enAlgunaRama('T-407', { cwd: miSesion, mdRel: MD })
    expect(ramas).toEqual({ consultable: true, estuvo: false, donde: null })
    const veredicto = clasificarHuerfana({
      id: 'T-407',
      estuvoEnElMarkdown: false,
      origen: gitFichas.hechosDeOrigin('T-407', { cwd: miSesion, mdRel: MD }),
      ramas,
    })
    expect(veredicto.motivo).toBe('sin_pushear')
    // Tampoco aquí se acusa a nadie: puede ser un id recién reservado cuya ficha se está
    // escribiendo. Lo que cambia es que ya NO se confunde con la de arriba.
    expect(veredicto.esRegresion).toBe(false)
  })

  it('una ficha SÍ borrada de origin sigue siendo regresión aunque viva en otra rama', () => {
    // Efecto de borde que la ficha de T-445 avisa expresamente: mirar todas las ramas NO puede
    // tapar una regresión real. Si origin la tuvo y ya no la tiene, es borrada, punto.
    const veredicto = clasificarHuerfana({
      id: 'T-418',
      estuvoEnElMarkdown: false,
      origen: { consultable: true, estaAhora: false, estuvo: true },
      ramas: { consultable: true, estuvo: true, donde: 'refs/heads/sesion/otra' },
    })
    expect(veredicto.motivo).toBe('borrada')
    expect(veredicto.esRegresion).toBe(true)
  })

  it('si git no puede mirar las ramas, NO se inventa un «no está en ninguna parte»', () => {
    const veredicto = clasificarHuerfana({
      id: 'T-500',
      estuvoEnElMarkdown: false,
      origen: { consultable: true, estaAhora: false, estuvo: false },
      ramas: { consultable: false, estuvo: false, donde: null },
    })
    // Se degrada al veredicto de siempre, que es honesto, en vez de afirmar una pérdida.
    expect(veredicto.motivo).toBe('sin_pushear')
    expect(veredicto.esRegresion).toBe(false)
  })

  it('el HEAD del repositorio real sigue donde estaba (el fixture no toca a quien lo ejecuta)', () => {
    const ahora = execFileSync('git', ['rev-parse', 'HEAD'],
      { cwd: join(__dirname, '..', '..'), env: ENV_LIMPIO, encoding: 'utf8' }).trim()
    expect(ahora).toBe(HEAD_REAL)
  })
})

const HEAD_REAL = execFileSync('git', ['rev-parse', 'HEAD'],
  { cwd: join(__dirname, '..', '..'), env: ENV_LIMPIO, encoding: 'utf8' }).trim()
