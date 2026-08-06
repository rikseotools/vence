/**
 * El candado de deploy entre máquinas (T-485).
 *
 * Lo que se afirma —exclusión mutua— lo demuestra `npm run sim:candado-deploy`, que lanza dos
 * adquisiciones REALES. Aquí van los trinquetes: que el criterio no se relaje, que el fail-closed
 * no se convierta en fail-open, y que el `flock` local no se quite creyendo que sobra.
 */
const path = require('path')
const fs = require('fs')
const REPO = process.cwd()
const C = require(path.join(REPO, 'lib', 'deploy', 'candado.cjs'))

const run = (o = {}) => ({
  surface: 'frontend', host: 'otra-maquina', sid: 'sesion-x', pid: 4242,
  started_at: new Date(Date.now() - 5 * 60_000), ...o,
})

describe('puedeAdquirir — el juicio', () => {
  it('sin runs abiertos, libre', () => {
    expect(C.puedeAdquirir([]).libre).toBe(true)
  })

  // Esta es LA diferencia con el modelo anterior: antes `dudoso` no bloqueaba a nadie, y el
  // deploy de otra máquina cae siempre en `dudoso`/`en_curso` porque su pid no se puede mirar.
  it('un deploy de OTRA máquina bloquea, aunque no se pueda comprobar su proceso', () => {
    const v = C.puedeAdquirir([run()], { hostActual: 'esta-maquina' })
    expect(v.libre).toBe(false)
    expect(v.quien.host).toBe('otra-maquina')
  })

  it('también bloquea cuando ya es viejo y solo se puede sospechar', () => {
    const viejo = run({ started_at: new Date(Date.now() - 120 * 60_000) })
    const v = C.puedeAdquirir([viejo], { hostActual: 'esta-maquina' })
    expect(v.libre).toBe(false)
    expect(v.quien.estado).toBe('sospechoso')
  })

  it('un run de ESTA máquina cuyo proceso ya no existe NO bloquea', () => {
    const v = C.puedeAdquirir([run({ host: 'esta' })], { hostActual: 'esta', matar: () => { throw new Error('ESRCH') } })
    expect(v.libre).toBe(true)
  })

  it('el mensaje dice QUIÉN lo tiene y cómo se sale, no solo que no', () => {
    const v = C.puedeAdquirir([run()], { hostActual: 'esta-maquina' })
    const m = C.mensajeOcupado(v)
    expect(m).toMatch(/otra-maquina/)
    expect(m).toMatch(/deploy-cuando-verde/)
    expect(m).toMatch(new RegExp(`${C.TTL_MINUTOS} min`))
  })
})

describe('el hecho (SQL) y el juicio (JS) no se pisan', () => {
  it('el SQL solo filtra por arriendo vivo: el juicio sobre procesos se queda en el núcleo', () => {
    const sql = C.sqlCandadoLibre()
    expect(sql).toMatch(/NOT EXISTS/)
    expect(sql).toMatch(/finished_at IS NULL/)
    expect(sql).toMatch(/lease_until > now\(\)/)
    // Si el SQL empezara a opinar de pids o de antigüedad, habría dos criterios (T-130).
    expect(sql).not.toMatch(/pid|started_at|interval/)
  })
})

