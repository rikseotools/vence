// __tests__/calidad/sintaxisStaged.test.ts
//
// El check que impide commitear un fichero que no parsea. Lo que se prueba es lo que decide si
// BLOQUEA: un gate que molesta sin motivo se acaba saltando con `--no-verify`, que apaga además
// los otros tres guardarraíles del hook — así que los falsos positivos son tan graves como los
// falsos negativos. De ahí que el JSX tenga su propio caso.
//
// eslint-disable-next-line @typescript-eslint/no-var-requires
const chk = require('@/lib/calidad/sintaxisStaged.cjs')

describe('ficherosAComprobar — qué entra al check', () => {
  it('coge .cjs, .mjs y .js', () => {
    expect(chk.ficherosAComprobar(['scripts/a.cjs', 'x/b.mjs', 'lib/c.js'])).toHaveLength(3)
  })

  it('deja fuera lo que node --check no juzga (ts/tsx/sql/md) — eso va por typecheck y CI', () => {
    expect(chk.ficherosAComprobar(['lib/a.ts', 'app/b.tsx', 'supabase/c.sql', 'docs/d.md'])).toEqual([])
  })

  it('ignora dependencias y artefactos de build: no los escribimos nosotros', () => {
    expect(chk.ficherosAComprobar(['node_modules/foo/index.js', '.next/static/x.js', 'coverage/y.js'])).toEqual([])
  })

  it('aguanta la entrada sucia de `git diff` (líneas vacías, espacios, null)', () => {
    expect(chk.ficherosAComprobar(['', '  ', null as any, ' scripts/a.cjs '])).toEqual(['scripts/a.cjs'])
  })
})

describe('pareceJsx — solo sirve para degradar un fallo a aviso', () => {
  it('reconoce una etiqueta de componente y el cierre corto', () => {
    expect(chk.pareceJsx('const el = <Foo bar={1} />')).toBe(true)
    expect(chk.pareceJsx('return <div>hola</div>')).toBe(true)
  })

  it('NO confunde una plantilla HTML dentro de un script con JSX', () => {
    // Este es el caso que importa: scripts que generan HTML en un string SÍ son JavaScript
    // normal y SÍ tienen que bloquear si están rotos.
    expect(chk.pareceJsx("const html = '<p>hola</p>'".replace('<p>hola</p>', 'texto'))).toBe(false)
    expect(chk.pareceJsx('const sql = `SELECT 1` // sin markup')).toBe(false)
  })
})

describe('clasificar — la decisión de bloquear', () => {
  const roto = { ruta: 'scripts/x.cjs', ok: false, error: 'SyntaxError', contenido: 'const a = {;' }
  const sano = { ruta: 'scripts/y.cjs', ok: true, error: null, contenido: 'const a = 1' }

  it('un fichero que no parsea bloquea el commit', () => {
    const r = chk.clasificar([roto, sano])
    expect(r.bloquea).toBe(true)
    expect(r.rotos.map((x: any) => x.ruta)).toEqual(['scripts/x.cjs'])
    expect(r.ok).toBe(1)
  })

  it('todo sano no bloquea', () => {
    expect(chk.clasificar([sano]).bloquea).toBe(false)
  })

  it('sin ficheros staged no bloquea (un commit de docs no paga peaje)', () => {
    expect(chk.clasificar([]).bloquea).toBe(false)
  })

  it('un fallo en un fichero con JSX avisa pero NO bloquea: node --check no entiende JSX', () => {
    const jsx = { ruta: 'components/A.js', ok: false, error: "Unexpected token '<'", contenido: 'const el = <Foo />' }
    const r = chk.clasificar([jsx])
    expect(r.bloquea).toBe(false)
    expect(r.avisos).toHaveLength(1)
  })

  it('el JSX no es coartada para lo demás: si además hay un .cjs roto, bloquea igual', () => {
    const jsx = { ruta: 'components/A.js', ok: false, error: 'x', contenido: 'const el = <Foo />' }
    expect(chk.clasificar([jsx, roto]).bloquea).toBe(true)
  })

  it('el defecto REAL que lo estrenó: backticks de markdown dentro de un template literal', () => {
    // Reproduce el modo de fallo de las tres veces que ha pasado (T-282, T-349 y el que este
    // check encontró en `detect-temario-revision.cjs` el día que se escribió).
    const contenido = 'const sql = `SELECT 1\n-- OJO: el patrón `\\s` no vale\n`'
    expect(chk.pareceJsx(contenido)).toBe(false) // no se cuela por la puerta del JSX
    expect(chk.clasificar([{ ruta: 'scripts/z.cjs', ok: false, error: 'SyntaxError', contenido }]).bloquea).toBe(true)
  })
})
