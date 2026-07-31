// __tests__/guardrails/suiteRegistry.guardrail.test.ts
//
// Hace cumplir `lib/admin/suiteRegistry.ts`: el inventario de qué comprueba cada suite del job
// «Integration / perf / security». Sin BD ni red — corre en el CI de código.
//
// Lo que protege, y por qué (T-384): ese job mezcla tests de código con vigilancias de datos.
// La mezcla obligó a `continue-on-error`, y ese flag dejó el job MUDO durante ≥5 días mientras
// una vigilancia cazaba 7.134 preguntas sobre contenedores vacíos ([T-370], [T-379]).
//
// La clasificación solo sirve si se mantiene sola. Aquí se exige:
//   1. toda suite que hable con la BD está declarada (y toda entrada apunta a un fichero real);
//   2. `codigo` + BD ⇒ declara `fixturePropio` — impide que «código» sea una etiqueta cómoda;
//   3. `vigilancia` ⇒ kind REAL de runbookRegistry, o `hueco` con motivo (nada sin dueño);
//   4. una suite que NO toca la BD no se declara aquí (sería ruido: ya es determinista).

import * as fs from 'fs'
import * as path from 'path'
import { SUITE_REGISTRY } from '@/lib/admin/suiteRegistry'
import { RUNBOOK_BY_KIND } from '@/lib/admin/runbookRegistry'

const ROOT = path.resolve(__dirname, '../..')

/** Carpetas que barre `npm run test:integration` (mismo patrón que el job de CI). */
const CARPETAS = [
  '__tests__/integration',
  '__tests__/perf',
  '__tests__/security',
  '__tests__/scraping',
  '__tests__/api/user-stats',
]

/** Señales de que una suite habla con la base de datos. */
const MARCAS_BD = [
  'getAdminDb', 'getPoolerDb', 'getReadDb', 'new Client(', "from 'pg'", 'from "pg"',
  'postgres(', 'DATABASE_URL',
]

function listarSuites(): string[] {
  const out: string[] = []
  for (const dir of CARPETAS) {
    const abs = path.join(ROOT, dir)
    if (!fs.existsSync(abs)) continue
    for (const f of fs.readdirSync(abs)) {
      if (/\.test\.tsx?$/.test(f)) out.push(path.join(dir, f))
    }
  }
  return out.sort()
}

/**
 * ¿Esta suite habla con la BD? Mira el fichero Y los helpers relativos que importa.
 *
 * Lo segundo no es teórico: al extraer el fixture de referidos a `helpers/referralsFixture.ts`
 * (T-336), las dos suites dejaron de nombrar `getAdminDb` y una detección ingenua las habría
 * dado por deterministas justo cuando más dependían de la BD.
 */