describe('trinquetes del cableado', () => {
  const cli = fs.readFileSync(path.join(REPO, 'scripts', 'deploy', 'candado.cjs'), 'utf8')
  const scripts = ['deploy-frontend.sh', 'deploy-backend.sh'].map((f) =>
    fs.readFileSync(path.join(REPO, 'scripts', f), 'utf8'))

  it('el candado falla CERRADO: sin poder comprobar, no despliega', () => {
    expect(cli).toMatch(/process\.exit\(4\)/)
    expect(cli).toMatch(/Fail-closed/)
  })

  it('los dos deploys lo adquieren, y abortan si no pueden', () => {
    for (const s of scripts) {
      expect(s).toMatch(/candado\.cjs" adquirir/)
      expect(s).toMatch(/\|\| exit \$\?/)
    }
  })

  it('los dos renuevan mientras viven y sueltan al salir', () => {
    for (const s of scripts) {
      expect(s).toMatch(/candado\.cjs" renovar/)
      expect(s).toMatch(/candado\.cjs" soltar/)
      expect(s).toMatch(/kill "\$DEPLOY_RENOVADOR"/)
    }
  })

  // El flock NO sobra: es la puerta local, más barata, para varias sesiones en el mismo equipo.
  // Quitarlo "porque ya está el nuevo" reintroduciría el solape que T-075 costó arreglar.
  it('el flock local SIGUE puesto (defensa en profundidad)', () => {
    for (const s of scripts) {
      expect(s).toMatch(/flock/)
      expect(s).toMatch(/vence-deploy\.lock/)
    }
  })
})

// ── EL FALLO QUE SOLO EXISTE EN EL ÁRBOL DE DEPLOY ──────────────────────────────────────────
// El árbol dedicado (`/home/manuel/vence-deploy`) no tiene `node_modules` ni `.env.local`: el
// build va por Docker y nadie los echa en falta. El primer deploy real por el camino nuevo tumbó
// el candado por eso, y el fail-closed —haciendo bien su trabajo— abortó el deploy.
//
// Ningún test que corra en el repo principal puede verlo: aquí los módulos SÍ están. Por eso este
// bloque ejecuta el CLI **desde otro árbol**, que es donde el fallo vive.
describe('desde el árbol de DEPLOY (sin node_modules ni .env.local)', () => {
  const { execFileSync } = require('child_process')
  const os = require('os')
  const ENT = require(path.join(REPO, 'lib', 'deploy', 'entorno.cjs'))

  it('el checkout principal se localiza por --git-common-dir, no por la ruta propia', () => {
    const principal = ENT.repoPrincipal(REPO)
    expect(fs.existsSync(path.join(principal, 'node_modules'))).toBe(true)
    // Apuntar al árbol propio fue el error de la primera versión (y el de T-404 bis antes).
    expect(principal).not.toBe(REPO)
  })

  // En proceso HIJO con entorno controlado: mutar `process.env` en el propio test se filtraba a
  // las demás suites y la hacía fallar solo al correr todas juntas (visto en el pre-commit).
  const enHijo = (dir, env) => execFileSync('node', ['-e',
    `const E=require(${JSON.stringify(path.join(REPO, 'lib', 'deploy', 'entorno.cjs'))});` +
    `console.log(JSON.stringify(E.urlBd(${JSON.stringify(dir)})))`],
    { encoding: 'utf8', env: { ...process.env, ...env } }).trim()

  it('sin DATABASE_URL, encuentra el .env.local del checkout principal', () => {
    expect(JSON.parse(enHijo(REPO, { DATABASE_URL: '' }))).toEqual(expect.any(String))
  })

  // La prueba de fuego: el CLI, ejecutado desde el árbol de deploy real si existe.
  // Solo juzga si ese árbol YA trae este arreglo: hasta que `main` lo tenga y el propio deploy
  // resincronice, ahí vive la versión anterior y el fallo sería el de ayer, no uno nuevo.
  const ARBOL_DEPLOY = '/home/manuel/vence-deploy'
  const CLI_DEPLOY = path.join(ARBOL_DEPLOY, 'scripts', 'deploy', 'candado.cjs')
  const hay = fs.existsSync(CLI_DEPLOY)
    && !fs.existsSync(path.join(ARBOL_DEPLOY, 'node_modules'))
    && /cargarPg\(REPO\)/.test(fs.readFileSync(CLI_DEPLOY, 'utf8'))
  ;(hay ? it : it.skip)('el candado ARRANCA desde el árbol de deploy (no revienta al cargar postgres)', () => {
    const r = execFileSync('node', [CLI_DEPLOY, 'estado'],
      { cwd: ARBOL_DEPLOY, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
    expect(r).toMatch(/candado (LIBRE|)/)
    expect(r).not.toMatch(/Cannot find module/)
  })

  it('el candado NO vuelve a requerir postgres por ruta fija (el error original)', () => {
    const cli = fs.readFileSync(path.join(REPO, 'scripts', 'deploy', 'candado.cjs'), 'utf8')
    expect(cli).not.toMatch(/require\(path\.join\(REPO, 'node_modules', 'postgres'\)\)/)
    expect(cli).toMatch(/cargarPg\(REPO\)/)
  })
})
