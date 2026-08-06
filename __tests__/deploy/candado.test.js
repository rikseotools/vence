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

  // ⚠️ ESTOS DOS CASOS DEPENDEN DEL MONTAJE, y por eso llevan guarda (06/08/2026).
  //
  // Sin ella rompían `main` en el CI de GitHub y **bloqueaban el deploy de todo el mundo**,
  // incluido el de la propia tarea que los estrenó. Y no cazaban ninguna regresión al hacerlo:
  // el runner es un checkout suelto, sin worktrees y sin `.env.local`, así que lo que fallaba
  // era la PREMISA del caso, no lo que el caso afirma. Un rojo que no se puede poner verde
  // arreglando el código no es una capa de seguridad, es un peaje.
  //
  // Se conserva la afirmación universal (el principal es quien tiene las dependencias) y se
  // condiciona solo la que exige un montaje concreto — mismo patrón `hay ? it : it.skip` que
  // ya usa el caso del árbol de deploy, aquí abajo. Donde de verdad importa (esta máquina,
  // el pre-commit y el propio árbol de deploy) siguen ejecutándose enteros.
  const esWorktree = (() => {
    try { return fs.statSync(path.join(REPO, '.git')).isFile() } catch { return false }
  })()

  it('el checkout principal es el que TIENE las dependencias', () => {
    const principal = ENT.repoPrincipal(REPO)
    expect(fs.existsSync(path.join(principal, 'node_modules'))).toBe(true)
  })

  // Apuntar al árbol propio fue el error de la primera versión (y el de T-404 bis antes).
  // Solo se puede comprobar desde un worktree: en un checkout suelto `--git-common-dir`
  // devuelve el propio directorio, y con razón.
  ;(esWorktree ? it : it.skip)('desde un worktree, el principal NO es el árbol propio', () => {
    expect(ENT.repoPrincipal(REPO)).not.toBe(REPO)
  })

  // En proceso HIJO con entorno controlado: mutar `process.env` en el propio test se filtraba a
  // las demás suites y la hacía fallar solo al correr todas juntas (visto en el pre-commit).
  const enHijo = (dir, env) => execFileSync('node', ['-e',
    `const E=require(${JSON.stringify(path.join(REPO, 'lib', 'deploy', 'entorno.cjs'))});` +
    `console.log(JSON.stringify(E.urlBd(${JSON.stringify(dir)})))`],
    { encoding: 'utf8', env: { ...process.env, ...env } }).trim()

  // Igual que arriba: si no hay ningún `.env.local` que encontrar (el runner de CI no lo tiene
  // ni puede tenerlo, es un secreto), este caso no puede decir nada. Se comprueba que exista
  // ANTES de exigir que lo encuentre.
  const hayEnvLocal = (() => {
    try { return fs.existsSync(path.join(ENT.repoPrincipal(REPO), '.env.local')) } catch { return false }
  })()

  ;(hayEnvLocal ? it : it.skip)('sin DATABASE_URL, encuentra el .env.local del checkout principal', () => {
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
    // `estado` sale con 3 cuando el candado está OCUPADO, que es correcto y pasa de verdad
    // (un deploy real lo tenía tomado la primera vez que este test corrió). Lo que se comprueba
    // aquí es que ARRANQUE —que cargue `postgres` desde un árbol sin `node_modules`—, no que
    // esté libre: exigir 0 lo ataba al azar de si alguien estaba desplegando.
    let salida = ''
    try {
      salida = execFileSync('node', [CLI_DEPLOY, 'estado'],
        { cwd: ARBOL_DEPLOY, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
    } catch (e) {
      expect(e.status).not.toBe(4)   // 4 = no pudo comprobar: eso SÍ sería el fallo original
      salida = String(e.stdout || '') + String(e.stderr || '')
    }
    expect(salida).toMatch(/candado (LIBRE|)|DEPLOY EN CURSO/)
    expect(salida).not.toMatch(/Cannot find module/)
  })

  it('el candado NO vuelve a requerir postgres por ruta fija (el error original)', () => {
    const cli = fs.readFileSync(path.join(REPO, 'scripts', 'deploy', 'candado.cjs'), 'utf8')
    expect(cli).not.toMatch(/require\(path\.join\(REPO, 'node_modules', 'postgres'\)\)/)
    expect(cli).toMatch(/cargarPg\(REPO\)/)
  })
})
