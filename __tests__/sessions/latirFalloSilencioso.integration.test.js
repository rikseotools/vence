// __tests__/sessions/latirFalloSilencioso.integration.test.js — [T-687]
//
// Integración REAL contra el script (no contra el núcleo puro, que ya está cubierto en
// latidoFallo.test.js): ejecuta `scripts/sessions/latir.cjs` de verdad, con una DATABASE_URL que
// se rechaza al instante (127.0.0.1:1 — nadie escucha ahí), y comprueba lo que este ticket vino a
// arreglar: (a) el fallo NO llega a ver la luz sin `--verbose` (regla 1 de latir.cjs se conserva
// intacta) y (b) YA NO se pierde sin rastro — queda una marca local que el siguiente latido con
// éxito puede leer y convertir en un número.
//
// No hace falta BD real para esto: es justo el punto — la marca tiene que poder escribirse
// aunque la BD sea la que está caída.

const { execFileSync } = require('child_process')
const fs = require('fs')
const os = require('os')
const path = require('path')

const REPO = path.resolve(__dirname, '../..')
const LATIR = path.join(REPO, 'scripts', 'sessions', 'latir.cjs')
const MARCA_DIR = path.join(os.tmpdir(), 'vence-latido')

function correr(dbUrl, extra = []) {
  return execFileSync('node', [LATIR, '--cmd', 'test-t687', ...extra], {
    cwd: REPO,
    env: { ...process.env, DATABASE_URL: dbUrl },
    encoding: 'utf8',
    timeout: 8000,
  })
}

describe('latir.cjs — un fallo real deja marca en vez de desaparecer sin rastro', () => {
  // El sid se resuelve vía lib/sessions/sid.cjs — es el sid REAL de quien corre el test (el
  // mismo con el que late esta sesión de verdad). Se limpia su marca antes y después de cada
  // caso para no ensuciar ni depender de una ejecución anterior.
  let sidReal
  beforeAll(() => {
    const { resolverSid } = require(path.join(REPO, 'lib', 'sessions', 'sid.cjs'))
    sidReal = resolverSid({ repo: REPO }).sid
  })

  function ficheroDe(sid) {
    return path.join(MARCA_DIR, String(sid).replace(/[^a-zA-Z0-9-]/g, '_'))
  }

  it('con la BD inalcanzable: sale con 0, sin --verbose no imprime nada, y SÍ deja marca', () => {
    if (!sidReal) return // sin .session-id no hay a quién atribuir: nada que probar aquí
    const f = ficheroDe(sidReal)
    fs.rmSync(f, { force: true })

    const salida = correr('postgres://u:p@127.0.0.1:1/db')
    expect(salida.trim()).toBe('') // regla 2 de latir.cjs: silencioso sin --verbose, intacta

    const marca = JSON.parse(fs.readFileSync(f, 'utf8'))
    expect(marca.intentos).toBe(1)
    expect(marca.ultimoError).toMatch(/ECONNREFUSED/)
    expect(typeof marca.desde).toBe('string')

    fs.rmSync(f, { force: true })
  })

  it('dos fallos seguidos ACUMULAN intentos en la misma marca (no la pisan)', () => {
    if (!sidReal) return
    const f = ficheroDe(sidReal)
    fs.rmSync(f, { force: true })

    correr('postgres://u:p@127.0.0.1:1/db')
    correr('postgres://u:p@127.0.0.1:1/db')

    const marca = JSON.parse(fs.readFileSync(f, 'utf8'))
    expect(marca.intentos).toBe(2)

    fs.rmSync(f, { force: true })
  })

  it('--verbose SÍ deja ver el fallo (para depurar a mano), sin romper el exit 0', () => {
    if (!sidReal) return
    const f = ficheroDe(sidReal)
    fs.rmSync(f, { force: true })

    // El error va por STDERR (console.error), así que aquí sí hace falta spawnSync: execFileSync
    // solo devuelve stdout, y el otro caso ya prueba que ESE canal queda vacío.
    const r = require('child_process').spawnSync('node', [LATIR, '--cmd', 'test-t687', '--verbose'], {
      cwd: REPO,
      env: { ...process.env, DATABASE_URL: 'postgres://u:p@127.0.0.1:1/db' },
      encoding: 'utf8',
      timeout: 8000,
    })
    expect(r.status).toBe(0) // sigue sin romper el comando: rule 1 intacta incluso con --verbose
    expect(r.stderr).toMatch(/latido no registrado/)

    fs.rmSync(f, { force: true })
  })
})
