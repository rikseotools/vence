/**
 * @jest-environment node
 */
// Las variantes «una ficha = un fichero» de gitFichas.cjs (T-532), contra git de verdad.
//
// Mismo incidente que protege __tests__/backlog/gitFichas.test.ts (T-427, el 31/07: una sesión
// vieja se lleva por delante la ficha de otra sesión sin verla, porque su historial LOCAL nunca
// alcanzó el push ajeno) — reproducido aquí con la topología «cada ficha es su propio fichero»
// para demostrar que la propiedad se conserva: `origin/main` sigue siendo la única prueba
// compartida, ahora por PATH en vez de por marcador dentro de un fichero común.
import { execFileSync } from 'child_process'
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, existsSync, unlinkSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

// eslint-disable-next-line @typescript-eslint/no-var-requires
const gitFichas = require('@/lib/backlog/gitFichas.cjs') as {
  estuvoEnElHistorialLocalFichero: (id: string, o: { cwd: string }) => boolean
  hechosDeOrigenFichero: (id: string, o: { cwd: string; ref?: string }) => { consultable: boolean; estaAhora: boolean; estuvo: boolean }
  commitQueLaQuitoFichero: (id: string, o: { cwd: string; ref?: string }) => string | null
  enAlgunaRamaFichero: (id: string, o: { cwd: string }) => { consultable: boolean; estuvo: boolean; donde: string | null }
}
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { clasificarHuerfana } = require('@/lib/backlog/fichaHuerfana.cjs') as {
  clasificarHuerfana: (h: unknown) => { motivo: string; esRegresion: boolean; alcance: string }
}

const IDENTIDAD = ['-c', 'user.email=sim@vence.test', '-c', 'user.name=sim']
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
function escribirFicha(repo: string, id: string, titulo: string) {
  const dir = join(repo, 'docs', 'roadmap', 'tareas')
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, `${id}.md`), `### [${id}] 🟠 [ABIERTO 31/07] ${titulo}\n\n- Cuerpo.\n`)
}
function borrarFicha(repo: string, id: string) {
  const p = join(repo, 'docs', 'roadmap', 'tareas', `${id}.md`)
  if (existsSync(p)) unlinkSync(p)
}
function commitear(repo: string, mensaje: string) {
  git(repo, 'add', '-A')
  git(repo, 'commit', '-m', mensaje)
}

describe('gitFichas (ficheros) — el incidente de T-427, con una ficha por fichero', () => {
  let raiz: string
  let origin: string
  let sesionVieja: string
  let borrado: string

  beforeAll(() => {
    raiz = mkdtempSync(join(tmpdir(), 'vence-fichas-fichero-'))
    origin = join(raiz, 'origin.git')
    const sesionA = join(raiz, 'sesion-a')
    const sesionC = join(raiz, 'sesion-c')
    sesionVieja = join(raiz, 'sesion-vieja')

    gitSuelto('init', '--bare', '-b', 'main', origin)
    gitSuelto('clone', '-q', origin, sesionA)
    escribirFicha(sesionA, 'T-400', 'ver en vivo qué ficheros toca cada sesión')
    commitear(sesionA, 'docs(T-400): ficha inicial')
    git(sesionA, 'push', '-q', 'origin', 'main')

    gitSuelto('clone', '-q', origin, sesionVieja) // nace en T0, no alcanza lo que viene después

    gitSuelto('clone', '-q', origin, sesionC)
    escribirFicha(sesionC, 'T-418', 'el usuario free agotado sigue respondiendo preguntas')
    commitear(sesionC, 'docs(T-418): ficha nueva')
    git(sesionC, 'push', '-q', 'origin', 'main')

    // Sesión A, con copia rancia (su árbol no tiene el fichero de T-418), pushea sin verlo — como
    // pasaría si alguien reescribiera el directorio entero desde un estado viejo.
    git(sesionA, 'pull', '-q', '--rebase', 'origin', 'main')
    borrarFicha(sesionA, 'T-418')
    commitear(sesionA, 'feat(T-423): un cambio cualquiera que de paso se la lleva')
    git(sesionA, 'push', '-q', 'origin', 'main')
    borrado = git(sesionA, 'rev-parse', '--short', 'HEAD').trim()

    git(sesionVieja, 'fetch', '-q', 'origin', 'main')
  })

  afterAll(() => rmSync(raiz, { recursive: true, force: true }))

  it('la topología es la del incidente: el fichero de T-418 ya no está en origin/main', () => {
    expect(() => git(sesionVieja, 'cat-file', '-e', 'origin/main:docs/roadmap/tareas/T-400.md')).not.toThrow()
    expect(() => git(sesionVieja, 'cat-file', '-e', 'origin/main:docs/roadmap/tareas/T-418.md')).toThrow()
  })

  it('EL PUNTO CIEGO se mantiene: el historial LOCAL nunca vio el fichero ajeno', () => {
    expect(gitFichas.estuvoEnElHistorialLocalFichero('T-418', { cwd: sesionVieja })).toBe(false)
  })

  it('origin/main SÍ sabe que existió → BORRADA, no «sin pushear»', () => {
    const origen = gitFichas.hechosDeOrigenFichero('T-418', { cwd: sesionVieja })
    expect(origen).toEqual({ consultable: true, estaAhora: false, estuvo: true })

    const veredicto = clasificarHuerfana({
      id: 'T-418',
      estuvoEnElMarkdown: gitFichas.estuvoEnElHistorialLocalFichero('T-418', { cwd: sesionVieja }),
      origen,
    })
    expect(veredicto.motivo).toBe('borrada')
    expect(veredicto.esRegresion).toBe(true)
  })

  it('nombra el commit que se lo llevó', () => {
    const culpable = gitFichas.commitQueLaQuitoFichero('T-418', { cwd: sesionVieja })
    expect(culpable).toContain(borrado)
    expect(culpable).toContain('T-423')
  })

  it('la ficha que SÍ sigue en origin no produce ningún aviso', () => {
    const origen = gitFichas.hechosDeOrigenFichero('T-400', { cwd: sesionVieja })
    expect(origen.estaAhora).toBe(true)
    expect(clasificarHuerfana({ id: 'T-400', estuvoEnElMarkdown: true, origen }).esRegresion).toBe(false)
  })

  it('un id que no existe en ninguna parte sigue siendo trabajo en vuelo, no una alarma', () => {
    const origen = gitFichas.hechosDeOrigenFichero('T-999', { cwd: sesionVieja })
    expect(origen).toEqual({ consultable: true, estaAhora: false, estuvo: false })
    expect(clasificarHuerfana({ id: 'T-999', estuvoEnElMarkdown: false, origen }).motivo).toBe('sin_pushear')
  })
})