function tocaBd(rutaRel: string): boolean {
  const leer = (p: string) => (fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '')
  const propio = leer(path.join(ROOT, rutaRel))

  // Una suite que MOCKEA el cliente de BD no habla con ninguna base: nombra `getAdminDb` para
  // sustituirlo. Contarla sería obligar a clasificar como «depende de datos» algo que es
  // determinista por construcción. Lo encontró este mismo guardarraíl en su primera pasada,
  // con `sessionIpAlNacer` (mockea `@/db/client` entero y valida por mutación).
  if (/jest\.mock\(\s*['"](@\/db\/client|pg|postgres)['"]/.test(propio)) return false

  let texto = propio
  for (const m of propio.matchAll(/from\s+['"](\.[^'"]+)['"]/g)) {
    const base = path.join(ROOT, path.dirname(rutaRel), m[1])
    texto += leer(`${base}.ts`) + leer(`${base}.tsx`) + leer(path.join(base, 'index.ts'))
  }
  return MARCAS_BD.some((s) => texto.includes(s))
}

describe('suiteRegistry — el inventario del job de integración no caduca', () => {
  const suites = listarSuites()
  const conBd = suites.filter(tocaBd)
  const declaradas = new Set(SUITE_REGISTRY.map((e) => e.ruta))

  it('hay suites que inventariar (la propia detección no está rota)', () => {
    expect(suites.length).toBeGreaterThan(50)
    expect(conBd.length).toBeGreaterThan(10)
  })

  it('toda entrada del registro apunta a un fichero que existe', () => {
    const fantasmas = SUITE_REGISTRY.filter((e) => !fs.existsSync(path.join(ROOT, e.ruta)))
    expect(fantasmas.map((e) => e.ruta)).toEqual([])
  })

  it('no hay entradas duplicadas', () => {
    const vistas = new Set<string>()
    const dup = SUITE_REGISTRY.filter((e) => (vistas.has(e.ruta) ? true : (vistas.add(e.ruta), false)))
    expect(dup.map((e) => e.ruta)).toEqual([])
  })

  // El corazón: una suite nueva que hable con la BD OBLIGA a decir qué clase de verdad comprueba.
  // Sin esto, el inventario envejece en una semana y volvemos al punto de partida.
  it('toda suite que habla con la BD está clasificada', () => {
    const sinDeclarar = conBd.filter((r) => !declaradas.has(r))
    expect(sinDeclarar).toEqual([])
  })

  it('no se declaran suites que NO tocan la BD (serían ruido: ya son deterministas)', () => {
    const sobran = SUITE_REGISTRY.filter((e) => !tocaBd(e.ruta))
    expect(sobran.map((e) => e.ruta)).toEqual([])
  })

  // Impide que `codigo` se use como etiqueta cómoda para no pensar: si toca la BD y dice ser
  // código, tiene que afirmar explícitamente si crea lo que lee.
  it('una suite `codigo` que toca la BD declara si crea sus propios datos', () => {
    const mudas = SUITE_REGISTRY.filter(
      (e) => e.tipo === 'codigo' && e.fixturePropio === undefined,
    )
    expect(mudas.map((e) => e.ruta)).toEqual([])
  })

  // Seguridad, no papeleo: una suite que CREA datos debe estar detrás de
  // `INTEGRATION_DB_WRITABLE=1`. Es lo que impide que escriba en producción el día que CI reciba
  // una credencial con permiso de escritura. Y se comprueba contra el FICHERO, no contra la buena
  // intención: hasta T-384 las dos suites de referidos eran las únicas sin gatear, y por eso eran
  // de las pocas que intentaban correr en un CI sin BD escribible.
  it('una suite que crea datos está gateada por INTEGRATION_DB_WRITABLE, y lo declara', () => {
    const escritoras = SUITE_REGISTRY.filter((e) => e.fixturePropio === true)
    expect(escritoras.length).toBeGreaterThan(5)

    const incoherentes = escritoras.filter((e) => {
      const src = fs.readFileSync(path.join(ROOT, e.ruta), 'utf8')
      const gateaDeVerdad = src.includes('INTEGRATION_DB_WRITABLE')
      return e.gateEscritura !== true || !gateaDeVerdad
    })
    expect(incoherentes.map((e) => e.ruta)).toEqual([])
  })

  it('solo las que crean datos declaran gate de escritura', () => {
    const sobra = SUITE_REGISTRY.filter((e) => e.gateEscritura && e.fixturePropio !== true)
    expect(sobra.map((e) => e.ruta)).toEqual([])
  })

  // Anti-silo: mover una vigilancia al barrido no puede dejarla sin dueño. O tiene kind real,
  // o el hueco está escrito. Un kind inventado aquí sería vigilancia imaginaria.
  it('cada vigilancia cita un kind REAL de runbookRegistry, o declara su hueco', () => {
    const rotas = SUITE_REGISTRY.filter((e) => {
      if (e.tipo !== 'vigilancia') return false
      if (e.kind) return !(e.kind in RUNBOOK_BY_KIND)
      return !e.hueco || e.hueco.trim().length < 20
    })
    expect(rotas.map((e) => `${e.ruta} (kind=${e.kind ?? '—'})`)).toEqual([])
  })

  it('solo las vigilancias usan kind/hueco', () => {
    const confundidas = SUITE_REGISTRY.filter((e) => e.tipo !== 'vigilancia' && (e.kind || e.hueco))
    expect(confundidas.map((e) => e.ruta)).toEqual([])
  })

  it('toda entrada explica QUÉ comprueba (el inventario se lee, no se cuenta)', () => {
    const vacias = SUITE_REGISTRY.filter((e) => !e.que || e.que.trim().length < 25)
    expect(vacias.map((e) => e.ruta)).toEqual([])
  })
})