describe('gitFichas (ficheros) — «mi rama va por detrás» no es una ficha perdida', () => {
  let raiz: string, clon: string

  beforeAll(() => {
    raiz = mkdtempSync(join(tmpdir(), 'vence-fichas-fichero-atras-'))
    const origin = join(raiz, 'origin.git')
    const otra = join(raiz, 'otra')
    clon = join(raiz, 'clon')
    gitSuelto('init', '--bare', '-b', 'main', origin)
    gitSuelto('clone', '-q', origin, otra)
    escribirFicha(otra, 'T-400', 'base')
    commitear(otra, 'docs: base')
    git(otra, 'push', '-q', 'origin', 'main')
    gitSuelto('clone', '-q', origin, clon)
    escribirFicha(otra, 'T-430', 'ficha nueva de otra sesión')
    commitear(otra, 'docs(T-430): ficha nueva')
    git(otra, 'push', '-q', 'origin', 'main')
    git(clon, 'fetch', '-q', 'origin', 'main')
  })

  afterAll(() => rmSync(raiz, { recursive: true, force: true }))

  it('está VIVA en origin/main: hay que actualizar la rama, no escribirla otra vez', () => {
    expect(existsSync(join(clon, 'docs', 'roadmap', 'tareas', 'T-430.md'))).toBe(false)
    const origen = gitFichas.hechosDeOrigenFichero('T-430', { cwd: clon })
    expect(origen.estaAhora).toBe(true)
    const v = clasificarHuerfana({ id: 'T-430', estuvoEnElMarkdown: false, origen })
    expect(v.motivo).toBe('desactualizada')
    expect(v.esRegresion).toBe(false)
  })
})

describe('gitFichas (ficheros) — sin origin no se contesta «está bien»', () => {
  let raiz: string, suelto: string

  beforeAll(() => {
    raiz = mkdtempSync(join(tmpdir(), 'vence-fichas-fichero-sinorigin-'))
    suelto = join(raiz, 'suelto')
    gitSuelto('init', '-q', '-b', 'main', suelto)
    escribirFicha(suelto, 'T-400', 'base')
    commitear(suelto, 'docs: base')
  })

  afterAll(() => rmSync(raiz, { recursive: true, force: true }))

  it('un repo sin remoto se declara NO VERIFICABLE, no sano', () => {
    const origen = gitFichas.hechosDeOrigenFichero('T-418', { cwd: suelto })
    expect(origen.consultable).toBe(false)
    expect(clasificarHuerfana({ id: 'T-418', estuvoEnElMarkdown: false, origen }).motivo).toBe('no_verificable')
  })
})
